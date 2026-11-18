from fastapi import APIRouter
from sqlalchemy import select

from app.api.dependencies import CurrentUser, DBSession
from app.models.user import User
from app.schemas.user import UserRead

router = APIRouter()


@router.get("", response_model=list[UserRead])
async def list_active_users(db: DBSession, _: CurrentUser) -> list[User]:
    result = await db.execute(select(User).where(User.is_active.is_(True)).order_by(User.full_name))
    return list(result.scalars())


@router.get("/me", response_model=UserRead)
async def read_current_user(current_user: CurrentUser) -> UserRead:
    return UserRead.model_validate(current_user)
