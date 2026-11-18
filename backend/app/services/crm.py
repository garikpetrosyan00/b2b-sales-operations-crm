import math
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.crm import Company, Contact, Deal, DealStageHistory, Lead, LeadStatus, PipelineStage
from app.models.user import User, UserRole
from app.schemas.crm import (
    ContactCreate,
    DealCreate,
    DealRead,
    LeadConvert,
    LeadCreate,
    LeadRead,
)

MANAGER_ROLES = {UserRole.ADMIN, UserRole.MANAGER}
DEAL_LOADS = (
    selectinload(Deal.company),
    selectinload(Deal.primary_contact),
    selectinload(Deal.owner),
    selectinload(Deal.stage),
)
LEAD_LOADS = (
    selectinload(Lead.company),
    selectinload(Lead.primary_contact),
    selectinload(Lead.owner),
)


def utcnow() -> datetime:
    return datetime.now(UTC)


def aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def ensure_owner_access(user: User, owner_id: UUID) -> None:
    if user.role not in MANAGER_ROLES and user.id != owner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="This record belongs to another owner"
        )


async def get_company_or_404(db: AsyncSession, company_id: UUID) -> Company:
    company = await db.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


async def get_contact_or_404(db: AsyncSession, contact_id: UUID) -> Contact:
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id).options(selectinload(Contact.company))
    )
    contact = result.scalar_one_or_none()
    if contact is None:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


async def get_stage_or_404(
    db: AsyncSession, stage_id: UUID, *, active: bool = False
) -> PipelineStage:
    stage = await db.get(PipelineStage, stage_id)
    if stage is None or (active and not stage.is_active):
        raise HTTPException(status_code=404, detail="Active pipeline stage not found")
    return stage


async def validate_contact_company(
    db: AsyncSession, company_id: UUID, contact_id: UUID
) -> tuple[Company, Contact]:
    company = await get_company_or_404(db, company_id)
    contact = await get_contact_or_404(db, contact_id)
    if contact.company_id != company_id:
        raise HTTPException(
            status_code=422, detail="Contact does not belong to the selected company"
        )
    return company, contact


def lead_read(lead: Lead) -> LeadRead:
    return LeadRead(
        id=lead.id,
        company_id=lead.company_id,
        primary_contact_id=lead.primary_contact_id,
        owner_id=lead.owner_id,
        source=lead.source,
        status=lead.status,
        estimated_value=lead.estimated_value,
        priority=lead.priority,
        next_follow_up_at=lead.next_follow_up_at,
        notes=lead.notes,
        company_name=lead.company.name,
        contact_name=f"{lead.primary_contact.first_name} {lead.primary_contact.last_name}",
        contact_email=lead.primary_contact.work_email,
        owner_name=lead.owner.full_name,
        created_at=lead.created_at,
        updated_at=lead.updated_at,
    )


def deal_read(deal: Deal, *, now: datetime | None = None) -> DealRead:
    current_time = now or utcnow()
    entered = aware(deal.stage_entered_at)
    sla_breached = (
        not deal.stage.is_terminal
        and (current_time - entered).total_seconds() > deal.stage.sla_hours * 3600
    )
    return DealRead(
        id=deal.id,
        title=deal.title,
        company_id=deal.company_id,
        primary_contact_id=deal.primary_contact_id,
        owner_id=deal.owner_id,
        stage_id=deal.stage_id,
        source_lead_id=deal.source_lead_id,
        value=deal.value,
        currency=deal.currency,
        probability=deal.probability,
        expected_close_date=deal.expected_close_date,
        last_activity_at=deal.last_activity_at,
        loss_reason=deal.loss_reason,
        notes=deal.notes,
        company_name=deal.company.name,
        contact_name=f"{deal.primary_contact.first_name} {deal.primary_contact.last_name}",
        owner_name=deal.owner.full_name,
        stage_name=deal.stage.name,
        stage_color=deal.stage.color,
        stage_entered_at=deal.stage_entered_at,
        sla_breached=sla_breached,
        created_at=deal.created_at,
        updated_at=deal.updated_at,
    )


async def create_contact(db: AsyncSession, payload: ContactCreate) -> Contact:
    await get_company_or_404(db, payload.company_id)
    duplicate = await db.scalar(
        select(Contact.id).where(func.lower(Contact.work_email) == payload.work_email.lower())
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="A contact with this email already exists")
    contact = Contact(**payload.model_dump())
    db.add(contact)
    await db.commit()
    return await get_contact_or_404(db, contact.id)


async def get_lead_or_404(db: AsyncSession, lead_id: UUID) -> Lead:
    result = await db.execute(select(Lead).where(Lead.id == lead_id).options(*LEAD_LOADS))
    lead = result.scalar_one_or_none()
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


async def create_lead(db: AsyncSession, payload: LeadCreate, user: User) -> Lead:
    ensure_owner_access(user, payload.owner_id)
    await validate_contact_company(db, payload.company_id, payload.primary_contact_id)
    lead = Lead(**payload.model_dump())
    db.add(lead)
    await db.commit()
    return await get_lead_or_404(db, lead.id)


async def list_leads(
    db: AsyncSession,
    user: User,
    *,
    page: int,
    page_size: int,
    search: str | None,
    lead_status: str | None,
    source: str | None,
    priority: str | None,
    owner_id: UUID | None,
    sort: str,
) -> tuple[list[Lead], int]:
    filters = []
    if user.role not in MANAGER_ROLES:
        filters.append(Lead.owner_id == user.id)
    elif owner_id:
        filters.append(Lead.owner_id == owner_id)
    if lead_status:
        filters.append(Lead.status == lead_status)
    if source:
        filters.append(Lead.source == source)
    if priority:
        filters.append(Lead.priority == priority)
    if search:
        needle = f"%{search.strip().lower()}%"
        filters.append(
            or_(func.lower(Company.name).like(needle), func.lower(Contact.work_email).like(needle))
        )
    base = select(Lead).join(Lead.company).join(Lead.primary_contact).where(*filters)
    total = await db.scalar(select(func.count()).select_from(base.subquery())) or 0
    ordering = {
        "created_at": Lead.created_at.desc(),
        "value": Lead.estimated_value.desc(),
        "follow_up": Lead.next_follow_up_at.asc().nulls_last(),
        "company": Company.name.asc(),
    }.get(sort, Lead.created_at.desc())
    result = await db.execute(
        base.options(*LEAD_LOADS).order_by(ordering).offset((page - 1) * page_size).limit(page_size)
    )
    return list(result.scalars().unique()), total


async def get_deal_or_404(db: AsyncSession, deal_id: UUID) -> Deal:
    result = await db.execute(select(Deal).where(Deal.id == deal_id).options(*DEAL_LOADS))
    deal = result.scalar_one_or_none()
    if deal is None:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


async def create_deal(db: AsyncSession, payload: DealCreate, user: User) -> Deal:
    ensure_owner_access(user, payload.owner_id)
    await validate_contact_company(db, payload.company_id, payload.primary_contact_id)
    stage = await get_stage_or_404(db, payload.stage_id, active=True)
    data = payload.model_dump()
    data["probability"] = (
        payload.probability if payload.probability is not None else stage.probability
    )
    deal = Deal(**data)
    db.add(deal)
    await db.commit()
    return await get_deal_or_404(db, deal.id)


async def convert_lead(db: AsyncSession, lead: Lead, payload: LeadConvert, user: User) -> Deal:
    ensure_owner_access(user, lead.owner_id)
    if lead.status in {LeadStatus.CONVERTED, LeadStatus.UNQUALIFIED}:
        raise HTTPException(status_code=409, detail="This lead cannot be converted")
    stage = await db.scalar(
        select(PipelineStage)
        .where(PipelineStage.is_active.is_(True), PipelineStage.is_terminal.is_(False))
        .order_by(PipelineStage.display_order)
        .limit(1)
    )
    if stage is None:
        raise HTTPException(status_code=409, detail="No active pipeline stage is configured")
    deal = Deal(
        title=payload.title,
        company_id=lead.company_id,
        primary_contact_id=lead.primary_contact_id,
        owner_id=lead.owner_id,
        stage_id=stage.id,
        source_lead_id=lead.id,
        value=payload.value if payload.value is not None else lead.estimated_value,
        currency=payload.currency,
        probability=stage.probability,
        expected_close_date=payload.expected_close_date,
    )
    lead.status = LeadStatus.CONVERTED
    db.add(deal)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return await get_deal_or_404(db, deal.id)


async def transition_deal(
    db: AsyncSession, deal: Deal, new_stage: PipelineStage, user: User
) -> Deal:
    ensure_owner_access(user, deal.owner_id)
    if deal.stage_id == new_stage.id:
        return deal
    changed_at = utcnow()
    history = DealStageHistory(
        deal_id=deal.id,
        previous_stage_id=deal.stage_id,
        new_stage_id=new_stage.id,
        changed_by_id=user.id,
        changed_at=changed_at,
        time_spent_seconds=max(0, int((changed_at - aware(deal.stage_entered_at)).total_seconds())),
    )
    deal.stage_id = new_stage.id
    deal.stage = new_stage
    deal.stage_entered_at = changed_at
    deal.probability = new_stage.probability
    db.add(history)
    await db.commit()
    return await get_deal_or_404(db, deal.id)


def page_count(total: int, page_size: int) -> int:
    return max(1, math.ceil(total / page_size))
