from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routers import recipes, proteins, meal_types, auth, uploads, metadata, meal_logs
from config import settings

# Initialize the FastAPI app
app = FastAPI(
    title="Recipe API",
    description="A modular API for managing recipes and meal logs",
    version="1.0.0"
)

# --- CORS CONFIGURATION ---
# This allows your React frontend to talk to this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- INCLUDE ROUTERS ---
app.include_router(auth.router)
app.include_router(recipes.router)
app.include_router(proteins.router)
app.include_router(meal_types.router)
app.include_router(meal_logs.router)
app.include_router(uploads.router)
app.include_router(metadata.router)

# --- STATIC FILES ---
# Mount the static directory to serve uploaded images
app.mount("/static", StaticFiles(directory="static"), name="static")

# --- BASE ROUTES ---

@app.get("/")
def read_root():
    """Simple health check endpoint."""
    return {
        "status": "Recipe API is online",
        "message": "Welcome to your personal learning project!"
    }
