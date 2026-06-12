import json
import os
import base64
from daytona import Daytona, DaytonaConfig


class VideoAgent:
    def __init__(self, api_key: str, api_url: str = "https://app.daytona.io/api"):
        config = DaytonaConfig(api_key=api_key, api_url=api_url)
        self.daytona = Daytona(config)

    def render_expense_video(self, expense_data: dict) -> bytes:
        sandbox = self.daytona.create()
        try:
            title = expense_data.get("title", "Expense Report")
            amount = expense_data.get("amount", 0)
            category = expense_data.get("category", "other")
            description = expense_data.get("description", "")
            date = expense_data.get("date", "Today")

            # Write text to files to avoid FFmpeg escaping issues
            sandbox.fs.upload_file_stream(title.encode(), "/home/daytona/title.txt")
            sandbox.fs.upload_file_stream(f"Rs.{int(amount)}".encode(), "/home/daytona/amount.txt")
            sandbox.fs.upload_file_stream(category.encode(), "/home/daytona/category.txt")
            sandbox.fs.upload_file_stream(description.encode(), "/home/daytona/description.txt")
            sandbox.fs.upload_file_stream(date.encode(), "/home/daytona/date.txt")

            script = '''#!/bin/bash
ffmpeg -y -f lavfi -i "color=c=0x1a1a2e:s=1280x720:d=5" \\
  -vf "drawtext=textfile=/home/daytona/title.txt:fontsize=48:fontcolor=white:x=(w-text_w)/2:y=180:enable='between(t,0.3,5)',\\
drawtext=textfile=/home/daytona/amount.txt:fontsize=80:fontcolor=0xf59e0b:x=(w-text_w)/2:y=300:enable='between(t,0.8,5)',\\
drawtext=textfile=/home/daytona/category.txt:fontsize=36:fontcolor=0x94a3b8:x=(w-text_w)/2:y=420:enable='between(t,1.2,5)',\\
drawtext=textfile=/home/daytona/description.txt:fontsize=28:fontcolor=0xcbd5e1:x=(w-text_w)/2:y=500:enable='between(t,1.5,5)',\\
drawtext=textfile=/home/daytona/date.txt:fontsize=24:fontcolor=0x64748b:x=(w-text_w)/2:y=600:enable='between(t,1.8,5)'" \\
  -c:v libx264 -pix_fmt yuv420p -r 30 /home/daytona/output.mp4
'''
            sandbox.fs.upload_file_stream(script.encode(), "/home/daytona/render.sh")
            sandbox.process.exec("chmod +x /home/daytona/render.sh")

            result = sandbox.process.exec("bash /home/daytona/render.sh 2>&1", timeout=120)
            if result.exit_code != 0:
                raise RuntimeError(f"Render failed: {result.result}")

            check = sandbox.process.exec("ls -la /home/daytona/output.mp4")
            if check.exit_code != 0:
                raise RuntimeError("Output file not found")

            return sandbox.fs.download_file("/home/daytona/output.mp4")
        finally:
            sandbox.delete()
