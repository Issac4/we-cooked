import pytest
from httpx import AsyncClient
import io

@pytest.mark.asyncio
async def test_upload_image(client: AsyncClient, auth_headers: dict):
    # Prepare a mock image file with valid JPEG signature
    file_content = b"\xff\xd8\xff\xe0" + b"fake image data"
    files = {"file": ("test_image.jpg", file_content, "image/jpeg")}
    
    response = await client.post("/uploads/", files=files, headers=auth_headers)
    
    # This is expected to FAIL initially (404)
    assert response.status_code == 201
    data = response.json()
    assert "url" in data
    assert data["url"].endswith(".jpg")

@pytest.mark.asyncio
async def test_upload_invalid_file_type(client: AsyncClient, auth_headers: dict):
    # Prepare a mock non-image file
    file_content = b"fake text data"
    files = {"file": ("test.txt", file_content, "text/plain")}
    
    response = await client.post("/uploads/", files=files, headers=auth_headers)
    
    # Should be rejected
    assert response.status_code == 400
    assert "detail" in response.json()
