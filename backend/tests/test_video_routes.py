from types import SimpleNamespace
import time

from fastapi.testclient import TestClient

from backend.agents.video_agent import VideoRenderResult
from backend.main import app
import backend.routes_video as video_routes


class FakeLLMAgent:
    def chat(self, **_kwargs):
        message = SimpleNamespace(content="""{
          "title": "A Clear Family Spend",
          "headline": "A focused look at June",
          "insight": "Utilities led the selected expenses.",
          "advice": "Review recurring bills before next month.",
          "conversation_summary": "The family asked where spending could improve."
        }""")
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


class EmptyThenValidLLMAgent:
    def __init__(self):
        self.calls = []

    def chat(self, **kwargs):
        self.calls.append(kwargs)
        if len(self.calls) == 1:
            return SimpleNamespace(
                choices=[
                    SimpleNamespace(
                        message=SimpleNamespace(content=None),
                        finish_reason="length",
                    )
                ]
            )
        return FakeLLMAgent().chat()


class EmptyLLMAgent:
    def chat(self, **_kwargs):
        return SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(content=None),
                    finish_reason="length",
                )
            ]
        )


class FakeVideoAgent:
    def render_report_video(self, _expense_data):
        return VideoRenderResult(
            content=b"\x00\x00\x00\x18ftypmp42" + (b"video" * 30_000),
            audio_metadata={
                "provider": "heygen",
                "music": {"name": "Warm Ledger"},
                "sound_effect": {"name": "Paper Whoosh"},
            },
        )


class FakeTranslationAgent:
    def translate_report_copy(self, **kwargs):
        return {
            "title": "परिवार का साफ़ खर्च",
            "headline": "जून के खर्च पर साफ़ नज़र",
            "insight": "उपयोगिताएँ सबसे बड़ी श्रेणी थीं",
            "advice": "अगले महीने से पहले बिलों की समीक्षा करें",
            "conversation_summary": "परिवार ने बचत के बारे में पूछा",
            "transactions": kwargs["transactions"],
            "brand_line": "हिसाबवाणी",
            "report_kicker": "घर का खर्च रिपोर्ट",
            "ledger_heading": "परिवार ने क्या दर्ज किया",
            "total_label": "कुल दर्ज",
            "advice_kicker": "सार्वम 105B ने क्या समझा",
            "question_heading": "परिवार के सवाल",
            "transaction_label": "लेन-देन",
            "conversation_label": "बातचीत",
            "saved_conversations_label": "सहेजी गई बातचीत",
            "closing_kicker": "साफ़ महीना यहाँ से शुरू होता है",
            "closing_subtitle": "भारतीय परिवारों के लिए आवाज़, विज़न और रीजनिंग",
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
            "language_code": "hi-IN",
            "transactions": [
                {
                    "id": "bill-1",
                    "date": "2026-06-12",
                    "amount": 2450,
                    "category": "utilities",
                    "vendor": "Power company",
                    "description": "June electricity bill",
                    "source": "bill",
                },
                {
                    "id": "voice-1",
                    "date": "2026-06-11",
                    "amount": 500,
                    "category": "transport",
                    "vendor": "",
                    "description": "Petrol",
                    "source": "voice",
                },
            ],
            "conversations": [
                {
                    "id": "ask-1",
                    "question": "Where did we spend most?",
                    "answer": "Utilities were the largest selected category.",
                }
            ],
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
    assert payload["transaction_count"] == 2
    assert payload["conversation_count"] == 1
    assert payload["total_amount"] == 2950

    video_response = client.get(payload["video_url"])
    assert video_response.status_code == 200
    assert video_response.headers["content-type"] == "video/mp4"
    assert "inline" in video_response.headers["content-disposition"]
    assert b"ftypmp42" in video_response.content[:32]


def test_missing_video_returns_404(tmp_path, monkeypatch):
    monkeypatch.setattr(video_routes, "VIDEO_OUTPUT_DIR", tmp_path)
    response = TestClient(app).get("/api/videos/notfound")
    assert response.status_code == 404


def test_generate_video_requires_a_saved_transaction():
    response = TestClient(app).post(
        "/api/generate-video",
        json={"transactions": [], "language_code": "en-IN"},
    )
    assert response.status_code == 422


def test_generate_report_copy_retries_empty_high_reasoning_response(monkeypatch):
    agent = EmptyThenValidLLMAgent()
    monkeypatch.setattr(video_routes, "llm_agent", agent)

    report = video_routes.generate_report_copy(
        [
            video_routes.ReportTransaction(
                date="2026-06-12",
                amount=2450,
                category="utilities",
                description="June electricity bill",
            )
        ],
        [],
        None,
    )

    assert report["title"] == "A Clear Family Spend"
    assert len(agent.calls) == 2
    assert agent.calls[0]["reasoning_effort"] == "high"
    assert agent.calls[0]["max_tokens"] == 1800
    assert agent.calls[1]["reasoning_effort"] == "low"


def test_generate_report_copy_uses_fallback_when_sarvam_content_is_empty(
    monkeypatch,
):
    monkeypatch.setattr(video_routes, "llm_agent", EmptyLLMAgent())

    report = video_routes.generate_report_copy(
        [
            video_routes.ReportTransaction(
                date="2026-06-12",
                amount=2450,
                category="utilities",
                description="June electricity bill",
            )
        ],
        [],
        "June at Home",
    )

    assert report == {
        "title": "June at Home",
        "headline": "₹2,450 across 1 expense",
        "insight": "Utilities was the largest spending category.",
        "advice": "Review the largest category together before the next month begins.",
        "conversation_summary": "No financial questions were included in this report.",
    }
