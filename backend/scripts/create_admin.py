import asyncio
import getpass
import os
from collections.abc import Callable
from typing import Literal

from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.user import User, UserRole
from app.services.users import get_user_by_email
from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

AdminCreationResult = Literal["created", "already_exists"]
EMAIL_ADAPTER = TypeAdapter(EmailStr)


def validate_admin_input(email: str, full_name: str, password: str) -> tuple[str, str]:
    try:
        normalized_email = str(EMAIL_ADAPTER.validate_python(email.strip())).lower()
    except ValidationError as exc:
        raise ValueError("Admin email must be a valid deliverable email address") from exc

    normalized_name = " ".join(full_name.split())
    if not normalized_name:
        raise ValueError("Admin full name must not be empty")
    if len(normalized_name) > 160:
        raise ValueError("Admin full name must contain at most 160 characters")
    if len(password) < 12:
        raise ValueError("Password must contain at least 12 characters")
    if len(password) > 128:
        raise ValueError("Password must contain at most 128 characters")
    return normalized_email, normalized_name


async def create_admin(
    email: str,
    full_name: str,
    password: str,
    session_factory: async_sessionmaker[AsyncSession] = AsyncSessionLocal,
    output: Callable[[str], None] = print,
) -> AdminCreationResult:
    normalized_email, normalized_name = validate_admin_input(email, full_name, password)

    async with session_factory() as db:
        if await get_user_by_email(db, normalized_email) is not None:
            output(f"Admin user {normalized_email} already exists; no changes made")
            return "already_exists"
        db.add(
            User(
                email=normalized_email,
                full_name=normalized_name,
                hashed_password=hash_password(password),
                role=UserRole.ADMIN,
            )
        )
        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            if await get_user_by_email(db, normalized_email) is not None:
                output(f"Admin user {normalized_email} already exists; no changes made")
                return "already_exists"
            raise RuntimeError("Unable to create admin user") from exc
    output(f"Created admin user {normalized_email}")
    return "created"


def main() -> None:
    email = os.getenv("ADMIN_EMAIL") or input("Admin email: ").strip()
    full_name = os.getenv("ADMIN_FULL_NAME") or input("Admin full name: ").strip()
    password = os.getenv("ADMIN_PASSWORD") or getpass.getpass("Admin password: ")
    try:
        asyncio.run(create_admin(email, full_name, password))
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc


if __name__ == "__main__":
    main()
