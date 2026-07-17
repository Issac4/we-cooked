import pytest
from httpx import AsyncClient
import uuid

@pytest.mark.asyncio
async def test_update_protein(client: AsyncClient, auth_headers: dict):
    # Create one
    name1 = f"Protein_{uuid.uuid4().hex[:8]}"
    resp = await client.post("/proteins/", json={"name": name1}, headers=auth_headers)
    p1 = resp.json()
    
    # Rename it
    name2 = f"Protein_{uuid.uuid4().hex[:8]}"
    resp = await client.put(f"/proteins/{p1['id']}", json={"name": name2}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == name2

    # Try renaming to an existing name
    name3 = f"Protein_{uuid.uuid4().hex[:8]}"
    await client.post("/proteins/", json={"name": name3}, headers=auth_headers)
    
    resp = await client.put(f"/proteins/{p1['id']}", json={"name": name3}, headers=auth_headers)
    assert resp.status_code == 400
    assert "already exists" in resp.json()["detail"]

@pytest.mark.asyncio
async def test_delete_protein_success(client: AsyncClient, auth_headers: dict):
    name = f"Protein_{uuid.uuid4().hex[:8]}"
    resp = await client.post("/proteins/", json={"name": name}, headers=auth_headers)
    p = resp.json()
    
    resp = await client.delete(f"/proteins/{p['id']}", headers=auth_headers)
    assert resp.status_code == 204

@pytest.mark.asyncio
async def test_delete_protein_blocked(client: AsyncClient, auth_headers: dict):
    # Create protein
    name = f"Protein_{uuid.uuid4().hex[:8]}"
    resp = await client.post("/proteins/", json={"name": name}, headers=auth_headers)
    p_id = resp.json()["id"]
    
    # Create recipe using it
    recipe = {
        "title": "Blocked Delete Test",
        "protein_ids": [p_id],
        "meal_type_ids": [],
        "instructions": {"prep": [], "cook": []},
        "ingredients": [],
        "reference_links": [],
        "attributes": {}
    }
    await client.post("/recipes/", json=recipe, headers=auth_headers)
    
    # Try to delete protein
    resp = await client.delete(f"/proteins/{p_id}", headers=auth_headers)
    assert resp.status_code == 400
    assert "linked to one or more recipes" in resp.json()["detail"]

# --- MEAL TYPES ---

@pytest.mark.asyncio
async def test_update_meal_type(client: AsyncClient, auth_headers: dict):
    # Create one
    name1 = f"MT_{uuid.uuid4().hex[:8]}"
    resp = await client.post("/meal-types/", json={"name": name1}, headers=auth_headers)
    mt1 = resp.json()
    
    # Rename it
    name2 = f"MT_{uuid.uuid4().hex[:8]}"
    resp = await client.put(f"/meal-types/{mt1['id']}", json={"name": name2}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == name2

@pytest.mark.asyncio
async def test_delete_meal_type_blocked(client: AsyncClient, auth_headers: dict):
    # Create meal type
    name = f"MT_{uuid.uuid4().hex[:8]}"
    resp = await client.post("/meal-types/", json={"name": name}, headers=auth_headers)
    mt_id = resp.json()["id"]
    
    # Create protein (needed for recipe)
    p_name = f"Temp_{uuid.uuid4().hex[:8]}"
    resp = await client.post("/proteins/", json={"name": p_name}, headers=auth_headers)
    p_id = resp.json()["id"]

    # Create recipe using it
    recipe = {
        "title": "MT Blocked Delete Test",
        "protein_ids": [p_id],
        "meal_type_ids": [mt_id],
        "instructions": {"prep": [], "cook": []},
        "ingredients": [],
        "reference_links": [],
        "attributes": {}
    }
    await client.post("/recipes/", json=recipe, headers=auth_headers)
    
    # Try to delete meal type
    resp = await client.delete(f"/meal-types/{mt_id}", headers=auth_headers)
    assert resp.status_code == 400
    assert "linked to one or more recipes" in resp.json()["detail"]
