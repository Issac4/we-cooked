export interface InstructionStep {
  step: number;
  action: string;
  description?: string;
  timer_mins?: number;
}

export interface RecipeInstructions {
  prep: InstructionStep[];
  cook: InstructionStep[];
}

export interface Ingredient {
  item: string;
  amount: string;
}

export interface ReferenceLink {
  type: string;
  title: string;
  url: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

export interface Protein {
  id: number;
  name: string;
  recipe_count: number;
}

export interface MealType {
  id: number;
  name: string;
  recipe_count: number;
}

export interface RecipeCreate {
  title: string;
  protein_ids: number[];
  meal_type_ids: number[];
  cover_image_url?: string;
  prep_time_mins?: number;
  cook_time_mins?: number;
  servings: number;
  instructions: RecipeInstructions;
  ingredients: Ingredient[];
  reference_links: ReferenceLink[];
  attributes: Record<string, any>;
}

export interface Recipe {
  id: number;
  title: string;
  proteins: string[];
  meal_types: string[];
  cover_image_url?: string;
  prep_time_mins?: number;
  cook_time_mins?: number;
  servings: number;
  instructions: RecipeInstructions;
  ingredients: Ingredient[];
  reference_links: ReferenceLink[];
  attributes: Record<string, any>;
  last_cooked?: string;
  cook_count: number;
  created_at: string;
}

export interface MealLogCreate {
  cooked_date: string;
  rating: number;
  notes?: string;
}

export interface MealLog extends MealLogCreate {
  id: number;
  recipe_id: number;
  created_at: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

// Dummy export to ensure this is treated as a module at runtime
export const API_VERSION = '1.0';
