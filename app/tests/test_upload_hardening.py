import pytest
from httpx import AsyncClient
import os
from config import settings

@pytest.mark.asyncio
async def test_upload_valid_jpeg(client: AsyncClient, auth_headers: dict):
    # Valid JPEG signature: FF D8 FF
    file_content = b"\xff\xd8\xff\xe0" + b"0" * 100
    files = {"file": ("test.jpg", file_content, "image/jpeg")}
    
    response = await client.post("/uploads/", files=files, headers=auth_headers)
    assert response.status_code == 201
    assert "url" in response.json()

@pytest.mark.asyncio
async def test_upload_valid_png(client: AsyncClient, auth_headers: dict):
    # Valid PNG signature: 89 50 4E 47 0D 0A 1A 0A
    file_content = b"\x89PNG\r\n\x1a\n" + b"0" * 100
    files = {"file": ("test.png", file_content, "image/png")}
    
    response = await client.post("/uploads/", files=files, headers=auth_headers)
    assert response.status_code == 201
    assert "url" in response.json()

@pytest.mark.asyncio
async def test_upload_valid_webp(client: AsyncClient, auth_headers: dict):
    # Valid WebP signature: RIFF....WEBP
    file_content = b"RIFF" + b"\x00" * 4 + b"WEBP" + b"0" * 100
    files = {"file": ("test.webp", file_content, "image/webp")}
    
    response = await client.post("/uploads/", files=files, headers=auth_headers)
    assert response.status_code == 201
    assert "url" in response.json()

@pytest.mark.asyncio
async def test_upload_spoofed_jpeg(client: AsyncClient, auth_headers: dict):
    # Text file renamed to .jpg
    file_content = b"This is just a text file, not a JPEG."
    files = {"file": ("fake.jpg", file_content, "image/jpeg")}
    
    response = await client.post("/uploads/", files=files, headers=auth_headers)
    assert response.status_code == 400
    assert "detail" in response.json()
    assert "does not match its extension" in response.json()["detail"]

@pytest.mark.asyncio
async def test_upload_oversized_file(client: AsyncClient, auth_headers: dict):
    # Create a file slightly larger than MAX_UPLOAD_SIZE_BYTES
    oversized_content = b"0" * (settings.MAX_UPLOAD_SIZE_BYTES + 1024)
    # Give it a valid header so it passes the content check
    oversized_content = b"\xff\xd8\xff\xe0" + oversized_content[4:]
    
    files = {"file": ("large.jpg", oversized_content, "image/jpeg")}
    
    response = await client.post("/uploads/", files=files, headers=auth_headers)
    assert response.status_code == 413
    assert "File too large" in response.json()["detail"]

@pytest.mark.asyncio
async def test_upload_unsupported_extension(client: AsyncClient, auth_headers: dict):
    file_content = b"some data"
    files = {"file": ("test.gif", file_content, "image/gif")}
    
    response = await client.post("/uploads/", files=files, headers=auth_headers)
    assert response.status_code == 400
    assert "Invalid file type" in response.json()["detail"]
