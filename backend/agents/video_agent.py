import html
import json
import logging
import os
import time
from dataclasses import dataclass
from pathlib import Path
from string import Template

import httpx
from daytona import (
    CreateSandboxFromImageParams,
    Daytona,
    DaytonaConfig,
    Image,
    Resources,
)


HYPERFRAMES_VERSION = "0.6.91"
PROJECT_ROOT = "/home/daytona/expense-video"
OUTPUT_PATH = f"{PROJECT_ROOT}/output.mp4"
TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "video_templates"
logger = logging.getLogger(__name__)


@dataclass
class VideoRenderResult:
    content: bytes
    audio_metadata: dict


class VideoAgent:
    def __init__(
        self,
        api_key: str | None,
        api_url: str = "https://app.daytona.io/api",
        heygen_api_key: str | None = None,
    ):
        config = DaytonaConfig(api_key=api_key, api_url=api_url)
        self.daytona = Daytona(config)
        self.heygen_api_key = heygen_api_key or os.getenv("HEYGEN_API_KEY")

    def _sandbox_image(self) -> Image:
        return (
            Image.base("node:22-bookworm")
            .run_commands(
                "test -x /usr/bin/bash || ln -s /bin/bash /usr/bin/bash",
                (
                    "apt-get update && DEBIAN_FRONTEND=noninteractive "
                    "apt-get install -y --no-install-recommends "
                    "ca-certificates chromium curl ffmpeg fonts-dejavu-core "
                    "fonts-liberation fonts-noto-core fonts-noto-extra "
                    "&& rm -rf /var/lib/apt/lists/*"
                ),
            )
            .env(
                {
                    "HYPERFRAMES_BROWSER_PATH": "/usr/bin/chromium",
                    "PUPPETEER_EXECUTABLE_PATH": "/usr/bin/chromium",
                }
            )
            .workdir("/home/daytona")
        )

    def _render_html(self, expense_data: dict) -> str:
        title = html.escape(str(expense_data.get("title") or "Expense Report"))
        category = html.escape(str(expense_data.get("category") or "Other").title())
        raw_description = str(
            expense_data.get("description") or "Everyday household expense"
        )
        if len(raw_description) > 90:
            raw_description = f"{raw_description[:87].rstrip()}..."
        description = html.escape(raw_description)
        date = html.escape(str(expense_data.get("date") or "Today"))
        font_family = html.escape(
            str(expense_data.get("font_family") or "Work Sans"),
            quote=True,
        )
        direction = (
            "rtl" if expense_data.get("direction") == "rtl" else "ltr"
        )
        language_code = html.escape(
            str(expense_data.get("language_code") or "en-IN"),
            quote=True,
        )
        amount = float(expense_data.get("amount") or 0)

        template = Template(
            (TEMPLATE_DIR / "expense_report.html").read_text(encoding="utf-8")
        )
        return template.substitute(
            title=title,
            category=category,
            description=description,
            date=date,
            amount=f"₹{amount:,.0f}",
            font_family=font_family,
            direction=direction,
            language_code=language_code,
            brand_line=html.escape(
                str(expense_data.get("brand_line") or "HisabVani")
            ),
            expense_captured=html.escape(
                str(expense_data.get("expense_captured") or "Expense captured")
            ),
            spend_heading=html.escape(
                str(
                    expense_data.get("spend_heading")
                    or "A clear look at the spend"
                )
            ),
            description_label=html.escape(
                str(
                    expense_data.get("description_label")
                    or "What it was for"
                )
            ),
            summary_kicker=html.escape(
                str(
                    expense_data.get("summary_kicker")
                    or "Logged. Understood. Remembered."
                )
            ),
            summary_title=html.escape(
                str(
                    expense_data.get("summary_title")
                    or "Every rupee tells your family story."
                )
            ),
            summary_subtitle=html.escape(
                str(
                    expense_data.get("summary_subtitle")
                    or "Voice and vision finance for Indian households"
                )
            ),
        )

    def _search_heygen_audio(self, category: str) -> dict:
        searches = {
            "music": (
                "warm optimistic Indian household finance, gentle acoustic "
                "percussion, modern, instrumental, no vocals"
            ),
            "sound_effects": (
                "soft paper receipt whoosh and subtle cash chime "
                f"for a {category} expense"
            ),
        }
        selected = {}

        with httpx.Client(timeout=30) as client:
            for audio_type, query in searches.items():
                last_error = None
                for attempt in range(3):
                    try:
                        response = client.get(
                            "https://api.heygen.com/v3/audio/sounds",
                            params={
                                "query": query,
                                "type": audio_type,
                                "limit": 5,
                                "min_score": 0.5,
                            },
                            headers={
                                "accept": "application/json",
                                "x-api-key": self.heygen_api_key,
                            },
                        )
                        response.raise_for_status()
                        match = response.json().get("data", [])[0]
                        if not match.get("audio_url"):
                            raise RuntimeError(
                                f"HeyGen returned no {audio_type} result"
                            )
                        selected[
                            "sound_effect" if audio_type == "sound_effects" else "music"
                        ] = match
                        break
                    except (httpx.HTTPError, IndexError, RuntimeError) as error:
                        last_error = error
                        if attempt < 2:
                            time.sleep(0.6 * (2**attempt))
                else:
                    raise RuntimeError(
                        f"HeyGen {audio_type} search failed: {last_error}"
                    )

        return selected

    @staticmethod
    def _download_audio_assets(selection: dict) -> tuple[bytes, bytes]:
        with httpx.Client(timeout=120, follow_redirects=True) as client:
            music_response = client.get(selection["music"]["audio_url"])
            music_response.raise_for_status()
            sound_effect_response = client.get(
                selection["sound_effect"]["audio_url"]
            )
            sound_effect_response.raise_for_status()
        return music_response.content, sound_effect_response.content

    @staticmethod
    def _run(sandbox, command: str, *, cwd: str = PROJECT_ROOT, timeout: int = 300):
        started = time.monotonic()
        logger.info("Video render command started: %s", command)
        result = sandbox.process.exec(command, cwd=cwd, timeout=timeout)
        if result.exit_code != 0:
            output = (result.result or "").strip()
            raise RuntimeError(f"Command failed ({result.exit_code}): {command}\n{output}")
        logger.info(
            "Video render command finished in %.1fs: %s",
            time.monotonic() - started,
            command,
        )
        return result

    @staticmethod
    def _download_rendered_video(sandbox) -> bytes:
        last_error = None

        server_result = sandbox.process.exec(
            (
                "nohup python3 -m http.server 8765 "
                f"--directory {PROJECT_ROOT} >/tmp/video-http.log 2>&1 &"
            ),
            timeout=10,
        )
        if server_result.exit_code != 0:
            raise RuntimeError(
                f"Could not start Daytona video transfer server: "
                f"{server_result.result}"
            )

        for attempt in range(1, 4):
            preview = None
            try:
                started = time.monotonic()
                logger.info(
                    "Downloading rendered MP4 from Daytona (attempt %s/3)",
                    attempt,
                )
                preview = sandbox.create_signed_preview_url(
                    8765,
                    expires_in_seconds=900,
                )
                with httpx.stream(
                    "GET",
                    f"{preview.url}/output.mp4",
                    follow_redirects=True,
                    timeout=httpx.Timeout(600, connect=30),
                ) as response:
                    response.raise_for_status()
                    content = bytearray()
                    for chunk in response.iter_bytes(64 * 1024):
                        content.extend(chunk)
                video_bytes = bytes(content)
                if len(video_bytes) < 100_000 or b"ftyp" not in video_bytes[:64]:
                    raise RuntimeError("Downloaded MP4 is incomplete or invalid")
                logger.info(
                    "Downloaded %.1f MB from Daytona in %.1fs",
                    len(video_bytes) / 1_000_000,
                    time.monotonic() - started,
                )
                return video_bytes
            except Exception as error:
                last_error = error
                if attempt < 3:
                    time.sleep(1.5 * attempt)
            finally:
                if preview is not None:
                    try:
                        sandbox.expire_signed_preview_url(
                            8765,
                            preview.token,
                        )
                    except Exception:
                        logger.warning(
                            "Could not expire Daytona preview URL",
                            exc_info=True,
                        )

        raise RuntimeError(
            f"Rendered MP4 exists but could not be downloaded: {last_error}"
        )

    def render_expense_video(self, expense_data: dict) -> VideoRenderResult:
        if not self.heygen_api_key:
            raise RuntimeError("HEYGEN_API_KEY is required to add HeyGen catalog audio")

        params = CreateSandboxFromImageParams(
            image=self._sandbox_image(),
            language="typescript",
            resources=Resources(
                cpu=int(os.getenv("DAYTONA_VIDEO_CPUS", "2")),
                memory=int(os.getenv("DAYTONA_VIDEO_MEMORY_GB", "4")),
                disk=int(os.getenv("DAYTONA_VIDEO_DISK_GB", "10")),
            ),
            env_vars={"HEYGEN_API_KEY": self.heygen_api_key},
            ephemeral=True,
            labels={"purpose": "hisabvani-hyperframes-render"},
        )
        sandbox = self.daytona.create(params, timeout=300)
        render_complete = False
        download_complete = False

        try:
            self._run(
                sandbox,
                (
                    f"npx --yes hyperframes@{HYPERFRAMES_VERSION} "
                    "init expense-video --non-interactive"
                ),
                cwd="/home/daytona",
                timeout=300,
            )
            self._run(
                sandbox,
                f"npx --yes hyperframes@{HYPERFRAMES_VERSION} add grain-overlay",
                timeout=300,
            )
            self._run(
                sandbox,
                (
                    "npm install --no-save gsap@3.14.2 && "
                    "cp node_modules/gsap/dist/gsap.min.js gsap.min.js"
                ),
                timeout=300,
            )

            sandbox.fs.upload_file_stream(
                self._render_html(expense_data).encode("utf-8"),
                f"{PROJECT_ROOT}/index.html",
            )
            sandbox.fs.upload_file_stream(
                (TEMPLATE_DIR / "DESIGN.md").read_bytes(),
                f"{PROJECT_ROOT}/DESIGN.md",
            )
            sandbox.fs.upload_file_stream(
                (TEMPLATE_DIR / "fetch_audio.mjs").read_bytes(),
                f"{PROJECT_ROOT}/fetch_audio.mjs",
            )

            category = str(expense_data.get("category") or "household")
            audio_result = sandbox.process.exec(
                "node fetch_audio.mjs",
                cwd=PROJECT_ROOT,
                env={
                    "HEYGEN_API_KEY": self.heygen_api_key,
                    "NODE_OPTIONS": "--dns-result-order=ipv4first",
                    "HEYGEN_MUSIC_QUERY": (
                        "warm optimistic Indian household finance, gentle acoustic "
                        "percussion, modern, instrumental, no vocals"
                    ),
                    "HEYGEN_SFX_QUERY": (
                        "soft paper receipt whoosh and subtle cash chime "
                        f"for a {category} expense"
                    ),
                },
                timeout=120,
            )
            if audio_result.exit_code != 0:
                selection = self._search_heygen_audio(category)
                sandbox.fs.upload_file_stream(
                    json.dumps(selection).encode("utf-8"),
                    f"{PROJECT_ROOT}/audio-selection.json",
                )
                retry_result = sandbox.process.exec(
                    "node fetch_audio.mjs",
                    cwd=PROJECT_ROOT,
                    env={
                        "HEYGEN_API_KEY": self.heygen_api_key,
                        "NODE_OPTIONS": "--dns-result-order=ipv4first",
                    },
                    timeout=120,
                )
                if retry_result.exit_code != 0:
                    music_bytes, sound_effect_bytes = self._download_audio_assets(
                        selection
                    )
                    sandbox.fs.upload_file_stream(
                        music_bytes,
                        f"{PROJECT_ROOT}/music-source",
                    )
                    sandbox.fs.upload_file_stream(
                        sound_effect_bytes,
                        f"{PROJECT_ROOT}/transition-source",
                    )
                    sandbox.fs.upload_file_stream(
                        json.dumps(
                            {
                                "provider": "heygen",
                                "music": {
                                    key: selection["music"].get(key)
                                    for key in ("id", "name", "description")
                                },
                                "sound_effect": {
                                    key: selection["sound_effect"].get(key)
                                    for key in ("id", "name", "description")
                                },
                            }
                        ).encode("utf-8"),
                        f"{PROJECT_ROOT}/audio-metadata.json",
                    )

            self._run(
                sandbox,
                (
                    "ffmpeg -y -stream_loop -1 -i music-source -t 12 "
                    '-af "volume=0.34,afade=t=in:st=0:d=0.8,'
                    'afade=t=out:st=10.7:d=1.3" '
                    "-c:a aac -b:a 192k background.m4a && "
                    "ffmpeg -y -i transition-source -t 1.2 "
                    '-af "volume=0.72,afade=t=in:st=0:d=0.04,'
                    'afade=t=out:st=0.9:d=0.3" '
                    "-c:a aac -b:a 192k transition.m4a"
                ),
                timeout=180,
            )

            self._run(
                sandbox,
                f"npx --yes hyperframes@{HYPERFRAMES_VERSION} lint .",
                timeout=180,
            )
            self._run(
                sandbox,
                f"npx --yes hyperframes@{HYPERFRAMES_VERSION} validate .",
                timeout=240,
            )
            self._run(
                sandbox,
                f"npx --yes hyperframes@{HYPERFRAMES_VERSION} inspect . --samples 10",
                timeout=300,
            )
            self._run(
                sandbox,
                (
                    f"npx --yes hyperframes@{HYPERFRAMES_VERSION} render . "
                    f"--output {OUTPUT_PATH} --quality standard --fps 30 "
                    "--workers 1 --strict"
                ),
                timeout=900,
            )

            probe = self._run(
                sandbox,
                (
                    "ffprobe -v error -show_entries "
                    f"format=duration:stream=codec_type -of json {OUTPUT_PATH}"
                ),
                timeout=60,
            )
            probe_data = json.loads(probe.result)
            duration = float(probe_data["format"]["duration"])
            stream_types = {
                stream["codec_type"] for stream in probe_data.get("streams", [])
            }
            if duration < 11.5 or not {"video", "audio"}.issubset(stream_types):
                raise RuntimeError(
                    f"Rendered MP4 failed validation: duration={duration}, "
                    f"streams={stream_types}"
                )
            render_complete = True

            video_bytes = self._download_rendered_video(sandbox)
            audio_metadata = json.loads(
                sandbox.fs.download_file(
                    f"{PROJECT_ROOT}/audio-metadata.json"
                ).decode("utf-8")
            )
            download_complete = True
            return VideoRenderResult(
                content=video_bytes,
                audio_metadata=audio_metadata,
            )
        finally:
            if not render_complete or download_complete:
                sandbox.delete()
            else:
                logger.error(
                    "Preserving Daytona sandbox %s because the render completed "
                    "but the MP4 download failed",
                    sandbox.id,
                )
