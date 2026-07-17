import os
from pathlib import Path
from typing import List, Optional
from fastapi import HTTPException
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload
from models import Recipe, Protein, MealType, RecipeMealTypeLink, RecipeProteinLink
from schemas import RecipeCreate, RecipeRead, RecipeUpdate

def format_recipe_read(recipe: Recipe) -> RecipeRead:
    """Helper to convert a Recipe model to RecipeRead with computed fields."""
    return RecipeRead(
        **recipe.model_dump(),
        proteins=[p.name for p in recipe.proteins],
        meal_types=[mt.name for mt in recipe.meal_types],
        last_cooked=max([l.cooked_date for l in recipe.logs]) if recipe.logs else None,
        cook_count=len(recipe.logs)
    )

def get_all_recipes(
    session: Session,
    search: Optional[str] = None,
    protein_ids: Optional[List[int]] = None,
    meal_type_ids: Optional[List[int]] = None,
    sort_by: str = "created_at",
    order: str = "desc"
) -> List[RecipeRead]:
    """Fetch recipes with filtering and sorting logic."""
    statement = select(Recipe).options(
        selectinload(Recipe.proteins),
        selectinload(Recipe.meal_types),
        selectinload(Recipe.logs)
    )

    # 1. Text Search (Title)
    if search:
        statement = statement.where(Recipe.title.ilike(f"%{search}%"))

    # 2. Filter by Protein
    if protein_ids:
        protein_subquery = (
            select(RecipeProteinLink.recipe_id)
            .where(RecipeProteinLink.protein_id.in_(protein_ids))
        )
        statement = statement.where(Recipe.id.in_(protein_subquery))

    # 3. Filter by Meal Type
    if meal_type_ids:
        meal_subquery = (
            select(RecipeMealTypeLink.recipe_id)
            .where(RecipeMealTypeLink.meal_type_id.in_(meal_type_ids))
        )
        statement = statement.where(Recipe.id.in_(meal_subquery))

    # 4. Sorting Logic
    if sort_by == "title":
        statement = statement.order_by(Recipe.title.asc() if order == "asc" else Recipe.title.desc())
    elif sort_by == "total_time":
        total_time_col = Recipe.prep_time_mins + Recipe.cook_time_mins
        statement = statement.order_by(total_time_col.asc() if order == "asc" else total_time_col.desc())
    else: # Default: created_at
        statement = statement.order_by(Recipe.created_at.asc() if order == "asc" else Recipe.created_at.desc())

    results = session.exec(statement).all()
    return [format_recipe_read(r) for r in results]

def get_recipe_by_id(session: Session, recipe_id: int) -> RecipeRead:
    """Fetch a single recipe by ID."""
    statement = select(Recipe).where(Recipe.id == recipe_id).options(
        selectinload(Recipe.proteins),
        selectinload(Recipe.meal_types),
        selectinload(Recipe.logs)
    )
    recipe = session.exec(statement).first()
    
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    return format_recipe_read(recipe)

def create_recipe(session: Session, recipe_in: RecipeCreate) -> RecipeRead:
    """Create a new recipe and its category links."""
    # 1. Create the base recipe
    db_recipe = Recipe(**recipe_in.model_dump(exclude={"protein_ids", "meal_type_ids", "instructions", "ingredients", "reference_links"}))
    
    # Manual assignment for JSON fields
    db_recipe.instructions = recipe_in.instructions.model_dump()
    db_recipe.ingredients = [i.model_dump() for i in recipe_in.ingredients]
    db_recipe.reference_links = [l.model_dump() for l in recipe_in.reference_links]
    
    session.add(db_recipe)
    
    # 2. Add protein links
    if recipe_in.protein_ids:
        for p_id in recipe_in.protein_ids:
            p = session.get(Protein, p_id)
            if not p:
                raise HTTPException(status_code=400, detail=f"Protein ID {p_id} not found")
            db_recipe.proteins.append(p)

    # 3. Add meal type links
    if recipe_in.meal_type_ids:
        for mt_id in recipe_in.meal_type_ids:
            mt = session.get(MealType, mt_id)
            if not mt:
                raise HTTPException(status_code=400, detail=f"MealType ID {mt_id} not found")
            db_recipe.meal_types.append(mt)
    
    session.add(db_recipe)
    session.commit()
    session.refresh(db_recipe)
    
    return format_recipe_read(db_recipe)

def update_recipe(session: Session, recipe_id: int, recipe_in: RecipeUpdate) -> RecipeRead:
    """Update an existing recipe."""
    statement = select(Recipe).where(Recipe.id == recipe_id).options(
        selectinload(Recipe.proteins),
        selectinload(Recipe.meal_types),
        selectinload(Recipe.logs)
    )
    db_recipe = session.exec(statement).first()
    
    if not db_recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    # Update data that is explicitly set
    update_data = recipe_in.model_dump(exclude_unset=True, exclude={"protein_ids", "meal_type_ids", "instructions", "ingredients", "reference_links"})
    for key, value in update_data.items():
        setattr(db_recipe, key, value)
    
    # Update JSON fields
    if recipe_in.instructions is not None:
        db_recipe.instructions = recipe_in.instructions.model_dump()
    if recipe_in.ingredients is not None:
        db_recipe.ingredients = [i.model_dump() for i in recipe_in.ingredients]
    if recipe_in.reference_links is not None:
        db_recipe.reference_links = [l.model_dump() for l in recipe_in.reference_links]
    
    # Update protein links
    if recipe_in.protein_ids is not None:
        db_recipe.proteins = []
        for p_id in recipe_in.protein_ids:
            p = session.get(Protein, p_id)
            if not p:
                raise HTTPException(status_code=400, detail=f"Protein ID {p_id} not found")
            db_recipe.proteins.append(p)

    # Update meal type links
    if recipe_in.meal_type_ids is not None:
        db_recipe.meal_types = [] 
        for mt_id in recipe_in.meal_type_ids:
            mt = session.get(MealType, mt_id)
            if not mt:
                raise HTTPException(status_code=400, detail=f"MealType ID {mt_id} not found")
            db_recipe.meal_types.append(mt)
    
    session.add(db_recipe)
    session.commit()
    session.refresh(db_recipe)
    
    return format_recipe_read(db_recipe)

def delete_recipe(session: Session, recipe_id: int) -> Optional[str]:
    """
    Delete a recipe from the database and return its image URL for cleanup.
    Does NOT delete the file directly to ensure atomic success.
    """
    db_recipe = session.get(Recipe, recipe_id)
    if not db_recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    image_url = db_recipe.cover_image_url
    
    session.delete(db_recipe)
    session.commit()
    
    return image_url
