from sarvamai import SarvamAI
from typing import Union, IO


class SpeechAgent:
    def __init__(self, api_key: str):
        self.client = SarvamAI(api_subscription_key=api_key)

    def transcribe(
        self,
        audio_data: Union[bytes, IO[bytes]],
        model: str = "saaras:v3",
        mode: str = "codemix",
        language_code: str = "unknown"
    ):
        response = self.client.speech_to_text.transcribe(
            file=audio_data,
            model=model,
            mode=mode,
            language_code=language_code
        )
        return response
