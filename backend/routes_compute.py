from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from backend.agents.compute_agent import ComputeAgent
import os

router = APIRouter(prefix="/api", tags=["compute"])

compute_agent = ComputeAgent(
    api_key=os.getenv("DAYTONA_API_KEY"),
    api_url=os.getenv("DAYTONA_API_URL", "https://app.daytona.io/api")
)


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
