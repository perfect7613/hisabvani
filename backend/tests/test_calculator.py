import pytest
from fastapi.testclient import TestClient
from backend.main import app
import os


@pytest.fixture
def client():
    return TestClient(app)


def test_calculate_missing_code(client):
    response = client.post("/api/calculate", json={})
    assert response.status_code == 422


def test_calculate_simple_code(client):
    daytona_key = os.getenv("DAYTONA_API_KEY")
    if not daytona_key:
        pytest.skip("DAYTONA_API_KEY not set")

    response = client.post(
        "/api/calculate",
        json={"code": "print('Hello from Daytona!')"}
    )

    assert response.status_code == 200
    data = response.json()
    assert "stdout" in data
    assert "stderr" in data
    assert "success" in data
    assert data["success"] is True
    assert "Hello from Daytona!" in data["stdout"]


def test_calculate_math(client):
    daytona_key = os.getenv("DAYTONA_API_KEY")
    if not daytona_key:
        pytest.skip("DAYTONA_API_KEY not set")

    code = """
import math
result = math.sqrt(144) + math.pi
print(f"Result: {result:.2f}")
"""

    response = client.post(
        "/api/calculate",
        json={"code": code}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "Result:" in data["stdout"]


def test_calculate_pandas(client):
    daytona_key = os.getenv("DAYTONA_API_KEY")
    if not daytona_key:
        pytest.skip("DAYTONA_API_KEY not set")

    code = """
import pandas as pd
import numpy as np

data = {
    'category': ['education', 'medical', 'education', 'rent', 'medical'],
    'amount': [15000, 8000, 5000, 20000, 3000]
}
df = pd.DataFrame(data)

total = df['amount'].sum()
by_category = df.groupby('category')['amount'].sum().to_dict()

print(f"Total: {total}")
print(f"By category: {by_category}")
"""

    response = client.post(
        "/api/calculate",
        json={"code": code}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "Total: 51000" in data["stdout"]
    assert "education" in data["stdout"]


def test_calculate_with_error(client):
    daytona_key = os.getenv("DAYTONA_API_KEY")
    if not daytona_key:
        pytest.skip("DAYTONA_API_KEY not set")

    code = """
x = 10 / 0
"""

    response = client.post(
        "/api/calculate",
        json={"code": code}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert data["error"] is not None


def test_compute_agent_direct():
    daytona_key = os.getenv("DAYTONA_API_KEY")
    if not daytona_key:
        pytest.skip("DAYTONA_API_KEY not set")

    from backend.agents.compute_agent import ComputeAgent
    agent = ComputeAgent(
        api_key=daytona_key,
        api_url=os.getenv("DAYTONA_API_URL", "https://app.daytona.io/api")
    )

    result = agent.execute_code("print('Test')")

    assert result["success"] is True
    assert "Test" in result["stdout"]

    agent.cleanup()
