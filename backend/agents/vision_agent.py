from sarvamai import SarvamAI
from typing import Union, IO
import tempfile
import os
import zipfile


class VisionAgent:
    def __init__(self, api_key: str):
        self.client = SarvamAI(api_subscription_key=api_key)

    def extract_document(
        self,
        file_data: Union[bytes, IO[bytes]],
        filename: str,
        language: str = "hi-IN",
        output_format: str = "md"
    ) -> str:
        job = self.client.document_intelligence.create_job(
            language=language,
            output_format=output_format
        )

        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as tmp:
            if isinstance(file_data, bytes):
                tmp.write(file_data)
            else:
                tmp.write(file_data.read())
            tmp_path = tmp.name

        try:
            job.upload_file(tmp_path)
            job.start()
            job.wait_until_complete()

            with tempfile.TemporaryDirectory() as tmpdir:
                output_file = os.path.join(tmpdir, "output.zip")
                job.download_output(output_file)

                # Extract the ZIP file
                with zipfile.ZipFile(output_file, 'r') as zip_ref:
                    zip_ref.extractall(tmpdir)

                # Look for the output file
                if output_format == "md":
                    md_file = os.path.join(tmpdir, "output.md")
                    if not os.path.exists(md_file):
                        # Try looking in subdirectories
                        for root, dirs, files in os.walk(tmpdir):
                            for file in files:
                                if file.endswith('.md'):
                                    md_file = os.path.join(root, file)
                                    break
                    
                    if os.path.exists(md_file):
                        with open(md_file, 'r', encoding='utf-8') as f:
                            return f.read()
                else:
                    html_file = os.path.join(tmpdir, "output.html")
                    if not os.path.exists(html_file):
                        # Try looking in subdirectories
                        for root, dirs, files in os.walk(tmpdir):
                            for file in files:
                                if file.endswith('.html'):
                                    html_file = os.path.join(root, file)
                                    break
                    
                    if os.path.exists(html_file):
                        with open(html_file, 'r', encoding='utf-8') as f:
                            return f.read()

                return ""
        finally:
            os.unlink(tmp_path)
