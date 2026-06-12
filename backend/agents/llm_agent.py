from sarvamai import SarvamAI
from typing import List, Dict, Any, Optional


class LLMAgent:
    def __init__(self, api_key: str):
        self.client = SarvamAI(api_subscription_key=api_key)

    def chat(
        self,
        messages: List[Dict[str, str]],
        model: str = "sarvam-30b",
        temperature: float = 0.7,
        max_tokens: int = 1024,
        reasoning_effort: Optional[str] = None
    ):
        response = self.client.chat.completions(
            messages=messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            reasoning_effort=reasoning_effort
        )
        return response
