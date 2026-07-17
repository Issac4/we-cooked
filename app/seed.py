import os
import sys
from sqlmodel import Session, select
from database import engine
from models import Protein, MealType, User
from auth import get_password_hash
from config import settings


def seed_data():
    with Session(engine) as session:
        # 1. Seed Proteins
        proteins = [
            'Beef', 'Pork', 'Lamb', 'Chicken', 'Duck', 'Egg',
            'Fish', 'Shrimp', 'Crab', 'Lobster', 'Scallop', 'Clam', 'Mussel', 'Oyster',
            'Tofu', 'Mushrooms', 'Vegetarian'
        ]
        
        for name in proteins:
            statement = select(Protein).where(Protein.name == name)
            existing = session.exec(statement).first()
            if not existing:
                print(f"Seeding Protein: {name}")
                session.add(Protein(name=name))
        
        # 2. Seed Meal Types
        meal_types = [
            'Breakfast', 'Brunch', 'Lunch', 'Dinner', 'Appetizer',
            'Dessert', 'Soup', 'Beverage'
        ]
        
        for name in meal_types:
            statement = select(MealType).where(MealType.name == name)
            existing = session.exec(statement).first()
            if not existing:
                print(f"Seeding Meal Type: {name}")
                session.add(MealType(name=name))
        
        # 3. Seed Default Admin User
        admin_username = settings.DEFAULT_ADMIN_USERNAME
        statement = select(User).where(User.username == admin_username)
        existing_admin = session.exec(statement).first()
        if not existing_admin:
            print(f"Seeding Default Admin User: {admin_username}")
            hashed_pw = get_password_hash(settings.DEFAULT_ADMIN_PASSWORD)
            session.add(User(
                username=admin_username,
                email=settings.DEFAULT_ADMIN_EMAIL,
                hashed_password=hashed_pw,
                is_admin=True
            ))
        
        session.commit()
        print("✅ Seeding completed successfully.")

if __name__ == "__main__":
    try:
        seed_data()
    except Exception as e:
        print(f"❌ Seeding failed: {e}")
        # Don't exit with error to prevent container restart loop if seeding fails but app is OK
        # But for first run, we might want to see it.
