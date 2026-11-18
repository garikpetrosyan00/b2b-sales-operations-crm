# ruff: noqa: E402

import os
from collections.abc import AsyncGenerator

os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-that-is-long-enough-for-jwt-tests"

import pytest
import pytest_asyncio
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.user import User, UserRole
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

engine = create_async_engine("sqlite+aiosqlite:///:memory:")
TestSession = async_sessionmaker(engine, expire_on_commit=False)


@pytest.fixture
def session_factory() -> async_sessionmaker[AsyncSession]:
    return TestSession


async def override_get_db() -> AsyncGenerator[AsyncSession]:
    async with TestSession() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(autouse=True)
async def reset_database() -> AsyncGenerator[None]:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with TestSession() as db:
        db.add(
            User(
                email="admin@example.com",
                full_name="Demo Administrator",
                hashed_password=hash_password("correct-horse-battery-staple"),
                role=UserRole.ADMIN,
            )
        )
        await db.commit()
    yield
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient]:
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as test_client:
        yield test_client
