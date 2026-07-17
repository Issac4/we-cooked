from fastapi import APIRouter, Depends, Query, BackgroundTasks, HTTPException, status
from typing import List, Optional
from sqlmodel import Session
from database import get_session
from models import User
from schemas import RecipeCreate, RecipeRead, RecipeUpdate
from auth import get_current_user
from services import recipe_service, asset_service

router = APIRouter(prefix="/recipes", tags=["Recipes"])

@router.get("/", response_model=List[RecipeRead])
def get_recipes(
    search: Optional[str] = Query(None, description="Search by recipe title"),
    protein_ids: Optional[List[int]] = Query(None),
    meal_type_ids: Optional[List[int]] = Query(None),
    sort_by: str = Query("created_at", enum=["title", "created_at", "total_time"]),
    order: str = Query("desc", enum=["asc", "desc"]),
    session: Session = Depends(get_session)
):
    """Fetch recipes with optional search, multi-select filtering, and dynamic sorting."""
    return recipe_service.get_all_recipes(
        session=session,
        search=search,
        protein_ids=protein_ids,
        meal_type_ids=meal_type_ids,
        sort_by=sort_by,
        order=order
    )

@router.get("/{recipe_id}", response_model=RecipeRead)
def get_recipe(recipe_id: int, session: Session = Depends(get_session)):
    """Fetch a single recipe by ID (Eager Loading)."""
    return recipe_service.get_recipe_by_id(session, recipe_id)

@router.post("/", response_model=RecipeRead, status_code=201)
def create_recipe(
    recipe_in: RecipeCreate, 
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new recipe and its category links (Atomic Transaction)."""
    if current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrators cannot create recipes."
        )
    result = recipe_service.create_recipe(session, recipe_in)
    background_tasks.add_task(asset_service.run_cleanup_task)
    return result

@router.delete("/{recipe_id}", status_code=204)
def delete_recipe(
    recipe_id: int, 
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Delete a recipe by ID and cleanup storage (Atomic)."""
    if current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrators cannot delete recipes."
        )
    image_url = recipe_service.delete_recipe(session, recipe_id)
    
    if image_url:
        background_tasks.add_task(asset_service.delete_asset_file, image_url)
    
    background_tasks.add_task(asset_service.run_cleanup_task)
    return None

@router.put("/{recipe_id}", response_model=RecipeRead)
def update_recipe(
    recipe_id: int, 
    recipe_in: RecipeUpdate, 
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update an existing recipe (Partial Updates supported)."""
    if current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrators cannot update recipes."
        )
    result = recipe_service.update_recipe(session, recipe_id, recipe_in)
    background_tasks.add_task(asset_service.run_cleanup_task)
    return result
