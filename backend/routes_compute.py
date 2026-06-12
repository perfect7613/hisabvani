from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from backend.agents.compute_agent import ComputeAgent
from backend.models.database import Database
import os

router = APIRouter(prefix="/api", tags=["compute"])

compute_agent = ComputeAgent(
    api_key=os.getenv("DAYTONA_API_KEY"),
    api_url=os.getenv("DAYTONA_API_URL", "https://app.daytona.io/api")
)
db = Database()


class CalculateRequest(BaseModel):
    code: str
    description: Optional[str] = None


class CalculateResponse(BaseModel):
    stdout: str
    stderr: str
    error: Optional[dict] = None
    success: bool


@router.post("/calculate", response_model=CalculateResponse)
async def calculate(request: CalculateRequest):
    try:
        result = compute_agent.execute_code(
            code=request.code,
            timeout=300
        )

        return CalculateResponse(
            stdout=result["stdout"],
            stderr=result["stderr"],
            error=result["error"],
            success=result["success"]
        )

    except Exception as e:
        import traceback
        print(f"Error in calculate: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sample-data")
async def get_sample_data():
    try:
        transactions = db.get_transactions(limit=100)
        expenses_by_category = db.get_expenses_by_category()
        total_expenses = db.get_total_expenses()

        return {
            "transactions": [t.model_dump() for t in transactions],
            "expenses_by_category": expenses_by_category,
            "total_expenses": total_expenses,
            "count": len(transactions)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
