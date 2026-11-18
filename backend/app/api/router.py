from fastapi import APIRouter

from app.api.routes import auth, crm, health, operations, users

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(crm.router, tags=["CRM"])
api_router.include_router(operations.router, tags=["Sales operations"])
