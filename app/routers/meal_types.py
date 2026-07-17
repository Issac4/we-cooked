from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlmodel import Session, select
from database import get_session
from models import MealType, User
from schemas import MealTypeCreate
from auth import get_current_user

router = APIRouter(prefix="/meal-types", tags=["Meal Types"])

@router.get("/", response_model=List[dict])
def get_meal_types(session: Session = Depends(get_session)):
    """Fetch all available meal types with recipe counts."""
    from sqlalchemy import func
    from models import RecipeMealTypeLink
    
    # Query meal types and join with link table to get counts
    results = session.exec(
        select(MealType, func.count(RecipeMealTypeLink.recipe_id).label("recipe_count"))
        .outerjoin(RecipeMealTypeLink)
        .group_by(MealType.id)
        .order_by(MealType.name)
    ).all()
    
    return [{"id": mt.id, "name": mt.name, "recipe_count": count} for mt, count in results]

@router.post("/", response_model=MealType, status_code=201)
def create_meal_type(
    meal_type_in: MealTypeCreate, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new meal type option (Protected). Case-insensitive check."""
    from sqlalchemy import func
    # Case-insensitive duplicate check
    existing = session.exec(
        select(MealType).where(func.lower(MealType.name) == func.lower(meal_type_in.name))
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Meal type '{existing.name}' already exists")
    
    db_meal_type = MealType(name=meal_type_in.name)
    session.add(db_meal_type)
    session.commit()
    session.refresh(db_meal_type)
    return db_meal_type

@router.put("/{meal_type_id}", response_model=MealType)
def update_meal_type(
    meal_type_id: int,
    meal_type_in: MealTypeCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update (Rename) a meal type option (Protected). Case-insensitive duplicate check."""
    from sqlalchemy import func
    db_meal_type = session.get(MealType, meal_type_id)
    if not db_meal_type:
        raise HTTPException(status_code=404, detail="Meal type not found")
    
    # Case-insensitive duplicate check (excluding current record)
    existing = session.exec(
        select(MealType).where(
            func.lower(MealType.name) == func.lower(meal_type_in.name),
            MealType.id != meal_type_id
        )
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Meal type '{existing.name}' already exists")
    
    db_meal_type.name = meal_type_in.name
    session.add(db_meal_type)
    session.commit()
    session.refresh(db_meal_type)
    return db_meal_type

@router.delete("/{meal_type_id}", status_code=204)
def delete_meal_type(
    meal_type_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Delete a meal type option (Protected). Blocks deletion if in use by recipes."""
    from models import RecipeMealTypeLink
    db_meal_type = session.get(MealType, meal_type_id)
    if not db_meal_type:
        raise HTTPException(status_code=404, detail="Meal type not found")
    
    # Check for usage
    usage = session.exec(
        select(RecipeMealTypeLink).where(RecipeMealTypeLink.meal_type_id == meal_type_id)
    ).first()
    if usage:
        raise HTTPException(
            status_code=400, 
            detail="Cannot delete meal type: it is currently linked to one or more recipes."
        )
    
    session.delete(db_meal_type)
    session.commit()
    return None
