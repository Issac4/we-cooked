import pytest
from httpx import AsyncClient
from datetime import date

@pytest.mark.asyncio
async def test_create_meal_log(client: AsyncClient, auth_headers: dict):
    # 1. Create a recipe first
    recipe_data = {
        "title": "Log Test Recipe",
        "instructions": {"prep": [], "cook": []},
        "ingredients": [],
        "reference_links": []
    }
    resp = await client.post("/recipes/", json=recipe_data, headers=auth_headers)
    recipe_id = resp.json()["id"]

    # 2. Log a meal
    log_data = {
        "cooked_date": str(date.today()),
        "rating": 5,
        "notes": "Delicious!"
    }
    response = await client.post(f"/recipes/{recipe_id}/logs", json=log_data, headers=auth_headers)
    
    assert response.status_code == 201
    data = response.json()
    assert data["recipe_id"] == recipe_id
    assert data["rating"] == 5
    assert data["notes"] == "Delicious!"

@pytest.mark.asyncio
async def test_get_meal_logs(client: AsyncClient, auth_headers: dict):
    # 1. Create a recipe
    recipe_data = {
        "title": "Log History Recipe",
        "instructions": {"prep": [], "cook": []},
        "ingredients": [],
        "reference_links": []
    }
    resp = await client.post("/recipes/", json=recipe_data, headers=auth_headers)
    recipe_id = resp.json()["id"]

    # 2. Log two meals
    await client.post(f"/recipes/{recipe_id}/logs", json={"cooked_date": "2026-06-01", "rating": 4}, headers=auth_headers)
    await client.post(f"/recipes/{recipe_id}/logs", json={"cooked_date": "2026-06-02", "rating": 5}, headers=auth_headers)

    # 3. Get history
    response = await client.get(f"/recipes/{recipe_id}/logs")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    # Check ordering (descending by date)
    assert data[0]["cooked_date"] == "2026-06-02"
    assert data[1]["cooked_date"] == "2026-06-01"

@pytest.mark.asyncio
async def test_create_log_invalid_rating(client: AsyncClient, auth_headers: dict):
    recipe_data = {"title": "Rating Test", "instructions": {"prep": [], "cook": []}, "ingredients": [], "reference_links": []}
    resp = await client.post("/recipes/", json=recipe_data, headers=auth_headers)
    recipe_id = resp.json()["id"]

    # Rating too high
    response = await client.post(f"/recipes/{recipe_id}/logs", json={"cooked_date": "2026-06-01", "rating": 6}, headers=auth_headers)
    assert response.status_code == 422
