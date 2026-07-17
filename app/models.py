from sqlmodel import SQLModel, Field, Relationship, Column, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from typing import List, Optional, Dict, Any
from datetime import datetime, date

# --- JOIN TABLES ---

class RecipeMealTypeLink(SQLModel, table=True):
    __tablename__ = "recipe_meal_types"
    recipe_id: Optional[int] = Field(
        default=None, foreign_key="recipes.id", ondelete="CASCADE", primary_key=True
    )
    meal_type_id: Optional[int] = Field(
        default=None, foreign_key="meal_types.id", ondelete="CASCADE", primary_key=True
    )

class RecipeProteinLink(SQLModel, table=True):
    __tablename__ = "recipe_proteins"
    recipe_id: Optional[int] = Field(
        default=None, foreign_key="recipes.id", ondelete="CASCADE", primary_key=True
    )
    protein_id: Optional[int] = Field(
        default=None, foreign_key="proteins.id", ondelete="CASCADE", primary_key=True
    )

# --- BASIC LOOKUP MODELS ---

class Protein(SQLModel, table=True):
    __tablename__ = "proteins"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True, max_length=255)
    
    recipes: List["Recipe"] = Relationship(
        back_populates="proteins", link_model=RecipeProteinLink
    )

class MealType(SQLModel, table=True):
    __tablename__ = "meal_types"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True, max_length=255)
    
    recipes: List["Recipe"] = Relationship(
        back_populates="meal_types", link_model=RecipeMealTypeLink
    )

# --- MAIN RECIPE MODEL ---

class Recipe(SQLModel, table=True):
    __tablename__ = "recipes"
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(index=True, max_length=255)
    cover_image_url: Optional[str] = Field(default=None, max_length=1024)
    prep_time_mins: Optional[int] = None
    cook_time_mins: Optional[int] = None
    servings: int = Field(default=2)
    
    # JSONB fields in Postgres for performance and indexing
    instructions: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB))
    ingredients: List[Dict[str, Any]] = Field(default=[], sa_column=Column(JSONB))
    reference_links: List[Dict[str, Any]] = Field(default=[], sa_column=Column(JSONB))
    attributes: Dict[str, Any] = Field(default={}, sa_column=Column(JSONB))
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    proteins: List[Protein] = Relationship(
        back_populates="recipes", link_model=RecipeProteinLink
    )
    meal_types: List[MealType] = Relationship(
        back_populates="recipes", link_model=RecipeMealTypeLink
    )
    logs: List["MealLog"] = Relationship(
        back_populates="recipe", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )

class MealLog(SQLModel, table=True):
    __tablename__ = "meal_logs"
    __table_args__ = (UniqueConstraint("recipe_id", "cooked_date", name="unique_recipe_cook_date"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    recipe_id: int = Field(foreign_key="recipes.id", ondelete="CASCADE")
    cooked_date: date = Field(default_factory=date.today)
    rating: int = Field(ge=1, le=5)
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    recipe: Recipe = Relationship(back_populates="logs")

# --- USER MODEL ---

class User(SQLModel, table=True):
    __tablename__ = "users"
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True, max_length=255)
    email: str = Field(unique=True, index=True, max_length=255)
    hashed_password: str = Field(max_length=255)
    is_active: bool = Field(default=True)
    is_admin: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)

