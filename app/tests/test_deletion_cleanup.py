import pytest
from httpx import AsyncClient
from pathlib import Path
import os

@pytest.mark.asyncio
async def test_recipe_deletion_removes_file(client: AsyncClient, auth_headers: dict):
    # 1. Upload an image
    file_content = b"\xff\xd8\xff\xe0" + b"fake image data for deletion test"
    files = {"file": ("deletion_test.jpg", file_content, "image/jpeg")}
    upload_res = await client.post("/uploads/", files=files, headers=auth_headers)
    assert upload_res.status_code == 201
    image_url = upload_res.json()["url"]
    
    # Verify file exists on disk
    # image_url is like "/static/uploads/filename.jpg"
    # Inside container, path is relative to /app
    local_path = image_url.lstrip("/")
    assert Path(local_path).exists()
    
    # 2. Create a recipe with this image
    recipe_data = {
        "title": "Deletion Cleanup Test",
        "protein_ids": [1],
        "meal_type_ids": [1],
        "cover_image_url": image_url,
        "instructions": {"prep": [], "cook": []},
        "ingredients": [],
        "reference_links": [],
        "attributes": {}
    }
    create_res = await client.post("/recipes/", json=recipe_data, headers=auth_headers)
    assert create_res.status_code == 201
    recipe_id = create_res.json()["id"]
    
    # 3. Delete the recipe
    delete_res = await client.delete(f"/recipes/{recipe_id}", headers=auth_headers)
    assert delete_res.status_code == 204
    
    # 4. Verify file is GONE from disk
    assert not Path(local_path).exists()


def test_delete_asset_file_path_traversal_prevented():
    from services.asset_service import delete_asset_file
    from config import settings

    # Create a dummy file outside the uploads directory (in the parent static directory)
    dummy_file = Path(settings.UPLOAD_DIR).parent / "test_traversal_prevented.txt"
    dummy_file.write_text("secure data")
    
    try:
        assert dummy_file.exists()
        
        # Attempt to delete using path traversal
        traversal_url = f"/{settings.UPLOAD_DIR}/../test_traversal_prevented.txt"
        delete_asset_file(traversal_url)
        
        # File should NOT be deleted
        assert dummy_file.exists()
    finally:
        if dummy_file.exists():
            os.remove(dummy_file)

