from types import SimpleNamespace
import time

from fastapi.testclient import TestClient

from backend.agents.video_agent import VideoRenderResult
from backend.main import app
import backend.routes_video as video_routes


class FakeLLMAgent:
    def chat(self, **_kwargs):
        message = SimpleNamespace(content="A Clear Family Spend")
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


class FakeVideoAgent:
    def render_expense_video(self, _expense_data):
        return VideoRenderResult(
            content=b"\x00\x00\x00\x18ftypmp42" + (b"video" * 30_000),
            audio_metadata={
                "provider": "heygen",
                "music": {"name": "Warm Ledger"},
                "sound_effect": {"name": "Paper Whoosh"},
            },
        )


class FakeTranslationAgent:
    def translate_video_copy(self, **kwargs):
        return {
            "title": "परिवार का साफ़ खर्च",
            "category": "उपयोगिताएँ",
            "description": "जून का बिजली बिल",
            "date": "आज",
            "brand_line": "हिसाबवाणी",
            "expense_captured": "खर्च दर्ज हुआ",
            "spend_heading": "खर्च पर साफ़ नज़र",
            "description_label": "यह खर्च किस लिए था",
            "summary_kicker": "दर्ज। समझा। याद रखा।",
            "summary_title": "हर रुपया आपके परिवार की कहानी कहता है।",
            "summary_subtitle": "भारतीय परिवारों के लिए आवाज़ और विज़न वित्त",
            "language_code": kwargs["target_language_code"],
            "language_name": "Hindi",
            "font_family": "Noto Sans Devanagari",
            "direction": "ltr",
        }


def test_generate_video_returns_stable_stream_url(tmp_path, monkeypatch):
    monkeypatch.setattr(video_routes, "VIDEO_OUTPUT_DIR", tmp_path)
    monkeypatch.setattr(video_routes, "llm_agent", FakeLLMAgent())
    monkeypatch.setattr(
        video_routes,
        "translation_agent",
        FakeTranslationAgent(),
    )
    monkeypatch.setattr(video_routes, "video_agent", FakeVideoAgent())

    client = TestClient(app)
    response = client.post(
        "/api/generate-video",
        json={
            "amount": 2450,
            "category": "utilities",
            "description": "June electricity bill",
            "language_code": "hi-IN",
        },
    )

    assert response.status_code == 202
    created = response.json()
    assert created["status"] == "queued"

    payload = None
    for _attempt in range(100):
        job_response = client.get(created["status_url"])
        assert job_response.status_code == 200
        job = job_response.json()
        if job["status"] == "completed":
            payload = job["result"]
            break
        assert job["status"] in {"queued", "rendering"}
        time.sleep(0.01)

    assert payload is not None
    assert payload["video_url"].startswith("/api/videos/")
    assert payload["audio_provider"] == "heygen"
    assert payload["music_name"] == "Warm Ledger"
    assert payload["language_code"] == "hi-IN"
    assert payload["language_name"] == "Hindi"
    assert payload["title"] == "परिवार का साफ़ खर्च"

    video_response = client.get(payload["video_url"])
    assert video_response.status_code == 200
    assert video_response.headers["content-type"] == "video/mp4"
    assert "inline" in video_response.headers["content-disposition"]
    assert b"ftypmp42" in video_response.content[:32]


def test_missing_video_returns_404(tmp_path, monkeypatch):
    monkeypatch.setattr(video_routes, "VIDEO_OUTPUT_DIR", tmp_path)
    response = TestClient(app).get("/api/videos/notfound")
    assert response.status_code == 404
