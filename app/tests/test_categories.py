import pytest
from httpx import AsyncClient
import uuid

@pytest.mark.asyncio
async def test_create_protein(client: AsyncClient, auth_headers: dict):
    unique_name = f"Protein_{uuid.uuid4().hex[:8]}"
    response = await client.post(
        "/proteins/", 
        json={"name": unique_name}, 
        headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == unique_name
    assert "id" in data

    # Try duplicate
    response = await client.post(
        "/proteins/", 
        json={"name": unique_name}, 
        headers=auth_headers
    )
    assert response.status_code == 400

@pytest.mark.asyncio
async def test_create_meal_type(client: AsyncClient, auth_headers: dict):
    unique_name = f"MealType_{uuid.uuid4().hex[:8]}"
    response = await client.post(
        "/meal-types/", 
        json={"name": unique_name}, 
        headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == unique_name
    assert "id" in data

    # Try duplicate
    response = await client.post(
        "/meal-types/", 
        json={"name": unique_name}, 
        headers=auth_headers
    )
    assert response.status_code == 400

@pytest.mark.asyncio
async def test_create_category_unauthorized(client: AsyncClient):
    response = await client.post("/proteins/", json={"name": "Fail"})
    assert response.status_code == 401
    
    response = await client.post("/meal-types/", json={"name": "Fail"})
    assert response.status_code == 401
