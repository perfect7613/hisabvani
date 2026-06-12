from daytona import Daytona, DaytonaConfig
from typing import Optional


class ComputeAgent:
    def __init__(self, api_key: str, api_url: str = "https://app.daytona.io/api"):
        config = DaytonaConfig(
            api_key=api_key,
            api_url=api_url
        )
        self.daytona = Daytona(config)
        self.sandbox = None

    def ensure_sandbox(self):
        if self.sandbox is None:
            self.sandbox = self.daytona.create()
        return self.sandbox

    def execute_code(self, code: str, timeout: int = 300) -> dict:
        sandbox = self.ensure_sandbox()

        result = sandbox.code_interpreter.run_code(
            code=code,
            timeout=timeout
        )

        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "error": result.error.model_dump() if result.error else None,
            "success": result.error is None
        }

    def cleanup(self):
        if self.sandbox:
            try:
                self.daytona.delete(self.sandbox.id)
            except Exception:
                pass
            self.sandbox = None
