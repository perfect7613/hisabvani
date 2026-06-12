import pytest
from fastapi.testclient import TestClient
from backend.main import app
import os
import wave
import io
from types import SimpleNamespace

import backend.routes as voice_routes


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def sample_audio_wav():
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(16000)
        wav_file.writeframes(b'\x00\x00' * 16000)
    buffer.seek(0)
    return buffer.getvalue()


def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "HisabVani API is running"}


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert response.json()["service"] == "hisabvani-api"


def test_voice_query_missing_audio(client):
    response = client.post("/api/voice-query")
    assert response.status_code == 422


class FakeSpeechAgent:
    def transcribe(self, **_kwargs):
        return SimpleNamespace(
            transcript="Where did we spend the most?",
            language_code="en-IN",
        )


class EmptyThenValidLLMAgent:
    def __init__(self):
        self.calls = []

    def chat(self, **kwargs):
        self.calls.append(kwargs)
        if len(self.calls) == 1:
            return SimpleNamespace(
                choices=[
                    SimpleNamespace(
                        message=SimpleNamespace(content=None, refusal=None),
                        finish_reason="length",
                    )
                ]
            )
        return SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(
                        content="Groceries were the largest saved expense.",
                        refusal=None,
                    ),
                    finish_reason="stop",
                )
            ]
        )


class EmptyLLMAgent:
    def chat(self, **_kwargs):
        return SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(content=None, refusal=None),
                    finish_reason="length",
                )
            ]
        )


def test_voice_query_retries_when_high_reasoning_has_no_content(
    client,
    sample_audio_wav,
    monkeypatch,
):
    agent = EmptyThenValidLLMAgent()
    monkeypatch.setattr(voice_routes, "speech_agent", FakeSpeechAgent())
    monkeypatch.setattr(voice_routes, "llm_agent", agent)

    response = client.post(
        "/api/voice-query",
        files={"audio": ("test.wav", sample_audio_wav, "audio/wav")},
        data={
            "household_context": (
                '{"transactions":[{"amount":850,"category":"groceries"}]}'
            )
        },
    )

    assert response.status_code == 200
    assert response.json()["response"] == (
        "Groceries were the largest saved expense."
    )
    assert len(agent.calls) == 2
    assert agent.calls[0]["reasoning_effort"] == "high"
    assert agent.calls[0]["max_tokens"] == 2400
    assert agent.calls[1]["reasoning_effort"] == "low"


def test_voice_query_returns_string_fallback_after_empty_retry(
    client,
    sample_audio_wav,
    monkeypatch,
):
    monkeypatch.setattr(voice_routes, "speech_agent", FakeSpeechAgent())
    monkeypatch.setattr(voice_routes, "llm_agent", EmptyLLMAgent())

    response = client.post(
        "/api/voice-query",
        files={"audio": ("test.wav", sample_audio_wav, "audio/wav")},
        data={
            "household_context": (
                '{"transactions":[{"amount":850,"category":"groceries"}]}'
            )
        },
    )

    assert response.status_code == 200
    assert isinstance(response.json()["response"], str)
    assert "1 transaction" in response.json()["response"]


def test_voice_query_with_real_audio(client, sample_audio_wav):
    sarvam_key = os.getenv("SARVAM_API_KEY")
    if not sarvam_key:
        pytest.skip("SARVAM_API_KEY not set")

    response = client.post(
        "/api/voice-query",
        files={"audio": ("test.wav", sample_audio_wav, "audio/wav")}
    )

    assert response.status_code == 200
    data = response.json()
    assert "transcript" in data
    assert "response" in data
    assert "language_code" in data
    assert isinstance(data["transcript"], str)
    assert isinstance(data["response"], str)
    assert isinstance(data["language_code"], str)


def test_speech_agent_direct():
    sarvam_key = os.getenv("SARVAM_API_KEY")
    if not sarvam_key:
        pytest.skip("SARVAM_API_KEY not set")

    from backend.agents.speech_agent import SpeechAgent
    agent = SpeechAgent(api_key=sarvam_key)

    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(16000)
        wav_file.writeframes(b'\x00\x00' * 16000)
    buffer.seek(0)

    result = agent.transcribe(
        audio_data=buffer.getvalue(),
        model="saaras:v3",
        mode="codemix",
        language_code="unknown"
    )

    assert hasattr(result, 'transcript')
    assert hasattr(result, 'language_code')
    assert isinstance(result.transcript, str)


def test_llm_agent_direct():
    sarvam_key = os.getenv("SARVAM_API_KEY")
    if not sarvam_key:
        pytest.skip("SARVAM_API_KEY not set")

    from backend.agents.llm_agent import LLMAgent
    agent = LLMAgent(api_key=sarvam_key)

    result = agent.chat(
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Say hello in Hindi"}
        ],
        model="sarvam-30b",
        temperature=0.7,
        max_tokens=500,
        reasoning_effort=None
    )

    assert hasattr(result, 'choices')
    assert len(result.choices) > 0
    assert hasattr(result.choices[0], 'message')
    assert hasattr(result.choices[0].message, 'content')
    assert isinstance(result.choices[0].message.content, str)
    assert len(result.choices[0].message.content) > 0
