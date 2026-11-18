from fastapi import APIRouter, Cookie, HTTPException, Response, status

from app.api.dependencies import DBSession
from app.core.config import settings
from app.core.security import TokenError
from app.schemas.auth import LoginRequest, LogoutResponse, TokenResponse
from app.schemas.user import UserRead
from app.services.auth import (
    AuthenticationError,
    authenticate_user,
    create_session,
    revoke_session,
    rotate_session,
)

router = APIRouter()
REFRESH_COOKIE = "crm_refresh"


def set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        httponly=True,
        secure=settings.refresh_cookie_secure,
        samesite=settings.refresh_cookie_samesite,
        domain=settings.refresh_cookie_domain,
        path=f"{settings.api_v1_prefix}/auth",
    )


def token_response(access_token: str, user: UserRead) -> TokenResponse:
    return TokenResponse(
        access_token=access_token,
        expires_in=settings.access_token_expire_minutes * 60,
        user=user,
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, response: Response, db: DBSession) -> TokenResponse:
    try:
        user = await authenticate_user(db, payload.email, payload.password)
        access_token, refresh_token = await create_session(db, user)
    except AuthenticationError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    set_refresh_cookie(response, refresh_token)
    return token_response(access_token, UserRead.model_validate(user))


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    response: Response,
    db: DBSession,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
) -> TokenResponse:
    if refresh_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh session")
    try:
        user, access_token, new_refresh_token = await rotate_session(db, refresh_token)
    except (AuthenticationError, TokenError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh session"
        ) from exc
    set_refresh_cookie(response, new_refresh_token)
    return token_response(access_token, UserRead.model_validate(user))


@router.post("/logout", response_model=LogoutResponse)
async def logout(
    response: Response,
    db: DBSession,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
) -> LogoutResponse:
    if refresh_token is not None:
        await revoke_session(db, refresh_token)
    response.delete_cookie(
        key=REFRESH_COOKIE,
        domain=settings.refresh_cookie_domain,
        path=f"{settings.api_v1_prefix}/auth",
    )
    return LogoutResponse(message="Logged out successfully")
