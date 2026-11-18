import pytest
from app.api.dependencies import require_roles
from app.models.user import User, UserRole
from fastapi import HTTPException


def make_user(role: UserRole) -> User:
    return User(
        email=f"{role.value}@example.com",
        full_name=role.value,
        hashed_password="unused-in-rbac-test",
        role=role,
    )


@pytest.mark.asyncio
async def test_role_guard_allows_configured_role() -> None:
    guard = require_roles(UserRole.ADMIN, UserRole.MANAGER)
    manager = make_user(UserRole.MANAGER)

    assert await guard(manager) is manager


@pytest.mark.asyncio
async def test_role_guard_denies_unconfigured_role() -> None:
    guard = require_roles(UserRole.ADMIN, UserRole.MANAGER)

    with pytest.raises(HTTPException) as exc_info:
        await guard(make_user(UserRole.SALES_AGENT))

    assert exc_info.value.status_code == 403
