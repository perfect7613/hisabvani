from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
import os
import base64
import json

from backend.agents.llm_agent import LLMAgent
from backend.agents.video_agent import VideoAgent
from backend.models.database import Database

router = APIRouter(prefix="/api", tags=["video"])

llm_agent = LLMAgent(api_key=os.getenv("SARVAM_API_KEY"))
video_agent = VideoAgent(
    api_key=os.getenv("DAYTONA_API_KEY"),
    api_url=os.getenv("DAYTONA_API_URL", "https://app.daytona.io/api")
)
db = Database()


class VideoRequest(BaseModel):
    transaction_id: Optional[int] = None
    title: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    description: Optional[str] = None


class VideoResponse(BaseModel):
    video_base64: str
    title: str
    amount: float
    category: str
    description: str


@router.post("/generate-video", response_model=VideoResponse)
async def generate_video(request: VideoRequest):
    try:
        if request.transaction_id:
            transactions = db.get_transactions(limit=100)
            tx = next((t for t in transactions if t.id == request.transaction_id), None)
            if not tx:
                raise HTTPException(status_code=404, detail="Transaction not found")
            title = "Expense Logged"
            amount = tx.amount
            category = tx.category
            description = tx.description
        else:
            title = request.title or "Expense Report"
            amount = request.amount or 0
            category = request.category or "other"
            description = request.description or ""

        prompt = f"""Create a short, catchy title (max 5 words) for a video expense report:
Amount: Rs.{amount}
Category: {category}
Description: {description}

Return ONLY the title text, nothing else."""

        llm_response = llm_agent.chat(
            messages=[
                {"role": "system", "content": "You create catchy video titles for expense reports. Return ONLY the title."},
                {"role": "user", "content": prompt}
            ],
            model="sarvam-105b",
            temperature=0.7,
            max_tokens=50
        )

        generated_title = llm_response.choices[0].message.content.strip().strip('"').strip("'")

        expense_data = {
            "title": generated_title,
            "amount": amount,
            "category": category,
            "description": description,
            "date": "Today"
        }

        video_bytes = video_agent.render_expense_video(expense_data)
        video_b64 = base64.b64encode(video_bytes).decode("utf-8")

        return VideoResponse(
            video_base64=video_b64,
            title=generated_title,
            amount=amount,
            category=category,
            description=description
        )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error in generate-video: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/download-video/{transaction_id}")
async def download_video(transaction_id: int):
    try:
        transactions = db.get_transactions(limit=100)
        tx = next((t for t in transactions if t.id == transaction_id), None)
        if not tx:
            raise HTTPException(status_code=404, detail="Transaction not found")

        expense_data = {
            "title": "Expense Logged",
            "amount": tx.amount,
            "category": tx.category,
            "description": tx.description,
            "date": tx.date
        }

        video_bytes = video_agent.render_expense_video(expense_data)

        return Response(
            content=video_bytes,
            media_type="video/mp4",
            headers={"Content-Disposition": f"attachment; filename=expense_{transaction_id}.mp4"}
        )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error in download-video: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
