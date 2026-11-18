from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    token_digest,
    verify_password,
)
from app.models.refresh_session import RefreshSession
from app.models.user import User
from app.services.users import get_user_by_email, get_user_by_id


class AuthenticationError(Exception):
    pass


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    user = await get_user_by_email(db, email)
    if user is None or not verify_password(password, user.hashed_password) or not user.is_active:
        raise AuthenticationError("Invalid email or password")
    return user


async def create_session(db: AsyncSession, user: User) -> tuple[str, str]:
    session_id = uuid4()
    refresh_token = create_refresh_token(user.id, session_id)
    db.add(
        RefreshSession(
            id=session_id,
            user_id=user.id,
            token_hash=token_digest(refresh_token),
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days),
        )
    )
    await db.commit()
    return create_access_token(user.id), refresh_token


async def rotate_session(db: AsyncSession, refresh_token: str) -> tuple[User, str, str]:
    try:
        payload = decode_token(refresh_token, "refresh")
        session_id = UUID(payload["jti"])
        user_id = UUID(payload["sub"])
    except (ValueError, KeyError) as exc:
        raise AuthenticationError("Invalid refresh token") from exc

    session = await db.get(RefreshSession, session_id)
    now = datetime.now(UTC)
    expires_at = session.expires_at if session else now
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if (
        session is None
        or session.user_id != user_id
        or session.revoked_at is not None
        or session.token_hash != token_digest(refresh_token)
        or expires_at <= now
    ):
        raise AuthenticationError("Invalid refresh token")

    user = await get_user_by_id(db, user_id)
    if user is None or not user.is_active:
        raise AuthenticationError("Invalid refresh token")

    session.revoked_at = now
    new_session_id = uuid4()
    new_refresh_token = create_refresh_token(user.id, new_session_id)
    db.add(
        RefreshSession(
            id=new_session_id,
            user_id=user.id,
            token_hash=token_digest(new_refresh_token),
            expires_at=now + timedelta(days=settings.refresh_token_expire_days),
        )
    )
    await db.commit()
    return user, create_access_token(user.id), new_refresh_token


async def revoke_session(db: AsyncSession, refresh_token: str) -> None:
    try:
        payload = decode_token(refresh_token, "refresh")
        session_id = UUID(payload["jti"])
    except (TokenError, ValueError, KeyError):
        return
    session = await db.get(RefreshSession, session_id)
    if session is not None and session.revoked_at is None:
        session.revoked_at = datetime.now(UTC)
        await db.commit()
