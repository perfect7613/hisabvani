import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="HisabVani API",
    description="Voice + Vision Family Finance Agent for Indian Households",
    version="0.1.0",
)

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=os.getenv(
        "ALLOWED_ORIGIN_REGEX",
        r"https://.*\.vercel\.app",
    ),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "HisabVani API is running"}


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "hisabvani-api",
        "runtime": "render" if os.getenv("RENDER") else "local",
    }


from backend.routes import router
from backend.routes_bills import router as bills_router
from backend.routes_compute import router as compute_router
from backend.routes_voice_expense import router as voice_expense_router
from backend.routes_video import router as video_router
app.include_router(router)
app.include_router(bills_router)
app.include_router(compute_router)
app.include_router(voice_expense_router)
app.include_router(video_router)
