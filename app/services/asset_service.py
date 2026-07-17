import os
import time
from pathlib import Path
from typing import List, Set
from sqlmodel import Session, select
from models import Recipe
from config import settings
from database import engine

UPLOAD_DIR = Path(settings.UPLOAD_DIR)

def run_cleanup_task():
    """Wrapper for background tasks that creates its own session."""
    with Session(engine) as session:
        return cleanup_orphaned_assets(session)

def cleanup_orphaned_assets(session: Session) -> List[str]:
    """
    Identifies and deletes files in the upload directory that are not referenced in the database.
    Returns a list of deleted filenames.
    """
    if not UPLOAD_DIR.exists():
        return []

    # 1. Get all files currently on disk
    files_on_disk = {f for f in os.listdir(UPLOAD_DIR) if os.path.isfile(UPLOAD_DIR / f)}
    
    # 2. Get all referenced filenames from the database
    # cover_image_url format is "/static/uploads/filename.ext"
    statement = select(Recipe.cover_image_url).where(Recipe.cover_image_url != None)
    results = session.exec(statement).all()
    
    referenced_files: Set[str] = set()
    for url in results:
        if url:
            filename = os.path.basename(url)
            referenced_files.add(filename)

    # 3. Identify orphans
    orphans = files_on_disk - referenced_files
    
    deleted_files = []
    current_time = time.time()

    for filename in orphans:
        # Safety checks
        if filename == ".gitkeep":
            continue
            
        file_path = UPLOAD_DIR / filename
        
        # Check file age (mtime)
        try:
            file_mtime = os.path.getmtime(file_path)
            if current_time - file_mtime < settings.ASSET_CLEANUP_WINDOW_SECONDS:
                # File is too new, skip for safety (might be in processing)
                continue
                
            os.remove(file_path)
            deleted_files.append(filename)
        except Exception as e:
            # Log error but continue with other files
            print(f"Failed to delete orphaned file {filename}: {e}")

    return deleted_files

def delete_asset_file(file_url: str):
    """
    Deletes a physical file from storage given its URL.
    Used for immediate cleanup after successful DB transactions.
    Includes strict path traversal prevention.
    """
    if not file_url:
        return

    try:
        # Convert to local path relative to project root
        local_path = Path(file_url.lstrip("/"))
        resolved_path = local_path.resolve()
        resolved_upload_dir = Path(settings.UPLOAD_DIR).resolve()
        
        # Security check: Ensure the file resides strictly within the upload directory
        if resolved_path.is_relative_to(resolved_upload_dir):
            if resolved_path.exists() and resolved_path.is_file():
                os.remove(resolved_path)
                print(f"Successfully deleted asset: {resolved_path}")
        else:
            print(f"Security Warning: Blocked path traversal attempt for URL: {file_url}")
    except Exception as e:
        print(f"Failed to delete asset {file_url}: {e}")
