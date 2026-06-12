from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from backend.agents.speech_agent import SpeechAgent
from backend.agents.llm_agent import LLMAgent
import os
import json
from uuid import uuid4

router = APIRouter(prefix="/api", tags=["voice"])

speech_agent = SpeechAgent(api_key=os.getenv("SARVAM_API_KEY"))
llm_agent = LLMAgent(api_key=os.getenv("SARVAM_API_KEY"))


class VoiceQueryResponse(BaseModel):
    record_id: str
    transcript: str
    response: str
    language_code: str
    model: str
    grounded_transaction_count: int


@router.post("/voice-query", response_model=VoiceQueryResponse)
async def voice_query(
    audio: UploadFile = File(...),
    household_context: str = Form(default="{}"),
):
    try:
        audio_bytes = await audio.read()

        transcript_result = speech_agent.transcribe(
            audio_data=audio_bytes,
            model="saaras:v3",
            mode="codemix",
            language_code="unknown"
        )

        transcript = transcript_result.transcript
        language_code = transcript_result.language_code or "unknown"

        if not transcript or not transcript.strip():
            return VoiceQueryResponse(
                record_id=f"ask-{uuid4()}",
                transcript="",
                response="I couldn't understand the audio. Please speak clearly in Hindi, Hinglish, Kannada, Tamil, or English.",
                language_code=language_code,
                model="sarvam-105b",
                grounded_transaction_count=0,
            )

        try:
            context = json.loads(household_context)
        except json.JSONDecodeError:
            context = {}
        transactions = context.get("transactions", [])[:30]
        conversations = context.get("conversations", [])[:8]
        ledger_json = json.dumps(
            {
                "transactions": transactions,
                "previous_conversations": conversations,
            },
            ensure_ascii=False,
        )

        llm_response = llm_agent.chat(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are HisabVani, a careful financial reasoning assistant "
                        "for Indian households. Answer in the same language and script "
                        "as the user's question. Ground every numerical claim in the "
                        "provided household ledger. Never invent income, budgets, dates, "
                        "or expenses. If the ledger is insufficient, say exactly what is "
                        "missing. Give a direct answer, brief evidence, and one practical "
                        "next step. Do not give regulated investment or tax advice."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"HOUSEHOLD LEDGER:\n{ledger_json}\n\n"
                        f"QUESTION:\n{transcript}"
                    ),
                },
            ],
            model="sarvam-105b",
            temperature=0.25,
            max_tokens=1200,
            reasoning_effort="high",
        )

        response_text = llm_response.choices[0].message.content

        return VoiceQueryResponse(
            record_id=f"ask-{uuid4()}",
            transcript=transcript,
            response=response_text,
            language_code=language_code,
            model="sarvam-105b",
            grounded_transaction_count=len(transactions),
        )

    except Exception as e:
        import traceback
        print(f"Error in voice_query: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
