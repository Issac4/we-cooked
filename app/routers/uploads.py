import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, BackgroundTasks
from sqlmodel import Session
from auth import get_current_user
from models import User
from database import get_session
from services import asset_service
from config import settings

router = APIRouter(prefix="/uploads", tags=["Uploads"])

@router.post("/", status_code=201)
async def upload_image(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload an image file and return its public URL."""
    # 1. Validate file extension
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )

    # 2. Validate file size
    if file.size > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size allowed is {settings.MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)}MB"
        )

    # 3. Validate actual content (Byte Signature check)
    # Read the first 12 bytes to identify the file format
    header = await file.read(12)
    await file.seek(0)  # Reset to beginning for saving

    is_valid = False
    if file_ext in [".jpg", ".jpeg"]:
        # JPEG starts with FF D8 FF
        if header.startswith(b"\xff\xd8\xff"):
            is_valid = True
    elif file_ext == ".png":
        # PNG starts with 89 50 4E 47 0D 0A 1A 0A
        if header.startswith(b"\x89PNG\r\n\x1a\n"):
            is_valid = True
    elif file_ext == ".webp":
        # WebP starts with RIFF (bytes 0-3) and WEBP (bytes 8-11)
        if len(header) >= 12 and header.startswith(b"RIFF") and header[8:12] == b"WEBP":
            is_valid = True

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file content. The file does not match its extension."
        )

    # 4. Create unique filename
    unique_filename = f"{uuid.uuid4().hex}{file_ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)

    # 5. Save file to disk
    try:
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not save file: {str(e)}"
        )

    background_tasks.add_task(asset_service.run_cleanup_task)

    # 6. Return the public URL
    return {"url": f"/{settings.UPLOAD_DIR}/{unique_filename}"}

@router.post("/cleanup", status_code=200)
def cleanup_uploads(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Identify and purge orphaned image files from the upload directory (Protected)."""
    deleted_files = asset_service.cleanup_orphaned_assets(session)
    return {
        "status": "success",
        "deleted_count": len(deleted_files),
        "deleted_files": deleted_files
    }
