from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from backend.agents.speech_agent import SpeechAgent
from backend.agents.llm_agent import LLMAgent
import os

router = APIRouter(prefix="/api", tags=["voice"])

speech_agent = SpeechAgent(api_key=os.getenv("SARVAM_API_KEY"))
llm_agent = LLMAgent(api_key=os.getenv("SARVAM_API_KEY"))


class VoiceQueryResponse(BaseModel):
    transcript: str
    response: str
    language_code: str


@router.post("/voice-query", response_model=VoiceQueryResponse)
async def voice_query(audio: UploadFile = File(...)):
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
                transcript="",
                response="I couldn't understand the audio. Please speak clearly in Hindi, Hinglish, Kannada, Tamil, or English.",
                language_code=language_code
            )

        llm_response = llm_agent.chat(
            messages=[
                {"role": "system", "content": "You are HisabVani, a helpful family finance assistant for Indian households. Respond in the same language as the user's query. Be warm, simple, and conversational."},
                {"role": "user", "content": transcript}
            ],
            model="sarvam-30b",
            temperature=0.7,
            max_tokens=1024,
            reasoning_effort=None
        )

        response_text = llm_response.choices[0].message.content

        return VoiceQueryResponse(
            transcript=transcript,
            response=response_text,
            language_code=language_code
        )

    except Exception as e:
        import traceback
        print(f"Error in voice_query: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
