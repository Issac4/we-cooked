from typing import List
from fastapi import HTTPException
from sqlmodel import Session, select
from models import MealLog, Recipe
from schemas import MealLogCreate

def create_log(session: Session, recipe_id: int, log_in: MealLogCreate) -> MealLog:
    """Log a cooking session for a specific recipe."""
    recipe = session.get(Recipe, recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    # Check for existing log on the same day (Hardened)
    statement = select(MealLog).where(
        MealLog.recipe_id == recipe_id, 
        MealLog.cooked_date == log_in.cooked_date
    )
    existing = session.exec(statement).first()
    if existing:
        raise HTTPException(status_code=400, detail="A log already exists for this recipe on this date")

    db_log = MealLog(**log_in.model_dump(), recipe_id=recipe_id)
    session.add(db_log)
    session.commit()
    session.refresh(db_log)
    return db_log

def get_logs_for_recipe(session: Session, recipe_id: int) -> List[MealLog]:
    """Get all cooking logs for a specific recipe."""
    recipe = session.get(Recipe, recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    statement = select(MealLog).where(MealLog.recipe_id == recipe_id).order_by(MealLog.cooked_date.desc())
    logs = session.exec(statement).all()
    return logs

def update_log(session: Session, log_id: int, log_in: MealLogCreate) -> MealLog:
    """Update an existing cooking log."""
    db_log = session.get(MealLog, log_id)
    if not db_log:
        raise HTTPException(status_code=404, detail="Meal log not found")
    
    # Check for duplicate date if date is changing
    if db_log.cooked_date != log_in.cooked_date:
        statement = select(MealLog).where(
            MealLog.recipe_id == db_log.recipe_id,
            MealLog.cooked_date == log_in.cooked_date
        )
        existing = session.exec(statement).first()
        if existing:
            raise HTTPException(status_code=400, detail="A log already exists for this recipe on this date")

    log_data = log_in.model_dump(exclude_unset=True)
    for key, value in log_data.items():
        setattr(db_log, key, value)
    
    session.add(db_log)
    session.commit()
    session.refresh(db_log)
    return db_log

def delete_log(session: Session, log_id: int) -> bool:
    """Delete a cooking log."""
    db_log = session.get(MealLog, log_id)
    if not db_log:
        raise HTTPException(status_code=404, detail="Meal log not found")
    
    session.delete(db_log)
    session.commit()
    return True
