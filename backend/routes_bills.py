from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from backend.agents.vision_agent import VisionAgent
from backend.agents.llm_agent import LLMAgent
from backend.models.database import Transaction
import os
import re
import json
from datetime import datetime
from uuid import uuid4

router = APIRouter(prefix="/api", tags=["bills"])

vision_agent = VisionAgent(api_key=os.getenv("SARVAM_API_KEY"))
llm_agent = LLMAgent(api_key=os.getenv("SARVAM_API_KEY"))


class BillUploadResponse(BaseModel):
    record_id: str
    extracted_text: str
    transaction: Transaction


def parse_markdown_to_transaction(markdown_text: str) -> Transaction:
    date = datetime.now().strftime("%Y-%m-%d")
    amount = 0.0
    category = "other"
    vendor = "Unknown"
    description = ""

    date_match = re.search(r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})', markdown_text)
    if date_match:
        date = date_match.group(1)

    amount_patterns = [
        r'(?:Rs\.?|₹|INR)\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?)',
        r'(?:Amount|Total|Sum)[:\s]*(?:Rs\.?|₹|INR)?\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?)',
        r'(\d{1,3}(?:,\d{2,3})+(?:\.\d{2})?)',
    ]

    for pattern in amount_patterns:
        amount_match = re.search(pattern, markdown_text, re.IGNORECASE)
        if amount_match:
            amount_str = amount_match.group(1).replace(',', '')
            amount = float(amount_str)
            break

    text_lower = markdown_text.lower()
    if any(word in text_lower for word in ['school', 'college', 'university', 'tuition', 'fee', 'education']):
        category = "education"
    elif any(word in text_lower for word in ['hospital', 'clinic', 'doctor', 'medical', 'pharmacy', 'medicine']):
        category = "medical"
    elif any(word in text_lower for word in ['emi', 'loan', 'installment']):
        category = "emi"
    elif any(word in text_lower for word in ['rent', 'lease']):
        category = "rent"
    elif any(word in text_lower for word in ['electricity', 'water', 'gas', 'utility', 'bill']):
        category = "utilities"
    elif any(word in text_lower for word in ['grocery', 'supermarket', 'food', 'vegetable', 'fruit']):
        category = "groceries"

    lines = markdown_text.strip().split('\n')
    if lines:
        vendor = lines[0][:50]
        description = markdown_text[:200]

    return Transaction(
        date=date,
        amount=amount,
        category=category,
        vendor=vendor,
        description=description,
        source_document="uploaded"
    )


def extract_transaction_with_llm(markdown_text: str) -> Transaction:
    response = llm_agent.chat(
        messages=[
            {
                "role": "system",
                "content": (
                    "Extract one household transaction from OCR text. Return only "
                    "valid JSON with date, amount, category, vendor, and description. "
                    "Use category food, transport, education, medical, entertainment, "
                    "shopping, utilities, rent, emi, groceries, or other. Do not invent "
                    "details that are not present."
                ),
            },
            {"role": "user", "content": markdown_text[:12000]},
        ],
        model="sarvam-30b",
        temperature=0.1,
        max_tokens=350,
    )
    content = response.choices[0].message.content
    start = content.find("{")
    end = content.rfind("}") + 1
    if start < 0 or end <= start:
        raise ValueError("Sarvam 30B returned no JSON object")
    data = json.loads(content[start:end])
    return Transaction(
        date=str(data.get("date") or datetime.now().strftime("%Y-%m-%d")),
        amount=float(data.get("amount") or 0),
        category=str(data.get("category") or "other").lower(),
        vendor=str(data.get("vendor") or "Unknown")[:100],
        description=str(data.get("description") or "")[:300],
        source_document="uploaded",
    )


@router.post("/upload-bill", response_model=BillUploadResponse)
async def upload_bill(file: UploadFile = File(...)):
    try:
        file_data = await file.read()

        extracted_text = vision_agent.extract_document(
            file_data=file_data,
            filename=file.filename,
            language="hi-IN",
            output_format="md"
        )

        try:
            transaction = extract_transaction_with_llm(extracted_text)
        except Exception:
            transaction = parse_markdown_to_transaction(extracted_text)

        return BillUploadResponse(
            record_id=f"bill-{uuid4()}",
            extracted_text=extracted_text,
            transaction=transaction
        )

    except Exception as e:
        import traceback
        print(f"Error in upload_bill: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
