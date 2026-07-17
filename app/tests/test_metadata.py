import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_fetch_youtube_metadata(client: AsyncClient):
    # This URL is the one provided by the user
    test_url = "https://www.youtube.com/watch?v=FFjuSypfhqM"
    
    # We call our own proxy endpoint
    response = await client.get(f"/metadata/youtube?url={test_url}")
    
    # It should be 200 OK
    assert response.status_code == 200
    data = response.json()
    
    # Verify the formatting
    assert "formatted_title" in data
    # The exact string might change if YouTube updates, but we check for the pipe and expected content
    assert "|" in data["formatted_title"]
    assert "Sloppy Joe Hotdog" in data["formatted_title"]
    assert "Bob's Your Uncle" in data["formatted_title"]

@pytest.mark.asyncio
async def test_fetch_invalid_domain(client: AsyncClient):
    response = await client.get("/metadata/youtube?url=https://google.com")
    assert response.status_code == 400
    assert "Invalid YouTube URL" in response.json()["detail"]
