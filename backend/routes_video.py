from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Lock
from typing import Optional
from uuid import uuid4
import json
import os

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from backend.agents.llm_agent import LLMAgent
from backend.agents.translation_agent import (
    SUPPORTED_VIDEO_LANGUAGES,
    TranslationAgent,
)
from backend.agents.video_agent import VideoAgent


router = APIRouter(prefix="/api", tags=["video"])

llm_agent = LLMAgent(api_key=os.getenv("SARVAM_API_KEY"))
translation_agent = TranslationAgent(api_key=os.getenv("SARVAM_API_KEY"))
video_agent = VideoAgent(
    api_key=os.getenv("DAYTONA_API_KEY"),
    api_url=os.getenv("DAYTONA_API_URL", "https://app.daytona.io/api"),
    heygen_api_key=os.getenv("HEYGEN_API_KEY"),
)
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


class ReportTransaction(BaseModel):
    id: Optional[str] = None
    date: str
    amount: float
    category: str
    vendor: str = ""
    description: str = ""
    source: str = "voice"


class ReportConversation(BaseModel):
    id: Optional[str] = None
    question: str
    answer: str
    created_at: Optional[str] = None


class VideoRequest(BaseModel):
    title: Optional[str] = None
    transactions: list[ReportTransaction] = Field(default_factory=list)
    conversations: list[ReportConversation] = Field(default_factory=list)
    language_code: str = "en-IN"


class VideoResponse(BaseModel):
    video_id: str
    video_url: str
    title: str
    total_amount: float
    transaction_count: int
    conversation_count: int
    duration_seconds: float = 18
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


def parse_report_copy(content: Optional[str], fallback: dict) -> dict:
    if not content:
        return fallback
    start = content.find("{")
    end = content.rfind("}") + 1
    if start < 0 or end <= start:
        return fallback
    try:
        parsed = json.loads(content[start:end])
    except json.JSONDecodeError:
        return fallback
    return {
        key: str(parsed.get(key) or value).strip()
        for key, value in fallback.items()
    }


def completion_content(response) -> Optional[str]:
    choices = getattr(response, "choices", None) or []
    if not choices:
        return None
    return getattr(getattr(choices[0], "message", None), "content", None)


def completion_finish_reason(response) -> str:
    choices = getattr(response, "choices", None) or []
    if not choices:
        return "missing_choice"
    return str(getattr(choices[0], "finish_reason", "unknown"))


def generate_report_copy(
    transactions: list[ReportTransaction],
    conversations: list[ReportConversation],
    requested_title: Optional[str],
) -> dict:
    category_totals: dict[str, float] = {}
    for transaction in transactions:
        category_totals[transaction.category] = (
            category_totals.get(transaction.category, 0) + transaction.amount
        )
    top_category = max(category_totals, key=category_totals.get)
    total_amount = sum(item.amount for item in transactions)
    expense_label = "expense" if len(transactions) == 1 else "expenses"
    fallback = {
        "title": requested_title or "Our Household Money Story",
        "headline": (
            f"₹{total_amount:,.0f} across {len(transactions)} {expense_label}"
        ),
        "insight": f"{top_category.title()} was the largest spending category.",
        "advice": "Review the largest category together before the next month begins.",
        "conversation_summary": (
            "The family asked for practical ways to understand and improve spending."
            if conversations
            else "No financial questions were included in this report."
        ),
    }
    prompt_data = {
        "transactions": [item.model_dump() for item in transactions],
        "financial_conversations": [item.model_dump() for item in conversations],
        "computed": {
            "total_amount": total_amount,
            "category_totals": category_totals,
            "top_category": top_category,
        },
    }
    messages = [
        {
            "role": "system",
            "content": (
                "You create concise, evidence-grounded household finance report "
                "copy. Use only the supplied transactions, computed totals, and "
                "conversation answers. Never invent income or savings. Return only "
                "a JSON object with title, headline, insight, advice, and "
                "conversation_summary. Keep title under 6 words and every other "
                "field under 22 words. Write in clear English so it can be translated."
            ),
        },
        {
            "role": "user",
            "content": json.dumps(prompt_data, ensure_ascii=False),
        },
    ]
    response = llm_agent.chat(
        messages=messages,
        model="sarvam-105b",
        temperature=0.2,
        max_tokens=1800,
        reasoning_effort="high",
    )
    content = completion_content(response)
    if not content:
        finish_reason = completion_finish_reason(response)
        print(
            "Sarvam 105B returned no final report copy "
            f"(finish_reason={finish_reason}); retrying with low reasoning"
        )
        retry = llm_agent.chat(
            messages=messages,
            model="sarvam-105b",
            temperature=0.1,
            max_tokens=700,
            reasoning_effort="low",
        )
        content = completion_content(retry)
        if not content:
            print("Sarvam 105B retry returned no final report copy; using fallback")

    return parse_report_copy(content, fallback)


def render_video(request: VideoRequest) -> VideoResponse:
    transactions = request.transactions[:8]
    conversations = request.conversations[:4]
    if not transactions:
        raise ValueError("Select at least one saved transaction")

    report_copy = generate_report_copy(
        transactions,
        conversations,
        request.title,
    )
    translated_copy = translation_agent.translate_report_copy(
        report_copy=report_copy,
        transactions=[item.model_dump() for item in transactions[:5]],
        target_language_code=request.language_code,
    )
    total_amount = sum(item.amount for item in transactions)
    rendered = video_agent.render_report_video(
        {
            **translated_copy,
            "total_amount": total_amount,
            "transaction_count": len(transactions),
            "conversation_count": len(conversations),
        }
    )
    video_id = persist_video(rendered.content)
    music = rendered.audio_metadata.get("music", {})
    sound_effect = rendered.audio_metadata.get("sound_effect", {})

    return VideoResponse(
        video_id=video_id,
        video_url=f"/api/videos/{video_id}",
        title=translated_copy["title"],
        total_amount=total_amount,
        transaction_count=len(transactions),
        conversation_count=len(conversations),
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
    if not request.transactions:
        raise HTTPException(
            status_code=422,
            detail="Select at least one saved transaction",
        )

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
