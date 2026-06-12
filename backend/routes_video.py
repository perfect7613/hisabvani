from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from typing import Optional
from concurrent.futures import ThreadPoolExecutor
import os
from pathlib import Path
from threading import Lock
from uuid import uuid4

from backend.agents.llm_agent import LLMAgent
from backend.agents.translation_agent import (
    SUPPORTED_VIDEO_LANGUAGES,
    TranslationAgent,
)
from backend.agents.video_agent import VideoAgent
from backend.models.database import Database

router = APIRouter(prefix="/api", tags=["video"])

llm_agent = LLMAgent(api_key=os.getenv("SARVAM_API_KEY"))
translation_agent = TranslationAgent(api_key=os.getenv("SARVAM_API_KEY"))
video_agent = VideoAgent(
    api_key=os.getenv("DAYTONA_API_KEY"),
    api_url=os.getenv("DAYTONA_API_URL", "https://app.daytona.io/api"),
    heygen_api_key=os.getenv("HEYGEN_API_KEY"),
)
db = Database()
VIDEO_OUTPUT_DIR = Path(
    os.getenv(
        "VIDEO_OUTPUT_DIR",
        Path(__file__).resolve().parent.parent / "generated_videos",
    )
)
VIDEO_JOB_EXECUTOR = ThreadPoolExecutor(
    max_workers=int(os.getenv("VIDEO_RENDER_WORKERS", "2")),
    thread_name_prefix="video-render",
)
VIDEO_JOBS: dict[str, dict] = {}
VIDEO_JOBS_LOCK = Lock()


class VideoRequest(BaseModel):
    transaction_id: Optional[int] = None
    title: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    description: Optional[str] = None
    language_code: str = "en-IN"


class VideoResponse(BaseModel):
    video_id: str
    video_url: str
    title: str
    amount: float
    category: str
    description: str
    duration_seconds: float = 12
    audio_provider: str
    music_name: Optional[str] = None
    sound_effect_name: Optional[str] = None
    language_code: str
    language_name: str


class VideoJobCreated(BaseModel):
    job_id: str
    status: str
    status_url: str


class VideoJobStatus(BaseModel):
    job_id: str
    status: str
    result: Optional[VideoResponse] = None
    error: Optional[str] = None


def persist_video(video_bytes: bytes) -> str:
    VIDEO_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    video_id = uuid4().hex
    target = VIDEO_OUTPUT_DIR / f"{video_id}.mp4"
    temporary = target.with_suffix(".tmp")
    temporary.write_bytes(video_bytes)
    temporary.replace(target)
    return video_id


def video_path(video_id: str) -> Path:
    if not video_id.isalnum():
        raise HTTPException(status_code=404, detail="Video not found")
    path = VIDEO_OUTPUT_DIR / f"{video_id}.mp4"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Video not found")
    return path


def render_video(request: VideoRequest) -> VideoResponse:
    if request.transaction_id:
        transactions = db.get_transactions(limit=100)
        tx = next((t for t in transactions if t.id == request.transaction_id), None)
        if not tx:
            raise ValueError("Transaction not found")
        amount = tx.amount
        category = tx.category
        description = tx.description
    else:
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
            {
                "role": "system",
                "content": (
                    "You create catchy video titles for expense reports. "
                    "Return ONLY the title."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        model="sarvam-105b",
        temperature=0.7,
        max_tokens=50,
    )

    generated_title = (
        llm_response.choices[0].message.content.strip().strip('"').strip("'")
    )
    translated_copy = translation_agent.translate_video_copy(
        title=generated_title,
        category=category,
        description=description,
        date="Today",
        target_language_code=request.language_code,
    )
    rendered = video_agent.render_expense_video(
        {
            **translated_copy,
            "amount": amount,
        }
    )
    video_id = persist_video(rendered.content)
    music = rendered.audio_metadata.get("music", {})
    sound_effect = rendered.audio_metadata.get("sound_effect", {})

    return VideoResponse(
        video_id=video_id,
        video_url=f"/api/videos/{video_id}",
        title=translated_copy["title"],
        amount=amount,
        category=translated_copy["category"],
        description=translated_copy["description"],
        audio_provider=rendered.audio_metadata.get("provider", "heygen"),
        music_name=music.get("name"),
        sound_effect_name=sound_effect.get("name"),
        language_code=request.language_code,
        language_name=translated_copy["language_name"],
    )


def run_video_job(job_id: str, request: VideoRequest):
    with VIDEO_JOBS_LOCK:
        VIDEO_JOBS[job_id]["status"] = "rendering"

    try:
        result = render_video(request)
        with VIDEO_JOBS_LOCK:
            VIDEO_JOBS[job_id] = {
                "job_id": job_id,
                "status": "completed",
                "result": result,
                "error": None,
            }
    except Exception as error:
        import traceback

        print(f"Error in video job {job_id}: {error}")
        print(traceback.format_exc())
        with VIDEO_JOBS_LOCK:
            VIDEO_JOBS[job_id] = {
                "job_id": job_id,
                "status": "failed",
                "result": None,
                "error": str(error),
            }


@router.post(
    "/generate-video",
    response_model=VideoJobCreated,
    status_code=202,
)
async def generate_video(request: VideoRequest):
    if request.language_code not in SUPPORTED_VIDEO_LANGUAGES:
        raise HTTPException(status_code=422, detail="Unsupported language")

    job_id = uuid4().hex
    with VIDEO_JOBS_LOCK:
        VIDEO_JOBS[job_id] = {
            "job_id": job_id,
            "status": "queued",
            "result": None,
            "error": None,
        }
    VIDEO_JOB_EXECUTOR.submit(run_video_job, job_id, request.model_copy(deep=True))

    return VideoJobCreated(
        job_id=job_id,
        status="queued",
        status_url=f"/api/video-jobs/{job_id}",
    )


@router.get("/video-jobs/{job_id}", response_model=VideoJobStatus)
async def get_video_job(job_id: str):
    with VIDEO_JOBS_LOCK:
        job = VIDEO_JOBS.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Video job not found")
        return VideoJobStatus(**job)


@router.get("/videos/{video_id}")
async def get_video(video_id: str, download: bool = Query(default=False)):
    path = video_path(video_id)
    disposition = "attachment" if download else "inline"
    return FileResponse(
        path,
        media_type="video/mp4",
        filename=f"hisabvani_{video_id}.mp4" if download else None,
        headers={
            "Cache-Control": "no-store",
            "Content-Disposition": (
                f'{disposition}; filename="hisabvani_{video_id}.mp4"'
            ),
            "Accept-Ranges": "bytes",
        },
    )


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

        rendered = video_agent.render_expense_video(expense_data)

        return Response(
            content=rendered.content,
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
