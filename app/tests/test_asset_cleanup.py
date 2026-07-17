import os
import time
import pytest
from pathlib import Path
from sqlmodel import Session
from models import Recipe
from database import engine
from config import settings

UPLOAD_DIR = Path(settings.UPLOAD_DIR)

@pytest.fixture
def db_session():
    with Session(engine) as session:
        yield session

@pytest.fixture
def setup_test_files():
    """Sets up various files in the upload directory for testing."""
    if not UPLOAD_DIR.exists():
        UPLOAD_DIR.mkdir(parents=True)
    
    # 1. Active file (referenced in DB)
    active_filename = "active_image.jpg"
    active_path = UPLOAD_DIR / active_filename
    active_path.write_text("active")
    
    # 2. Old orphaned file (> 24h)
    old_orphan_filename = "old_orphan.jpg"
    old_orphan_path = UPLOAD_DIR / old_orphan_filename
    old_orphan_path.write_text("old_orphan")
    # Set mtime to 48 hours ago
    past_time = time.time() - (48 * 60 * 60)
    os.utime(old_orphan_path, (past_time, past_time))
    
    # 3. New orphaned file (< 24h)
    new_orphan_filename = "new_orphan.jpg"
    new_orphan_path = UPLOAD_DIR / new_orphan_filename
    new_orphan_path.write_text("new_orphan")
    # mtime is current, which is < 24h
    
    # 4. .gitkeep
    gitkeep_path = UPLOAD_DIR / ".gitkeep"
    if not gitkeep_path.exists():
        gitkeep_path.write_text("")

    yield {
        "active": active_filename,
        "old_orphan": old_orphan_filename,
        "new_orphan": new_orphan_filename,
        "gitkeep": ".gitkeep"
    }
    
    # Cleanup (don't delete .gitkeep if it's supposed to be there, but for tests we can)
    # Actually, better to just leave it if it was there.

@pytest.mark.asyncio
async def test_asset_cleanup_logic(client, auth_headers, db_session, setup_test_files):
    # Ensure the active file is referenced in the DB
    active_filename = setup_test_files["active"]
    recipe = Recipe(
        title="Test Recipe for Cleanup",
        cover_image_url=f"/static/uploads/{active_filename}",
        instructions={},
        ingredients=[]
    )
    db_session.add(recipe)
    db_session.commit()
    
    # Trigger cleanup via API
    response = await client.post("/uploads/cleanup", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    
    assert data["status"] == "success"
    # old_orphan.jpg should be deleted
    assert setup_test_files["old_orphan"] in data["deleted_files"]
    # active_image.jpg should NOT be deleted
    assert setup_test_files["active"] not in data["deleted_files"]
    # new_orphan.jpg should NOT be deleted
    assert setup_test_files["new_orphan"] not in data["deleted_files"]
    
    # Verify file system state
    assert (UPLOAD_DIR / setup_test_files["active"]).exists()
    assert (UPLOAD_DIR / setup_test_files["new_orphan"]).exists()
    assert (UPLOAD_DIR / setup_test_files["gitkeep"]).exists()
    assert not (UPLOAD_DIR / setup_test_files["old_orphan"]).exists()
    
    # Final Cleanup: remove recipe and test files
    db_session.delete(recipe)
    db_session.commit()
    
    # Clean up remaining test files
    for key in ["active", "new_orphan"]:
        fpath = UPLOAD_DIR / setup_test_files[key]
        if fpath.exists():
            os.remove(fpath)
