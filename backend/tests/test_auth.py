import pytest
from httpx import AsyncClient

LOGIN_PAYLOAD = {
    "email": "admin@example.com",
    "password": "correct-horse-battery-staple",
}


@pytest.mark.asyncio
async def test_login_returns_access_token_and_sets_refresh_cookie(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/login", json=LOGIN_PAYLOAD)

    assert response.status_code == 200
    payload = response.json()
    assert payload["token_type"] == "bearer"
    assert payload["user"]["role"] == "admin"
    assert "access_token" in payload
    assert "crm_refresh" not in payload
    assert "crm_refresh" in response.cookies
    assert "HttpOnly" in response.headers["set-cookie"]


@pytest.mark.asyncio
async def test_login_rejects_invalid_password_with_consistent_error(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/login", json={**LOGIN_PAYLOAD, "password": "wrong-password"}
    )

    assert response.status_code == 401
    assert response.json() == {
        "error": {"code": "http_401", "message": "Invalid email or password", "details": None}
    }


@pytest.mark.asyncio
async def test_refresh_rotates_session_and_logout_revokes_it(client: AsyncClient) -> None:
    login_response = await client.post("/api/v1/auth/login", json=LOGIN_PAYLOAD)
    original_cookie = login_response.cookies["crm_refresh"]

    refresh_response = await client.post("/api/v1/auth/refresh")
    assert refresh_response.status_code == 200
    rotated_cookie = refresh_response.cookies["crm_refresh"]
    assert rotated_cookie != original_cookie

    logout_response = await client.post("/api/v1/auth/logout")
    assert logout_response.status_code == 200
    assert logout_response.json() == {"message": "Logged out successfully"}

    client.cookies.set("crm_refresh", rotated_cookie, path="/api/v1/auth")
    rejected_response = await client.post("/api/v1/auth/refresh")
    assert rejected_response.status_code == 401


@pytest.mark.asyncio
async def test_current_user_requires_valid_access_token(client: AsyncClient) -> None:
    unauthorized = await client.get("/api/v1/users/me")
    assert unauthorized.status_code == 401

    login_response = await client.post("/api/v1/auth/login", json=LOGIN_PAYLOAD)
    token = login_response.json()["access_token"]
    authorized = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})

    assert authorized.status_code == 200
    assert authorized.json()["email"] == LOGIN_PAYLOAD["email"]
