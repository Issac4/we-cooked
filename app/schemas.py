from pydantic import BaseModel, Field as PydanticField
from typing import List, Optional, Dict, Any
from datetime import datetime, date

# --- SUB-SCHEMAS FOR JSONB FIELDS ---

class InstructionStep(BaseModel):
    step: int
    action: str
    description: Optional[str] = None
    timer_mins: Optional[int] = None

class RecipeInstructions(BaseModel):
    prep: List[InstructionStep] = []
    cook: List[InstructionStep] = []

class Ingredient(BaseModel):
    item: str
    amount: str

class ReferenceLink(BaseModel):
    type: str
    title: str
    url: str

# --- BASIC LOOKUP SCHEMAS ---

class ProteinCreate(BaseModel):
    name: str

class MealTypeCreate(BaseModel):
    name: str

# --- MEAL LOG SCHEMAS ---

class MealLogCreate(BaseModel):
    cooked_date: date
    rating: int = PydanticField(ge=1, le=5)
    notes: Optional[str] = None

class MealLogRead(BaseModel):
    id: int
    recipe_id: int
    cooked_date: date
    rating: int
    notes: Optional[str]
    created_at: datetime

# --- AUTH SCHEMAS ---

class UserCreate(BaseModel):
    username: str
    email: str
    password: str = PydanticField(max_length=128)

class UserRead(BaseModel):
    id: int
    username: str
    email: str
    is_active: bool
    is_admin: bool
    created_at: datetime

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class UserProfileUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    current_password: str = PydanticField(max_length=128)
    new_password: Optional[str] = PydanticField(default=None, max_length=128)

class UserStatusUpdate(BaseModel):
    is_active: bool

class UserPasswordReset(BaseModel):
    new_password: str = PydanticField(max_length=128)



# --- RECIPE SCHEMAS ---

class RecipeCreate(BaseModel):
    title: str = PydanticField(max_length=255)
    protein_ids: List[int] = []
    meal_type_ids: List[int] = []
    cover_image_url: Optional[str] = None
    prep_time_mins: Optional[int] = None
    cook_time_mins: Optional[int] = None
    servings: int = 2
    instructions: RecipeInstructions
    ingredients: List[Ingredient]
    reference_links: List[ReferenceLink]
    attributes: Dict[str, Any] = {}

class RecipeUpdate(BaseModel):
    title: Optional[str] = PydanticField(default=None, max_length=255)

    protein_ids: Optional[List[int]] = None
    meal_type_ids: Optional[List[int]] = None # Optional so we don't wipe them if omitted
    cover_image_url: Optional[str] = None
    prep_time_mins: Optional[int] = None
    cook_time_mins: Optional[int] = None
    servings: Optional[int] = None
    instructions: Optional[RecipeInstructions] = None
    ingredients: Optional[List[Ingredient]] = None
    reference_links: Optional[List[ReferenceLink]] = None
    attributes: Optional[Dict[str, Any]] = None

class RecipeRead(BaseModel):
    id: int
    title: str
    proteins: List[str] = []
    meal_types: List[str] = []
    cover_image_url: Optional[str] = None
    prep_time_mins: Optional[int] = None
    cook_time_mins: Optional[int] = None
    servings: int = 2
    instructions: RecipeInstructions
    ingredients: List[Ingredient]
    reference_links: List[ReferenceLink]
    attributes: Dict[str, Any]
    last_cooked: Optional[date] = None
    cook_count: int = 0
    created_at: datetime
