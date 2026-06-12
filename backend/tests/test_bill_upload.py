import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.models.database import Database, Transaction
import os
import tempfile


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def temp_db():
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        db_path = f.name
    db = Database(db_path=db_path)
    yield db
    os.unlink(db_path)


@pytest.fixture
def sample_bill_image():
    from PIL import Image
    import io

    img = Image.new('RGB', (800, 600), color='white')
    from PIL import ImageDraw
    draw = ImageDraw.Draw(img)
    draw.text((50, 50), "SCHOOL FEE RECEIPT", fill='black')
    draw.text((50, 100), "Date: 15-06-2026", fill='black')
    draw.text((50, 150), "Amount: Rs. 15,000", fill='black')
    draw.text((50, 200), "Student: John Doe", fill='black')
    draw.text((50, 250), "School: Delhi Public School", fill='black')

    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    return buffer.getvalue()


def test_upload_bill_missing_file(client):
    response = client.post("/api/upload-bill")
    assert response.status_code == 422


def test_upload_bill_with_real_image(client, sample_bill_image):
    sarvam_key = os.getenv("SARVAM_API_KEY")
    if not sarvam_key:
        pytest.skip("SARVAM_API_KEY not set")

    response = client.post(
        "/api/upload-bill",
        files={"file": ("receipt.png", sample_bill_image, "image/png")}
    )

    assert response.status_code == 200
    data = response.json()
    assert "record_id" in data
    assert "extracted_text" in data
    assert "transaction" in data
    assert isinstance(data["record_id"], str)
    assert isinstance(data["extracted_text"], str)


def test_database_add_transaction(temp_db):
    transaction = Transaction(
        date="2026-06-15",
        amount=15000.0,
        category="education",
        vendor="Delhi Public School",
        description="School fee receipt",
        source_document="uploaded"
    )

    transaction_id = temp_db.add_transaction(transaction)
    assert transaction_id > 0

    transactions = temp_db.get_transactions()
    assert len(transactions) == 1
    assert transactions[0].amount == 15000.0
    assert transactions[0].category == "education"


def test_database_get_total_expenses(temp_db):
    temp_db.add_transaction(Transaction(
        date="2026-06-15",
        amount=15000.0,
        category="education",
        vendor="School",
        description="Fee"
    ))
    temp_db.add_transaction(Transaction(
        date="2026-06-16",
        amount=8000.0,
        category="medical",
        vendor="Hospital",
        description="Checkup"
    ))

    total = temp_db.get_total_expenses()
    assert total == 23000.0


def test_database_get_expenses_by_category(temp_db):
    temp_db.add_transaction(Transaction(
        date="2026-06-15",
        amount=15000.0,
        category="education",
        vendor="School",
        description="Fee"
    ))
    temp_db.add_transaction(Transaction(
        date="2026-06-16",
        amount=8000.0,
        category="medical",
        vendor="Hospital",
        description="Checkup"
    ))
    temp_db.add_transaction(Transaction(
        date="2026-06-17",
        amount=5000.0,
        category="education",
        vendor="Tuition",
        description="Classes"
    ))

    by_category = temp_db.get_expenses_by_category()
    assert "education" in by_category
    assert "medical" in by_category
    assert by_category["education"] == 20000.0
    assert by_category["medical"] == 8000.0


def test_vision_agent_direct():
    sarvam_key = os.getenv("SARVAM_API_KEY")
    if not sarvam_key:
        pytest.skip("SARVAM_API_KEY not set")

    from backend.agents.vision_agent import VisionAgent
    agent = VisionAgent(api_key=sarvam_key)

    from PIL import Image
    import io

    img = Image.new('RGB', (800, 600), color='white')
    from PIL import ImageDraw
    draw = ImageDraw.Draw(img)
    draw.text((50, 50), "MEDICAL BILL", fill='black')
    draw.text((50, 100), "Date: 20-06-2026", fill='black')
    draw.text((50, 150), "Amount: Rs. 8,500", fill='black')

    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)

    result = agent.extract_document(
        file_data=buffer.getvalue(),
        filename="bill.png",
        language="hi-IN",
        output_format="md"
    )

    assert isinstance(result, str)


def test_parse_markdown_to_transaction():
    from backend.routes_bills import parse_markdown_to_transaction

    markdown = """
    SCHOOL FEE RECEIPT
    Date: 15-06-2026
    Amount: Rs. 15,000
    Student: John Doe
    School: Delhi Public School
    """

    transaction = parse_markdown_to_transaction(markdown)
    assert transaction.category == "education"
    assert transaction.amount == 15000.0
    assert "school" in transaction.vendor.lower() or "delhi" in transaction.vendor.lower()
