import pytest
from app.core.config import Settings
from pydantic import ValidationError

BASE_SETTINGS = {
    "database_url": "sqlite+aiosqlite:///:memory:",
    "jwt_secret_key": "configuration-test-secret-that-is-long-enough",
}


def test_production_requires_secure_refresh_cookie() -> None:
    with pytest.raises(ValidationError, match="must be true in production"):
        Settings(
            **BASE_SETTINGS,
            app_env="production",
            refresh_cookie_secure=False,
            _env_file=None,
        )


def test_samesite_none_requires_secure_refresh_cookie() -> None:
    with pytest.raises(ValidationError, match="SameSite=None requires"):
        Settings(
            **BASE_SETTINGS,
            app_env="development",
            refresh_cookie_samesite="none",
            refresh_cookie_secure=False,
            _env_file=None,
        )


def test_production_accepts_secure_refresh_cookie() -> None:
    settings = Settings(
        **BASE_SETTINGS,
        app_env="production",
        refresh_cookie_secure=True,
        _env_file=None,
    )
    assert settings.refresh_cookie_secure is True
