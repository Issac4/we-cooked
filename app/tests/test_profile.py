import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_update_profile_success(client: AsyncClient, unique_user_data: dict, admin_auth_headers: dict):
    # Register unique user using admin credentials
    reg_response = await client.post("/auth/register", json=unique_user_data, headers=admin_auth_headers)
    assert reg_response.status_code == 201
    
    # Login
    login_data = {
        "username": unique_user_data["username"],
        "password": unique_user_data["password"]
    }
    login_response = await client.post("/auth/token", data=login_data)
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Update profile
    new_username = f"updated_{unique_user_data['username']}"
    new_email = f"updated_{unique_user_data['email']}"
    update_data = {
        "username": new_username,
        "email": new_email,
        "current_password": unique_user_data["password"],
        "new_password": "new_testpassword"
    }
    response = await client.put("/auth/profile", json=update_data, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == new_username
    assert data["email"] == new_email
    
    # Verify we can login with the new credentials
    login_data_new = {
        "username": new_username,
        "password": "new_testpassword"
    }
    response_login = await client.post("/auth/token", data=login_data_new)
    assert response_login.status_code == 200
    assert "access_token" in response_login.json()

@pytest.mark.asyncio
async def test_update_profile_wrong_password(client: AsyncClient, unique_user_data: dict, admin_auth_headers: dict):
    # Register unique user
    await client.post("/auth/register", json=unique_user_data, headers=admin_auth_headers)
    
    # Login
    login_data = {
        "username": unique_user_data["username"],
        "password": unique_user_data["password"]
    }
    login_response = await client.post("/auth/token", data=login_data)
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    update_data = {
        "username": "another_username",
        "current_password": "wrongpassword"
    }
    response = await client.put("/auth/profile", json=update_data, headers=headers)
    assert response.status_code == 400
    assert "Incorrect current password" in response.json()["detail"]

@pytest.mark.asyncio
async def test_update_profile_duplicate_username(client: AsyncClient, unique_user_data: dict, admin_auth_headers: dict):
    # Register first user
    await client.post("/auth/register", json=unique_user_data, headers=admin_auth_headers)
    
    # Register second user (unique_id generates dynamic data, so we construct a new dict)
    unique_user_2 = {
        "username": unique_user_data["username"] + "_two",
        "email": "two_" + unique_user_data["email"],
        "password": "testpassword"
    }
    await client.post("/auth/register", json=unique_user_2, headers=admin_auth_headers)
    
    # Login first user
    login_data = {
        "username": unique_user_data["username"],
        "password": unique_user_data["password"]
    }
    login_response = await client.post("/auth/token", data=login_data)
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Attempt to change first user's username to second user's username
    update_data = {
        "username": unique_user_2["username"],
        "current_password": unique_user_data["password"]
    }
    response = await client.put("/auth/profile", json=update_data, headers=headers)
    assert response.status_code == 400
    assert "Username already taken" in response.json()["detail"]

@pytest.mark.asyncio
async def test_update_profile_short_password(client: AsyncClient, unique_user_data: dict, admin_auth_headers: dict):
    # Register
    await client.post("/auth/register", json=unique_user_data, headers=admin_auth_headers)
    
    # Login
    login_data = {
        "username": unique_user_data["username"],
        "password": unique_user_data["password"]
    }
    login_response = await client.post("/auth/token", data=login_data)
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    update_data = {
        "new_password": "123",
        "current_password": unique_user_data["password"]
    }
    response = await client.put("/auth/profile", json=update_data, headers=headers)
    assert response.status_code == 400
    assert "New password must be at least 6 characters" in response.json()["detail"]
