from sarvamai import SarvamAI


SUPPORTED_VIDEO_LANGUAGES = {
    "as-IN": "Assamese",
    "bn-IN": "Bengali",
    "brx-IN": "Bodo",
    "doi-IN": "Dogri",
    "en-IN": "English",
    "gu-IN": "Gujarati",
    "hi-IN": "Hindi",
    "kn-IN": "Kannada",
    "kok-IN": "Konkani",
    "ks-IN": "Kashmiri",
    "mai-IN": "Maithili",
    "ml-IN": "Malayalam",
    "mni-IN": "Manipuri",
    "mr-IN": "Marathi",
    "ne-IN": "Nepali",
    "od-IN": "Odia",
    "pa-IN": "Punjabi",
    "sa-IN": "Sanskrit",
    "sat-IN": "Santali",
    "sd-IN": "Sindhi",
    "ta-IN": "Tamil",
    "te-IN": "Telugu",
    "ur-IN": "Urdu",
}

VIDEO_FONT_BY_LANGUAGE = {
    "as-IN": "Noto Sans Bengali",
    "bn-IN": "Noto Sans Bengali",
    "brx-IN": "Noto Sans Devanagari",
    "doi-IN": "Noto Sans Devanagari",
    "gu-IN": "Noto Sans Gujarati",
    "hi-IN": "Noto Sans Devanagari",
    "kn-IN": "Noto Sans Kannada",
    "kok-IN": "Noto Sans Devanagari",
    "ks-IN": "Noto Sans Arabic",
    "mai-IN": "Noto Sans Devanagari",
    "ml-IN": "Noto Sans Malayalam",
    "mni-IN": "Noto Sans Bengali",
    "mr-IN": "Noto Sans Devanagari",
    "ne-IN": "Noto Sans Devanagari",
    "od-IN": "Noto Sans Oriya",
    "pa-IN": "Noto Sans Gurmukhi",
    "sa-IN": "Noto Sans Devanagari",
    "sat-IN": "Noto Sans Ol Chiki",
    "sd-IN": "Noto Sans Arabic",
    "ta-IN": "Noto Sans Tamil",
    "te-IN": "Noto Sans Telugu",
    "ur-IN": "Noto Nastaliq Urdu",
}

RTL_LANGUAGES = {"ks-IN", "sd-IN", "ur-IN"}


class TranslationAgent:
    def __init__(self, api_key: str | None):
        self.client = SarvamAI(api_subscription_key=api_key)

    def translate(
        self,
        text: str,
        target_language_code: str,
        source_language_code: str | None = None,
    ) -> str:
        if not text or target_language_code == "en-IN":
            return text
        if target_language_code not in SUPPORTED_VIDEO_LANGUAGES:
            raise ValueError(f"Unsupported language code: {target_language_code}")

        if source_language_code is None:
            detected = self.client.text.identify_language(input=text)
            source_language_code = detected.language_code or "en-IN"
        if source_language_code == target_language_code:
            return text

        response = self.client.text.translate(
            input=text,
            source_language_code=source_language_code,
            target_language_code=target_language_code,
            mode="formal",
            model="sarvam-translate:v1",
            numerals_format="international",
        )
        return response.translated_text

    def translate_video_copy(
        self,
        *,
        title: str,
        category: str,
        description: str,
        date: str,
        target_language_code: str,
    ) -> dict:
        source_copy = {
            "title": title,
            "category": category.title(),
            "description": description or "Everyday household expense",
            "date": date,
            "brand_line": "HisabVani",
            "expense_captured": "Expense captured",
            "spend_heading": "A clear look at the spend",
            "description_label": "What it was for",
            "summary_kicker": "Logged. Understood. Remembered.",
            "summary_title": "Every rupee tells your family story.",
            "summary_subtitle": "Voice and vision finance for Indian households",
        }
        translated = {}
        for key, value in source_copy.items():
            translated[key] = self.translate(
                value,
                target_language_code,
                None if key == "description" else "en-IN",
            )
        translated.update(
            {
                "language_code": target_language_code,
                "language_name": SUPPORTED_VIDEO_LANGUAGES[target_language_code],
                "font_family": VIDEO_FONT_BY_LANGUAGE.get(
                    target_language_code,
                    "Work Sans",
                ),
                "direction": (
                    "rtl" if target_language_code in RTL_LANGUAGES else "ltr"
                ),
            }
        )
        return translated
