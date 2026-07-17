import pytest
from httpx import AsyncClient

# --- AUTHENTICATION FLOW ---

@pytest.mark.asyncio
async def test_register_success(client: AsyncClient, unique_user_data: dict, admin_auth_headers: dict):
    response = await client.post("/auth/register", json=unique_user_data, headers=admin_auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["username"] == unique_user_data["username"]
    assert data["email"] == unique_user_data["email"]
    assert "id" in data

@pytest.mark.asyncio
async def test_register_failure_duplicate(client: AsyncClient, unique_user_data: dict, admin_auth_headers: dict):
    # Register once
    await client.post("/auth/register", json=unique_user_data, headers=admin_auth_headers)
    # Register again with same data
    response = await client.post("/auth/register", json=unique_user_data, headers=admin_auth_headers)
    assert response.status_code == 400
    assert "already registered" in response.json()["detail"]

@pytest.mark.asyncio
async def test_register_public_denied(client: AsyncClient, unique_user_data: dict):
    # Public signups without token should be blocked with 401
    response = await client.post("/auth/register", json=unique_user_data)
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_register_non_admin_denied(client: AsyncClient, unique_user_data: dict, auth_headers: dict):
    # Non-admin users should be blocked with 403
    response = await client.post("/auth/register", json=unique_user_data, headers=auth_headers)
    assert response.status_code == 403

@pytest.mark.asyncio
async def test_register_oversized_password(client: AsyncClient, unique_user_data: dict, admin_auth_headers: dict):
    # Set password to 129 characters (greater than max_length=128)
    unique_user_data["password"] = "a" * 129
    response = await client.post("/auth/register", json=unique_user_data, headers=admin_auth_headers)
    assert response.status_code == 422

@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, unique_user_data: dict, admin_auth_headers: dict):
    # Register using admin credentials
    await client.post("/auth/register", json=unique_user_data, headers=admin_auth_headers)
    # Login
    login_data = {
        "username": unique_user_data["username"],
        "password": unique_user_data["password"]
    }
    response = await client.post("/auth/token", data=login_data)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

@pytest.mark.asyncio
async def test_login_failure_wrong_password(client: AsyncClient, unique_user_data: dict, admin_auth_headers: dict):
    # Register using admin credentials
    await client.post("/auth/register", json=unique_user_data, headers=admin_auth_headers)
    # Login with wrong password
    login_data = {
        "username": unique_user_data["username"],
        "password": "wrongpassword"
    }
    response = await client.post("/auth/token", data=login_data)
    assert response.status_code == 401
    assert "Incorrect username or password" in response.json()["detail"]

@pytest.mark.asyncio
async def test_login_failure_non_existent_user(client: AsyncClient):
    login_data = {
        "username": "nonexistentuser",
        "password": "password"
    }
    response = await client.post("/auth/token", data=login_data)
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_get_current_user_verification(client: AsyncClient, auth_headers: dict):
    # Valid token (using auth_headers fixture)
    response = await client.get("/recipes/", headers=auth_headers)
    assert response.status_code == 200

    # Invalid token
    bad_headers = {"Authorization": "Bearer invalidtoken"}
    response = await client.get("/recipes/", headers=bad_headers)
    # Note: /recipes/ GET is actually public, but let's try a POST which is protected
    response = await client.post("/recipes/", json={}, headers=bad_headers)
    assert response.status_code == 401

# --- RECIPE CRUD (EDGE CASES) ---

@pytest.mark.asyncio
async def test_get_non_existent_recipe(client: AsyncClient):
    response = await client.get("/recipes/999999")
    assert response.status_code == 404
    assert "Recipe not found" in response.json()["detail"]

@pytest.mark.asyncio
async def test_create_recipe_invalid_protein(client: AsyncClient, auth_headers: dict):
    new_recipe = {
        "title": "Invalid Protein Recipe",
        "protein_ids": [999],
        "meal_type_ids": [1],
        "instructions": {"prep": [], "cook": []},
        "ingredients": [],
        "reference_links": [],
        "attributes": {}
    }
    response = await client.post("/recipes/", json=new_recipe, headers=auth_headers)
    assert response.status_code == 400
    assert "Protein ID 999 not found" in response.json()["detail"]

@pytest.mark.asyncio
async def test_create_recipe_invalid_meal_type(client: AsyncClient, auth_headers: dict):
    new_recipe = {
        "title": "Invalid Meal Type Recipe",
        "protein_ids": [1],
        "meal_type_ids": [999],
        "instructions": {"prep": [], "cook": []},
        "ingredients": [],
        "reference_links": [],
        "attributes": {}
    }
    response = await client.post("/recipes/", json=new_recipe, headers=auth_headers)
    assert response.status_code == 400
    assert "MealType ID 999 not found" in response.json()["detail"]

@pytest.mark.asyncio
async def test_create_recipe_title_too_long(client: AsyncClient, auth_headers: dict):
    new_recipe = {
        "title": "A" * 256,
        "protein_ids": [1],
        "meal_type_ids": [1],
        "instructions": {"prep": [], "cook": []},
        "ingredients": [],
        "reference_links": [],
        "attributes": {}
    }
    response = await client.post("/recipes/", json=new_recipe, headers=auth_headers)
    assert response.status_code == 422
    assert "at most 255 characters" in response.text

@pytest.mark.asyncio
async def test_update_recipe_title_too_long(client: AsyncClient, auth_headers: dict):
    initial_recipe = {
        "title": "Normal Recipe",
        "protein_ids": [1],
        "meal_type_ids": [1],
        "instructions": {"prep": [], "cook": []},
        "ingredients": [],
        "reference_links": [],
        "attributes": {}
    }
    create_res = await client.post("/recipes/", json=initial_recipe, headers=auth_headers)
    recipe_id = create_res.json()["id"]

    update_data = {
        "title": "A" * 256
    }
    response = await client.put(f"/recipes/{recipe_id}", json=update_data, headers=auth_headers)
    assert response.status_code == 422
    assert "at most 255 characters" in response.text

@pytest.mark.asyncio
async def test_update_recipe_partial(client: AsyncClient, auth_headers: dict):
    # 1. Create a recipe
    initial_recipe = {
        "title": "Initial Title",
        "protein_ids": [1],
        "meal_type_ids": [1],
        "instructions": {"prep": [{"step": 1, "action": "Wait"}], "cook": []},
        "ingredients": [{"item": "Water", "amount": "1L"}],
        "reference_links": [],
        "attributes": {}
    }
    create_res = await client.post("/recipes/", json=initial_recipe, headers=auth_headers)
    recipe_id = create_res.json()["id"]

    # 2. Partial update (only title)
    update_data = {"title": "Updated Title"}
    update_res = await client.put(f"/recipes/{recipe_id}", json=update_data, headers=auth_headers)
    assert update_res.status_code == 200
    data = update_res.json()
    assert data["title"] == "Updated Title"
    # Verify ingredients remain unchanged
    assert len(data["ingredients"]) == 1
    assert data["ingredients"][0]["item"] == "Water"
    # Verify instructions remain unchanged
    assert len(data["instructions"]["prep"]) == 1

@pytest.mark.asyncio
async def test_update_recipe_meal_types(client: AsyncClient, auth_headers: dict):
    # 1. Create a recipe with meal type 1
    initial_recipe = {
        "title": "Meal Type Test",
        "protein_ids": [1],
        "meal_type_ids": [1],
        "instructions": {"prep": [], "cook": []},
        "ingredients": [],
        "reference_links": [],
        "attributes": {}
    }
    create_res = await client.post("/recipes/", json=initial_recipe, headers=auth_headers)
    recipe_id = create_res.json()["id"]
    assert create_res.json()["meal_types"] == ["Breakfast"] # Assuming 1 is Breakfast

    # 2. Update meal types to [3] (Lunch)
    update_data = {"meal_type_ids": [3]}
    update_res = await client.put(f"/recipes/{recipe_id}", json=update_data, headers=auth_headers)
    assert update_res.status_code == 200
    assert update_res.json()["meal_types"] == ["Lunch"]

@pytest.mark.asyncio
async def test_recipe_unauthorized_access(client: AsyncClient):
    recipe_data = {
        "title": "Unauthorized Recipe",
        "protein_ids": [1],
        "meal_type_ids": [1],
        "instructions": {"prep": [], "cook": []},
        "ingredients": [],
        "reference_links": [],
        "attributes": {}
    }
    # POST without token
    response = await client.post("/recipes/", json=recipe_data)
    assert response.status_code == 401

    # PUT without token
    response = await client.put("/recipes/1", json=recipe_data)
    assert response.status_code == 401

    # DELETE without token
    response = await client.delete("/recipes/1")
    assert response.status_code == 401

# --- LOOKUP ENDPOINTS ---

@pytest.mark.asyncio
async def test_get_proteins(client: AsyncClient):
    response = await client.get("/proteins/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 0:
        assert "name" in data[0]
        assert "id" in data[0]

@pytest.mark.asyncio
async def test_get_meal_types(client: AsyncClient):
    response = await client.get("/meal-types/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 0:
        assert "name" in data[0]
        assert "id" in data[0]

# --- DATA INTEGRITY ---

@pytest.mark.asyncio
async def test_recipe_deletion_integrity(client: AsyncClient, auth_headers: dict):
    # 1. Create recipe
    recipe_data = {
        "title": "Integrity Test",
        "protein_ids": [1],
        "meal_type_ids": [1],
        "instructions": {"prep": [], "cook": []},
        "ingredients": [],
        "reference_links": [],
        "attributes": {}
    }
    create_res = await client.post("/recipes/", json=recipe_data, headers=auth_headers)
    recipe_id = create_res.json()["id"]

    # 2. Delete recipe
    delete_res = await client.delete(f"/recipes/{recipe_id}", headers=auth_headers)
    assert delete_res.status_code == 204

    # 3. Verify recipe is gone
    get_res = await client.get(f"/recipes/{recipe_id}")
    assert get_res.status_code == 404

@pytest.mark.asyncio
async def test_recipe_filtering_logic(client: AsyncClient, auth_headers: dict):
    """Verify (Protein A OR B) AND (Meal Type 1 OR 2) logic."""
    # We assume protein 1, 2 and meal types 1, 2 exist from migrations
    # Create 4 recipes to test intersections:
    recipes = [
        {"title": "Match 1", "protein_ids": [1], "meal_type_ids": [1]},
        {"title": "Match 2", "protein_ids": [2], "meal_type_ids": [2]},
        {"title": "Fail Protein", "protein_ids": [3], "meal_type_ids": [1]},
        {"title": "Fail MealType", "protein_ids": [1], "meal_type_ids": [3]},
    ]
    
    for r in recipes:
        await client.post("/recipes/", json={
            **r,
            "instructions": {"prep": [], "cook": []},
            "ingredients": [],
            "reference_links": [],
            "attributes": {}
        }, headers=auth_headers)

@pytest.mark.asyncio
async def test_recipe_search(client: AsyncClient, auth_headers: dict):
    """Verify searching recipes by title."""
    # 1. Create a specific recipe
    await client.post("/recipes/", json={
        "title": "Searchable Cake",
        "protein_ids": [1],
        "meal_type_ids": [1],
        "instructions": {"prep": [], "cook": []},
        "ingredients": [],
        "reference_links": [],
        "attributes": {}
    }, headers=auth_headers)

    # 2. Search for it
    response = await client.get("/recipes/?search=Cake")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert any(r["title"] == "Searchable Cake" for r in data)

    # 3. Search for something that doesn't exist
    response = await client.get("/recipes/?search=NonExistentThing")
    assert response.status_code == 200
    assert len(response.json()) == 0

    # Filter: Proteins [1, 2] AND Meal Types [1, 2]
    # Should return "Match 1" and "Match 2"
    # Using multiple query params for the lists
    res = await client.get("/recipes/?protein_ids=1&protein_ids=2&meal_type_ids=1&meal_type_ids=2")
    assert res.status_code == 200
    data = res.json()
    titles = [r["title"] for r in data]
    
    assert "Match 1" in titles
    assert "Match 2" in titles
    assert "Fail Protein" not in titles
    assert "Fail MealType" not in titles
