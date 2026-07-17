import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_list_users_success(client: AsyncClient, admin_auth_headers: dict):
    response = await client.get("/auth/users", headers=admin_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    # The list should contain at least the seeded admin and test users
    assert len(data) >= 1
    assert any(user["username"] == "admin" for user in data)

@pytest.mark.asyncio
async def test_list_users_forbidden_for_non_admin(client: AsyncClient, auth_headers: dict):
    response = await client.get("/auth/users", headers=auth_headers)
    assert response.status_code == 403
    assert "restricted to administrators" in response.json()["detail"]

@pytest.mark.asyncio
async def test_update_user_status_success(client: AsyncClient, admin_auth_headers: dict, unique_user_data: dict):
    # Register a standard user
    reg_resp = await client.post("/auth/register", json=unique_user_data, headers=admin_auth_headers)
    user_id = reg_resp.json()["id"]
    
    # Deactivate the user
    deactivate_resp = await client.patch(
        f"/auth/users/{user_id}/status", 
        json={"is_active": False}, 
        headers=admin_auth_headers
    )
    assert deactivate_resp.status_code == 200
    assert deactivate_resp.json()["is_active"] is False

    # Standard user login should now fail because they are deactivated
    login_data = {
        "username": unique_user_data["username"],
        "password": unique_user_data["password"]
    }
    login_resp = await client.post("/auth/token", data=login_data)
    assert login_resp.status_code == 400
    assert "account is deactivated" in login_resp.json()["detail"]

@pytest.mark.asyncio
async def test_update_user_status_self_deactivate_prevented(client: AsyncClient, admin_auth_headers: dict):
    # Retrieve our own user details
    me_resp = await client.get("/auth/me", headers=admin_auth_headers)
    my_id = me_resp.json()["id"]
    
    # Attempt self-deactivation
    response = await client.patch(
        f"/auth/users/{my_id}/status",
        json={"is_active": False},
        headers=admin_auth_headers
    )
    assert response.status_code == 400
    assert "cannot deactivate themselves" in response.json()["detail"]

@pytest.mark.asyncio
async def test_reset_user_password_success(client: AsyncClient, admin_auth_headers: dict, unique_user_data: dict):
    # Register standard user
    reg_resp = await client.post("/auth/register", json=unique_user_data, headers=admin_auth_headers)
    user_id = reg_resp.json()["id"]
    
    # Reset password
    reset_resp = await client.patch(
        f"/auth/users/{user_id}/reset-password",
        json={"new_password": "newsuperpassword"},
        headers=admin_auth_headers
    )
    assert reset_resp.status_code == 200
    
    # Verify login with new password
    login_data = {
        "username": unique_user_data["username"],
        "password": "newsuperpassword"
    }
    login_resp = await client.post("/auth/token", data=login_data)
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()

@pytest.mark.asyncio
async def test_admin_recipe_mutations_blocked(client: AsyncClient, admin_auth_headers: dict):
    # Try to create a recipe as admin
    recipe_data = {
        "title": "Admin Created Recipe",
        "protein_ids": [],
        "meal_type_ids": [],
        "instructions": {"prep": [], "cook": []},
        "ingredients": [],
        "reference_links": []
    }
    response = await client.post("/recipes/", json=recipe_data, headers=admin_auth_headers)
    assert response.status_code == 403
    assert "cannot create recipes" in response.json()["detail"]
