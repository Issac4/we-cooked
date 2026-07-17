import pytest
from httpx import AsyncClient
from datetime import date, timedelta

@pytest.mark.asyncio
async def test_create_meal_log_unique_constraint(client: AsyncClient, auth_headers: dict):
    # Create a recipe first
    recipe_data = {
        "title": "Constraint Test Recipe",
        "protein_ids": [],
        "meal_type_ids": [],
        "servings": 2,
        "instructions": {"prep": [], "cook": []},
        "ingredients": [],
        "reference_links": []
    }
    resp = await client.post("/recipes/", json=recipe_data, headers=auth_headers)
    assert resp.status_code == 201, resp.json()
    recipe_id = resp.json()["id"]

    log_data = {
        "cooked_date": str(date.today()),
        "rating": 5,
        "notes": "First log"
    }

    # First log should succeed
    resp = await client.post(f"/recipes/{recipe_id}/logs", json=log_data, headers=auth_headers)
    assert resp.status_code == 201

    # Second log on the same day should fail
    resp = await client.post(f"/recipes/{recipe_id}/logs", json=log_data, headers=auth_headers)
    assert resp.status_code == 400
    assert "already exists" in resp.json()["detail"]

@pytest.mark.asyncio
async def test_meal_log_crud_operations(client: AsyncClient, auth_headers: dict):
    # Create a recipe
    recipe_data = {
        "title": "CRUD Test Recipe",
        "protein_ids": [],
        "meal_type_ids": [],
        "servings": 2,
        "instructions": {"prep": [], "cook": []},
        "ingredients": [],
        "reference_links": []
    }
    resp = await client.post("/recipes/", json=recipe_data, headers=auth_headers)
    assert resp.status_code == 201, resp.json()
    recipe_id = resp.json()["id"]

    # Create log
    log_data = {
        "cooked_date": str(date.today()),
        "rating": 4,
        "notes": "Original notes"
    }
    resp = await client.post(f"/recipes/{recipe_id}/logs", json=log_data, headers=auth_headers)
    log_id = resp.json()["id"]
    assert resp.status_code == 201

    # Update log
    update_data = {
        "cooked_date": str(date.today()),
        "rating": 5,
        "notes": "Updated notes"
    }
    resp = await client.put(f"/recipes/logs/{log_id}", json=update_data, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["rating"] == 5
    assert resp.json()["notes"] == "Updated notes"

    # Update to another date
    other_date = str(date.today() - timedelta(days=1))
    update_data["cooked_date"] = other_date
    resp = await client.put(f"/recipes/logs/{log_id}", json=update_data, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["cooked_date"] == other_date

    # Delete log
    resp = await client.delete(f"/recipes/logs/{log_id}", headers=auth_headers)
    assert resp.status_code == 204

    # Verify deletion
    resp = await client.get(f"/recipes/{recipe_id}/logs")
    assert len(resp.json()) == 0

@pytest.mark.asyncio
async def test_max_length_constraints(client: AsyncClient, auth_headers: dict):
    # Title too long
    long_title = "A" * 256
    recipe_data = {
        "title": long_title,
        "protein_ids": [],
        "meal_type_ids": [],
        "servings": 2,
        "instructions": {"prep": [], "cook": []},
        "ingredients": [],
        "reference_links": []
    }
    resp = await client.post("/recipes/", json=recipe_data, headers=auth_headers)
    assert resp.status_code == 422 # Pydantic validation error
