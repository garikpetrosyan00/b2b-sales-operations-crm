from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api.dependencies import CurrentUser, DBSession, require_roles
from app.models.crm import (
    Company,
    Contact,
    Deal,
    Lead,
    LeadPriority,
    LeadSource,
    LeadStatus,
    PipelineStage,
)
from app.models.user import User, UserRole
from app.schemas.crm import (
    CompanyCreate,
    CompanyRead,
    CompanyUpdate,
    ContactCreate,
    ContactRead,
    ContactUpdate,
    DashboardSummary,
    DealCreate,
    DealPage,
    DealRead,
    DealUpdate,
    LeadConvert,
    LeadCreate,
    LeadPage,
    LeadRead,
    LeadUpdate,
    PipelineBoard,
    PipelineColumn,
    StageRead,
    StageTransition,
)
from app.services import crm as service

router = APIRouter()
Manager = Annotated[User, Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))]


def company_read(company: Company) -> CompanyRead:
    return CompanyRead.model_validate(company, from_attributes=True)


def contact_read(contact: Contact) -> ContactRead:
    return ContactRead(
        id=contact.id,
        company_id=contact.company_id,
        company_name=contact.company.name,
        first_name=contact.first_name,
        last_name=contact.last_name,
        work_email=contact.work_email,
        phone=contact.phone,
        job_title=contact.job_title,
        created_at=contact.created_at,
        updated_at=contact.updated_at,
    )


@router.get("/companies", response_model=list[CompanyRead])
async def list_companies(
    db: DBSession, _: CurrentUser, search: str | None = None, limit: int = Query(100, ge=1, le=250)
) -> list[CompanyRead]:
    query = select(Company)
    if search:
        query = query.where(func.lower(Company.name).like(f"%{search.strip().lower()}%"))
    result = await db.execute(query.order_by(Company.name).limit(limit))
    return [company_read(company) for company in result.scalars()]


@router.post("/companies", response_model=CompanyRead, status_code=status.HTTP_201_CREATED)
async def create_company(payload: CompanyCreate, db: DBSession, _: Manager) -> CompanyRead:
    company = Company(**payload.model_dump())
    db.add(company)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=409, detail="A company with this name already exists"
        ) from exc
    await db.refresh(company)
    return company_read(company)


@router.patch("/companies/{company_id}", response_model=CompanyRead)
async def update_company(
    company_id: UUID, payload: CompanyUpdate, db: DBSession, _: Manager
) -> CompanyRead:
    company = await service.get_company_or_404(db, company_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(company, field, value)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=409, detail="A company with this name already exists"
        ) from exc
    await db.refresh(company)
    return company_read(company)


@router.get("/contacts", response_model=list[ContactRead])
async def list_contacts(
    db: DBSession,
    _: CurrentUser,
    company_id: UUID | None = None,
    search: str | None = None,
    limit: int = Query(100, ge=1, le=250),
) -> list[ContactRead]:
    query = select(Contact).options(selectinload(Contact.company))
    if company_id:
        query = query.where(Contact.company_id == company_id)
    if search:
        needle = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(Contact.first_name).like(needle),
                func.lower(Contact.last_name).like(needle),
                func.lower(Contact.work_email).like(needle),
            )
        )
    result = await db.execute(query.order_by(Contact.first_name, Contact.last_name).limit(limit))
    return [contact_read(contact) for contact in result.scalars()]


@router.post("/contacts", response_model=ContactRead, status_code=status.HTTP_201_CREATED)
async def create_contact(payload: ContactCreate, db: DBSession, _: Manager) -> ContactRead:
    return contact_read(await service.create_contact(db, payload))


@router.patch("/contacts/{contact_id}", response_model=ContactRead)
async def update_contact(
    contact_id: UUID, payload: ContactUpdate, db: DBSession, _: Manager
) -> ContactRead:
    contact = await service.get_contact_or_404(db, contact_id)
    data = payload.model_dump(exclude_unset=True)
    target_company = data.get("company_id", contact.company_id)
    await service.get_company_or_404(db, target_company)
    for field, value in data.items():
        setattr(contact, field, value)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=409, detail="A contact with this email already exists"
        ) from exc
    return contact_read(await service.get_contact_or_404(db, contact.id))


@router.get("/leads", response_model=LeadPage)
async def list_leads(
    db: DBSession,
    user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    lead_status: LeadStatus | None = None,
    source: LeadSource | None = None,
    priority: LeadPriority | None = None,
    owner_id: UUID | None = None,
    sort: Literal["created_at", "value", "follow_up", "company"] = "created_at",
) -> LeadPage:
    leads, total = await service.list_leads(
        db,
        user,
        page=page,
        page_size=page_size,
        search=search,
        lead_status=lead_status,
        source=source,
        priority=priority,
        owner_id=owner_id,
        sort=sort,
    )
    return LeadPage(
        items=[service.lead_read(lead) for lead in leads],
        total=total,
        page=page,
        page_size=page_size,
        pages=service.page_count(total, page_size),
    )


@router.post("/leads", response_model=LeadRead, status_code=status.HTTP_201_CREATED)
async def create_lead(payload: LeadCreate, db: DBSession, user: CurrentUser) -> LeadRead:
    return service.lead_read(await service.create_lead(db, payload, user))


@router.get("/leads/{lead_id}", response_model=LeadRead)
async def get_lead(lead_id: UUID, db: DBSession, user: CurrentUser) -> LeadRead:
    lead = await service.get_lead_or_404(db, lead_id)
    service.ensure_owner_access(user, lead.owner_id)
    return service.lead_read(lead)


@router.patch("/leads/{lead_id}", response_model=LeadRead)
async def update_lead(
    lead_id: UUID, payload: LeadUpdate, db: DBSession, user: CurrentUser
) -> LeadRead:
    lead = await service.get_lead_or_404(db, lead_id)
    service.ensure_owner_access(user, lead.owner_id)
    data = payload.model_dump(exclude_unset=True)
    new_owner = data.get("owner_id")
    if new_owner is not None:
        service.ensure_owner_access(user, new_owner)
    company_id = data.get("company_id", lead.company_id)
    contact_id = data.get("primary_contact_id", lead.primary_contact_id)
    await service.validate_contact_company(db, company_id, contact_id)
    for field, value in data.items():
        setattr(lead, field, value)
    await db.commit()
    return service.lead_read(await service.get_lead_or_404(db, lead.id))


@router.post("/leads/{lead_id}/convert", response_model=DealRead, status_code=201)
async def convert_lead(
    lead_id: UUID, payload: LeadConvert, db: DBSession, user: CurrentUser
) -> DealRead:
    lead = await service.get_lead_or_404(db, lead_id)
    return service.deal_read(await service.convert_lead(db, lead, payload, user))


@router.get("/pipeline-stages", response_model=list[StageRead])
async def list_stages(
    db: DBSession, _: CurrentUser, include_inactive: bool = False
) -> list[PipelineStage]:
    query = select(PipelineStage)
    if not include_inactive:
        query = query.where(PipelineStage.is_active.is_(True))
    result = await db.execute(query.order_by(PipelineStage.display_order))
    return list(result.scalars())


@router.get("/deals", response_model=DealPage)
async def list_deals(
    db: DBSession,
    user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    stage_id: UUID | None = None,
    owner_id: UUID | None = None,
) -> DealPage:
    filters = []
    if user.role not in service.MANAGER_ROLES:
        filters.append(Deal.owner_id == user.id)
    elif owner_id:
        filters.append(Deal.owner_id == owner_id)
    if stage_id:
        filters.append(Deal.stage_id == stage_id)
    base = select(Deal).where(*filters)
    total = await db.scalar(select(func.count()).select_from(base.subquery())) or 0
    result = await db.execute(
        base.options(*service.DEAL_LOADS)
        .order_by(Deal.expected_close_date.asc().nulls_last())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    deals = list(result.scalars().unique())
    return DealPage(
        items=[service.deal_read(deal) for deal in deals],
        total=total,
        page=page,
        page_size=page_size,
        pages=service.page_count(total, page_size),
    )


@router.post("/deals", response_model=DealRead, status_code=201)
async def create_deal(payload: DealCreate, db: DBSession, user: CurrentUser) -> DealRead:
    return service.deal_read(await service.create_deal(db, payload, user))


@router.get("/deals/{deal_id}", response_model=DealRead)
async def get_deal(deal_id: UUID, db: DBSession, user: CurrentUser) -> DealRead:
    deal = await service.get_deal_or_404(db, deal_id)
    service.ensure_owner_access(user, deal.owner_id)
    return service.deal_read(deal)


@router.patch("/deals/{deal_id}", response_model=DealRead)
async def update_deal(
    deal_id: UUID, payload: DealUpdate, db: DBSession, user: CurrentUser
) -> DealRead:
    deal = await service.get_deal_or_404(db, deal_id)
    service.ensure_owner_access(user, deal.owner_id)
    data = payload.model_dump(exclude_unset=True)
    new_owner = data.get("owner_id")
    if new_owner:
        service.ensure_owner_access(user, new_owner)
    company_id = data.get("company_id", deal.company_id)
    contact_id = data.get("primary_contact_id", deal.primary_contact_id)
    await service.validate_contact_company(db, company_id, contact_id)
    if data.get("currency"):
        data["currency"] = data["currency"].upper()
    for field, value in data.items():
        setattr(deal, field, value)
    await db.commit()
    return service.deal_read(await service.get_deal_or_404(db, deal.id))


@router.post("/deals/{deal_id}/transition", response_model=DealRead)
async def transition_deal(
    deal_id: UUID, payload: StageTransition, db: DBSession, user: CurrentUser
) -> DealRead:
    deal = await service.get_deal_or_404(db, deal_id)
    stage = await service.get_stage_or_404(db, payload.stage_id, active=True)
    return service.deal_read(await service.transition_deal(db, deal, stage, user))


@router.get("/pipeline", response_model=PipelineBoard)
async def pipeline_board(db: DBSession, user: CurrentUser) -> PipelineBoard:
    stage_result = await db.execute(
        select(PipelineStage)
        .where(PipelineStage.is_active.is_(True))
        .order_by(PipelineStage.display_order)
    )
    stages = list(stage_result.scalars())
    deal_query = select(Deal).where(Deal.stage_id.in_([stage.id for stage in stages]))
    if user.role not in service.MANAGER_ROLES:
        deal_query = deal_query.where(Deal.owner_id == user.id)
    deal_result = await db.execute(deal_query.options(*service.DEAL_LOADS))
    deals = list(deal_result.scalars().unique())
    columns = []
    for stage in stages:
        stage_deals = [deal for deal in deals if deal.stage_id == stage.id]
        columns.append(
            PipelineColumn(
                stage=StageRead.model_validate(stage, from_attributes=True),
                deals=[service.deal_read(deal) for deal in stage_deals],
                total_value=sum((deal.value for deal in stage_deals), Decimal("0")),
            )
        )
    return PipelineBoard(columns=columns)


@router.get("/dashboard/summary", response_model=DashboardSummary)
async def dashboard_summary(db: DBSession, user: CurrentUser) -> DashboardSummary:
    now = datetime.now(UTC)
    deal_query = select(Deal).options(*service.DEAL_LOADS)
    lead_query = select(Lead)
    if user.role not in service.MANAGER_ROLES:
        deal_query = deal_query.where(Deal.owner_id == user.id)
        lead_query = lead_query.where(Lead.owner_id == user.id)
    deal_result = await db.execute(deal_query)
    lead_result = await db.execute(lead_query)
    deals = list(deal_result.scalars().unique())
    leads = list(lead_result.scalars())
    open_deals = [deal for deal in deals if not deal.stage.is_terminal]
    requiring_attention = [
        deal for deal in open_deals if service.deal_read(deal, now=now).sla_breached
    ]
    closing = [
        deal
        for deal in open_deals
        if deal.expected_close_date
        and deal.expected_close_date.year == now.year
        and deal.expected_close_date.month == now.month
    ]
    overdue = [
        lead
        for lead in leads
        if lead.next_follow_up_at
        and service.aware(lead.next_follow_up_at) < now
        and lead.status not in {LeadStatus.CONVERTED, LeadStatus.UNQUALIFIED}
    ]
    return DashboardSummary(
        active_pipeline_value=sum((deal.value for deal in open_deals), Decimal("0")),
        weighted_pipeline_value=sum(
            (deal.value * Decimal(deal.probability) / Decimal(100) for deal in open_deals),
            Decimal("0"),
        ),
        open_deal_count=len(open_deals),
        overdue_follow_up_count=len(overdue),
        deals_requiring_attention=len(requiring_attention),
        closing_this_month=sum((deal.value for deal in closing), Decimal("0")),
    )
