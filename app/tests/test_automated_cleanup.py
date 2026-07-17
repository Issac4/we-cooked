import os
import time
import pytest
import asyncio
from pathlib import Path
from sqlmodel import Session
from models import Recipe
from database import engine
from config import settings

UPLOAD_DIR = Path(settings.UPLOAD_DIR)

@pytest.mark.asyncio
async def test_automated_cleanup_on_upload(client, auth_headers):
    # 1. Temporarily reduce safety window to 0 for testing
    original_window = settings.ASSET_CLEANUP_WINDOW_SECONDS
    settings.ASSET_CLEANUP_WINDOW_SECONDS = 0
    
    try:
        # 2. Create an orphaned file manually
        orphan_filename = "auto_cleanup_test.jpg"
        orphan_path = UPLOAD_DIR / orphan_filename
        orphan_path.write_text("orphan data")
        # Set mtime to past to ensure it's older than 0 seconds (which it is anyway)
        past_time = time.time() - 10
        os.utime(orphan_path, (past_time, past_time))
        
        assert orphan_path.exists()
        
        # 3. Trigger an upload which should trigger background cleanup
        file_content = b"\xff\xd8\xff\xe0" + b"new image data"
        files = {"file": ("new_image.jpg", file_content, "image/jpeg")}
        response = await client.post("/uploads/", files=files, headers=auth_headers)
        assert response.status_code == 201
        
        # 4. Give background task a moment to run
        # Background tasks in FastAPI + TestClient/Httpx usually run immediately,
        # but a small sleep doesn't hurt.
        await asyncio.sleep(0.5)
        
        # 5. Verify orphan is gone
        assert not orphan_path.exists()
        
        # Cleanup the new file
        new_url = response.json()["url"]
        new_path = Path(new_url.lstrip("/"))
        if new_path.exists():
            os.remove(new_path)

    finally:
        settings.ASSET_CLEANUP_WINDOW_SECONDS = original_window
        if orphan_path.exists():
            os.remove(orphan_path)

@pytest.mark.asyncio
async def test_automated_cleanup_on_recipe_delete(client, auth_headers):
    # 1. Temporarily reduce safety window to 0 for testing
    original_window = settings.ASSET_CLEANUP_WINDOW_SECONDS
    settings.ASSET_CLEANUP_WINDOW_SECONDS = 0
    
    try:
        # 2. Create an orphaned file manually
        orphan_filename = "delete_cleanup_test.jpg"
        orphan_path = UPLOAD_DIR / orphan_filename
        orphan_path.write_text("orphan data")
        past_time = time.time() - 10
        os.utime(orphan_path, (past_time, past_time))
        
        # 3. Create a recipe to delete
        recipe_data = {
            "title": "To be deleted",
            "protein_ids": [],
            "meal_type_ids": [],
            "instructions": {"prep": [], "cook": []},
            "ingredients": [],
            "reference_links": []
        }
        create_res = await client.post("/recipes/", json=recipe_data, headers=auth_headers)
        assert create_res.status_code == 201
        recipe_id = create_res.json()["id"]
        
        # 4. Delete the recipe, triggering background cleanup
        delete_res = await client.delete(f"/recipes/{recipe_id}", headers=auth_headers)
        assert delete_res.status_code == 204
        
        # 5. Wait and verify
        await asyncio.sleep(0.5)
        assert not orphan_path.exists()

    finally:
        settings.ASSET_CLEANUP_WINDOW_SECONDS = original_window
        if orphan_path.exists():
            os.remove(orphan_path)
