from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List
from backend.agents.vision_agent import VisionAgent
from backend.models.database import Database, Transaction
import os
import re
from datetime import datetime

router = APIRouter(prefix="/api", tags=["bills"])

vision_agent = VisionAgent(api_key=os.getenv("SARVAM_API_KEY"))
db = Database()


class BillUploadResponse(BaseModel):
    transaction_id: int
    extracted_text: str
    transaction: Transaction


class TransactionListResponse(BaseModel):
    transactions: List[Transaction]
    total: float


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

        transaction = parse_markdown_to_transaction(extracted_text)
        transaction_id = db.add_transaction(transaction)
        transaction.id = transaction_id

        return BillUploadResponse(
            transaction_id=transaction_id,
            extracted_text=extracted_text,
            transaction=transaction
        )

    except Exception as e:
        import traceback
        print(f"Error in upload_bill: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/transactions", response_model=TransactionListResponse)
async def get_transactions(limit: int = 100):
    try:
        transactions = db.get_transactions(limit=limit)
        total = db.get_total_expenses()
        return TransactionListResponse(
            transactions=transactions,
            total=total
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
