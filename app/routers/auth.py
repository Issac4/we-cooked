from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select
from datetime import timedelta
from typing import List
from database import get_session
from models import User
from schemas import UserCreate, UserRead, Token, UserProfileUpdate, UserStatusUpdate, UserPasswordReset
from auth import (
    get_password_hash, 
    verify_password, 
    create_access_token,
    get_current_user
)

from config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserRead, status_code=201)
def register_user(
    user_in: UserCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Register a new user. Restricted to administrators."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Registration is restricted to administrators."
        )
    # Check if user already exists
    existing_user = session.exec(
        select(User).where((User.username == user_in.username) | (User.email == user_in.email))
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Username or email already registered"
        )
    
    # Create new user
    hashed_pw = get_password_hash(user_in.password)
    db_user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=hashed_pw
    )
    session.add(db_user)
    session.commit() # Explicit Commit
    session.refresh(db_user)
    return db_user

@router.post("/token", response_model=Token)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session)
):
    """Login to get a JWT token. Supports both username and email."""
    # Try to find user by username OR email
    user = session.exec(
        select(User).where((User.username == form_data.username) | (User.email == form_data.username))
    ).first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is deactivated."
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)):
    """Get current user details."""
    return current_user

@router.put("/profile", response_model=UserRead)

def update_profile(
    profile_update: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Update user profile (username, email, password)."""
    # 1. Verify current password
    if not verify_password(profile_update.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )
    
    # 2. Update username if provided and changed
    if profile_update.username and profile_update.username != current_user.username:
        # Check if username is already taken
        existing = session.exec(
            select(User).where(User.username == profile_update.username)
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
        current_user.username = profile_update.username
        
    # 3. Update email if provided and changed
    if profile_update.email and profile_update.email != current_user.email:
        # Check if email is already taken
        existing = session.exec(
            select(User).where(User.email == profile_update.email)
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        current_user.email = profile_update.email
        
    # 4. Update password if new_password is provided
    if profile_update.new_password:
        if len(profile_update.new_password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be at least 6 characters"
            )
        current_user.hashed_password = get_password_hash(profile_update.new_password)
        
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user

@router.get("/users", response_model=List[UserRead])
def list_users(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """List all users in the system. Restricted to administrators."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Registration/User management is restricted to administrators."
        )
    users = session.exec(select(User).order_by(User.created_at.desc())).all()
    return users

@router.patch("/users/{user_id}/status", response_model=UserRead)
def update_user_status(
    user_id: int,
    status_in: UserStatusUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Update a user's active status. Restricted to administrators."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Registration/User management is restricted to administrators."
        )
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot deactivate themselves."
        )
    db_user = session.get(User, user_id)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
    db_user.is_active = status_in.is_active
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user

@router.patch("/users/{user_id}/reset-password", response_model=UserRead)
def reset_user_password(
    user_id: int,
    password_in: UserPasswordReset,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Reset a user's password. Restricted to administrators."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Registration/User management is restricted to administrators."
        )
    if len(password_in.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters."
        )
    db_user = session.get(User, user_id)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
    db_user.hashed_password = get_password_hash(password_in.new_password)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


