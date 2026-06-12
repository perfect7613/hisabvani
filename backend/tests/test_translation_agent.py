from types import SimpleNamespace

from backend.agents.translation_agent import TranslationAgent


class FakeTextClient:
    def __init__(self):
        self.translate_calls = []

    def identify_language(self, **_kwargs):
        return SimpleNamespace(language_code="en-IN")

    def translate(self, **kwargs):
        self.translate_calls.append(kwargs)
        return SimpleNamespace(translated_text="जून का बिजली बिल")


def test_translate_detects_source_and_uses_supported_v1_options():
    agent = TranslationAgent(api_key="test")
    text_client = FakeTextClient()
    agent.client = SimpleNamespace(text=text_client)

    result = agent.translate("June electricity bill", "hi-IN")

    assert result == "जून का बिजली बिल"
    assert text_client.translate_calls == [
        {
            "input": "June electricity bill",
            "source_language_code": "en-IN",
            "target_language_code": "hi-IN",
            "mode": "formal",
            "model": "sarvam-translate:v1",
            "numerals_format": "international",
        }
    ]


def test_translate_skips_api_when_text_is_already_in_target_language():
    agent = TranslationAgent(api_key="test")
    text_client = FakeTextClient()
    text_client.identify_language = lambda **_kwargs: SimpleNamespace(
        language_code="hi-IN"
    )
    agent.client = SimpleNamespace(text=text_client)

    result = agent.translate("जून का बिजली बिल", "hi-IN")

    assert result == "जून का बिजली बिल"
    assert text_client.translate_calls == []
