from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlmodel import Session, select
from database import get_session
from models import Protein, User
from schemas import ProteinCreate
from auth import get_current_user

from sqlalchemy import func
router = APIRouter(prefix="/proteins", tags=["Proteins"])

@router.get("/", response_model=List[dict])
def get_proteins(session: Session = Depends(get_session)):
    """Fetch all available protein options with recipe counts."""
    from models import RecipeProteinLink
    
    # Query proteins and join with link table to get counts
    results = session.exec(
        select(Protein, func.count(RecipeProteinLink.recipe_id).label("recipe_count"))
        .outerjoin(RecipeProteinLink)
        .group_by(Protein.id)
        .order_by(Protein.name)
    ).all()
    
    return [{"id": p.id, "name": p.name, "recipe_count": count} for p, count in results]

@router.post("/", response_model=Protein, status_code=201)
def create_protein(
    protein_in: ProteinCreate, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a new protein option (Protected). Case-insensitive check."""
    # Case-insensitive duplicate check
    existing = session.exec(
        select(Protein).where(func.lower(Protein.name) == func.lower(protein_in.name))
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Protein '{protein_in.name}' already exists (case-insensitive)")
    
    db_protein = Protein(name=protein_in.name)
    session.add(db_protein)
    session.commit()
    session.refresh(db_protein)
    return db_protein

@router.put("/{protein_id}", response_model=Protein)
def update_protein(
    protein_id: int,
    protein_in: ProteinCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update (Rename) a protein option (Protected). Case-insensitive duplicate check."""
    from sqlalchemy import func
    db_protein = session.get(Protein, protein_id)
    if not db_protein:
        raise HTTPException(status_code=404, detail="Protein not found")
    
    # Case-insensitive duplicate check (excluding current record)
    existing = session.exec(
        select(Protein).where(
            func.lower(Protein.name) == func.lower(protein_in.name),
            Protein.id != protein_id
        )
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Protein '{existing.name}' already exists")
    
    db_protein.name = protein_in.name
    session.add(db_protein)
    session.commit()
    session.refresh(db_protein)
    return db_protein

@router.delete("/{protein_id}", status_code=204)
def delete_protein(
    protein_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Delete a protein option (Protected). Blocks deletion if in use by recipes."""
    from models import RecipeProteinLink
    db_protein = session.get(Protein, protein_id)
    if not db_protein:
        raise HTTPException(status_code=404, detail="Protein not found")
    
    # Check for usage
    usage = session.exec(
        select(RecipeProteinLink).where(RecipeProteinLink.protein_id == protein_id)
    ).first()
    if usage:
        raise HTTPException(
            status_code=400, 
            detail="Cannot delete protein: it is currently linked to one or more recipes."
        )
    
    session.delete(db_protein)
    session.commit()
    return None
