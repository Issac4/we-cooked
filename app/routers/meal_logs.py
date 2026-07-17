from fastapi import APIRouter, Depends
from typing import List
from sqlmodel import Session
from database import get_session
from models import User
from schemas import MealLogCreate, MealLogRead
from auth import get_current_user
from services import meal_log_service

router = APIRouter(prefix="/recipes", tags=["Meal Logs"])

@router.post("/{recipe_id}/logs", response_model=MealLogRead, status_code=201)
def create_meal_log(
    recipe_id: int,
    log_in: MealLogCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Log a cooking session for a specific recipe (Protected)."""
    return meal_log_service.create_log(session, recipe_id, log_in)

@router.get("/{recipe_id}/logs", response_model=List[MealLogRead])
def get_meal_logs(
    recipe_id: int,
    session: Session = Depends(get_session)
):
    """Get all cooking logs for a specific recipe (Public)."""
    return meal_log_service.get_logs_for_recipe(session, recipe_id)

@router.put("/logs/{log_id}", response_model=MealLogRead)
def update_meal_log(
    log_id: int,
    log_in: MealLogCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update a cooking log (Protected)."""
    return meal_log_service.update_log(session, log_id, log_in)

@router.delete("/logs/{log_id}", status_code=204)
def delete_meal_log(
    log_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Delete a cooking log (Protected)."""
    meal_log_service.delete_log(session, log_id)
    return None
