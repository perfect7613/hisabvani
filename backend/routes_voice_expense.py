from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Optional
import os
import json
from datetime import datetime

from backend.agents.speech_agent import SpeechAgent
from backend.agents.llm_agent import LLMAgent
from backend.models.database import Database, Transaction

router = APIRouter(prefix="/api", tags=["voice-expense"])

speech_agent = SpeechAgent(api_key=os.getenv("SARVAM_API_KEY"))
llm_agent = LLMAgent(api_key=os.getenv("SARVAM_API_KEY"))
db = Database()


class VoiceExpenseResponse(BaseModel):
    transcript: str
    amount: float
    category: str
    description: str
    transaction_id: int
    confirmation: str


@router.post("/voice-expense", response_model=VoiceExpenseResponse)
async def voice_expense(audio: UploadFile = File(...)):
    try:
        audio_bytes = await audio.read()

        transcript_result = speech_agent.transcribe(audio_bytes)
        transcript = transcript_result.transcript
        language_code = transcript_result.language_code or "hi-IN"

        if not transcript or not transcript.strip():
            raise HTTPException(
                status_code=400,
                detail="Could not transcribe audio. Please speak clearly."
            )

        extraction_prompt = f"""Extract expense details from this Hindi/Hinglish voice note:
"{transcript}"

Return ONLY a JSON object with these exact keys:
{{
  "amount": <number in rupees>,
  "category": "<one of: food, transport, education, medical, entertainment, shopping, utilities, rent, other>",
  "description": "<brief description in English>"
}}

Examples:
- "Aaj chai pe 50 rupaye kharcha kiye" → {{"amount": 50, "category": "food", "description": "Tea"}}
- "School fees 15000 di" → {{"amount": 15000, "category": "education", "description": "School fees"}}
- "Petrol 500 ka dalwaya" → {{"amount": 500, "category": "transport", "description": "Petrol"}}

Return ONLY the JSON, no other text."""

        llm_response = llm_agent.chat(
            messages=[
                {"role": "system", "content": "You are an expense extraction assistant. Extract amount, category, and description from Hindi/Hinglish voice notes. Return ONLY valid JSON, no other text."},
                {"role": "user", "content": extraction_prompt}
            ],
            model="sarvam-30b",
            temperature=0.3,
            max_tokens=200
        )

        response_text = llm_response.choices[0].message.content

        try:
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                expense_data = json.loads(json_str)
            else:
                raise ValueError("No JSON found in response")

            amount = float(expense_data.get("amount", 0))
            category = expense_data.get("category", "other")
            description = expense_data.get("description", "")

            if amount <= 0:
                raise ValueError("Invalid amount")

        except (json.JSONDecodeError, ValueError, KeyError) as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to extract expense details: {str(e)}"
            )

        transaction = Transaction(
            date=datetime.now().strftime("%Y-%m-%d"),
            amount=amount,
            category=category,
            vendor="",
            description=description,
            source_document="voice"
        )
        transaction_id = db.add_transaction(transaction)

        confirmation = f"Haan ji, {amount} rupaye {category} ke liye note kar liye. {description}."

        return VoiceExpenseResponse(
            transcript=transcript,
            amount=amount,
            category=category,
            description=description,
            transaction_id=transaction_id,
            confirmation=confirmation
        )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error in voice-expense: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
