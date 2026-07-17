import pytest
import uuid
from httpx import ASGITransport, AsyncClient
from main import app

@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

@pytest.fixture
def unique_user_data():
    unique_id = uuid.uuid4().hex[:8]
    return {
        "username": f"user_{unique_id}",
        "email": f"{unique_id}@example.com",
        "password": "testpassword"
    }

@pytest.fixture
async def admin_auth_token(client: AsyncClient):
    # Log in as the seeded default admin user
    login_data = {
        "username": "admin",
        "password": "admin123"
    }
    response = await client.post("/auth/token", data=login_data)
    return response.json()["access_token"]

@pytest.fixture
async def admin_auth_headers(admin_auth_token: str):
    return {"Authorization": f"Bearer {admin_auth_token}"}

@pytest.fixture
async def auth_token(client: AsyncClient, admin_auth_headers: dict):
    # Register a default test user using admin credentials
    user_data = {
        "username": "testuser",
        "email": "test@example.com",
        "password": "testpassword"
    }
    # Ignore 400 if user already exists
    await client.post("/auth/register", json=user_data, headers=admin_auth_headers)
    
    # Get token
    login_data = {
        "username": "testuser",
        "password": "testpassword"
    }
    response = await client.post("/auth/token", data=login_data)
    return response.json()["access_token"]

@pytest.fixture
async def auth_headers(auth_token: str):
    return {"Authorization": f"Bearer {auth_token}"}

