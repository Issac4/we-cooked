from fastapi import APIRouter, HTTPException, Query
import httpx
from typing import Dict

router = APIRouter(prefix="/metadata", tags=["Metadata"])

@router.get("/youtube")
async def get_youtube_metadata(url: str = Query(..., description="The YouTube URL to fetch metadata for")):
    """
    Fetch YouTube video metadata (title and author) via oEmbed.
    Returns a formatted string: "Title | Author"
    """
    if not any(domain in url for domain in ["youtube.com", "youtu.be"]):
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")

    oembed_url = f"https://www.youtube.com/oembed?url={url}&format=json"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(oembed_url)
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Could not fetch metadata from YouTube")
            
            data = response.json()
            title = data.get("title", "Unknown Title")
            author = data.get("author_name", "Unknown Author")
            
            return {"formatted_title": f"{title} | {author}"}
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Internal error fetching metadata: {str(e)}")
