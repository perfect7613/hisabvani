from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="HisabVani API",
    description="Voice + Vision Family Finance Agent for Indian Households",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "HisabVani API is running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


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
