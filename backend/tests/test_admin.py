import pytest
from app.models.user import User
from scripts.create_admin import create_admin
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker


@pytest.mark.asyncio
async def test_create_admin_successfully(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    messages: list[str] = []
    result = await create_admin(
        "New.Admin@Example.com",
        "  New   Administrator  ",
        "a-secure-admin-password",
        session_factory=session_factory,
        output=messages.append,
    )

    assert result == "created"
    async with session_factory() as db:
        user = await db.scalar(select(User).where(User.email == "new.admin@example.com"))
    assert user is not None
    assert user.full_name == "New Administrator"
    assert messages == ["Created admin user new.admin@example.com"]


@pytest.mark.asyncio
async def test_create_admin_rejects_invalid_email(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    with pytest.raises(ValueError, match="valid deliverable email"):
        await create_admin(
            "not-an-email",
            "Administrator",
            "a-secure-admin-password",
            session_factory=session_factory,
        )


@pytest.mark.asyncio
async def test_create_admin_rejects_empty_full_name(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    with pytest.raises(ValueError, match="must not be empty"):
        await create_admin(
            "new.admin@example.com",
            "   ",
            "a-secure-admin-password",
            session_factory=session_factory,
        )


@pytest.mark.asyncio
async def test_create_admin_is_idempotent(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    messages: list[str] = []
    result = await create_admin(
        "ADMIN@example.com",
        "Replacement Name",
        "a-different-secure-password",
        session_factory=session_factory,
        output=messages.append,
    )

    assert result == "already_exists"
    async with session_factory() as db:
        user = await db.scalar(select(User).where(User.email == "admin@example.com"))
    assert user is not None
    assert user.full_name == "Demo Administrator"
    assert messages == ["Admin user admin@example.com already exists; no changes made"]
