from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.dependencies import CurrentUser, DBSession
from app.models.crm import (
    CrmTask,
    Deal,
    DealActivity,
    DealStageHistory,
    Lead,
    LeadStatus,
    PipelineStage,
    TaskPriority,
    TaskStatus,
)
from app.models.user import User
from app.schemas.crm import (
    DealActivityCreate,
    DealActivityRead,
    DealTimeline,
    LeadSourceReport,
    OwnerPerformance,
    PipelineReportStage,
    ReportsSummary,
    StageHistoryRead,
    TaskCreate,
    TaskPage,
    TaskRead,
    TaskUpdate,
)
from app.services import crm as service

router = APIRouter()

TASK_LOADS = (
    selectinload(CrmTask.assignee),
    selectinload(CrmTask.lead).selectinload(Lead.company),
    selectinload(CrmTask.deal).selectinload(Deal.company),
)


def task_read(task: CrmTask, *, now: datetime | None = None) -> TaskRead:
    current_time = now or datetime.now(UTC)
    due_at = service.aware(task.due_at)
    related_name = task.deal.title if task.deal else task.lead.company.name
    return TaskRead(
        id=task.id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        due_at=task.due_at,
        completed_at=task.completed_at,
        assignee_id=task.assignee_id,
        assignee_name=task.assignee.full_name,
        related_lead_id=task.related_lead_id,
        related_deal_id=task.related_deal_id,
        related_record_name=related_name,
        is_overdue=task.status != TaskStatus.DONE and due_at < current_time,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


async def get_task_or_404(db: DBSession, task_id: UUID) -> CrmTask:
    result = await db.execute(select(CrmTask).where(CrmTask.id == task_id).options(*TASK_LOADS))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


async def validate_task_relationships(
    db: DBSession,
    user: User,
    *,
    related_lead_id: UUID | None,
    related_deal_id: UUID | None,
) -> None:
    if bool(related_lead_id) == bool(related_deal_id):
        raise HTTPException(status_code=422, detail="Select exactly one related lead or deal")
    if related_lead_id:
        lead = await service.get_lead_or_404(db, related_lead_id)
        service.ensure_owner_access(user, lead.owner_id)
    if related_deal_id:
        deal = await service.get_deal_or_404(db, related_deal_id)
        service.ensure_owner_access(user, deal.owner_id)


@router.get("/tasks", response_model=TaskPage)
async def list_tasks(
    db: DBSession,
    user: CurrentUser,
    task_status: TaskStatus | None = None,
    priority: TaskPriority | None = None,
    assignee_id: UUID | None = None,
    limit: int = Query(100, ge=1, le=250),
) -> TaskPage:
    query = select(CrmTask)
    if user.role not in service.MANAGER_ROLES:
        query = query.where(CrmTask.assignee_id == user.id)
    elif assignee_id:
        query = query.where(CrmTask.assignee_id == assignee_id)
    if task_status:
        query = query.where(CrmTask.status == task_status)
    if priority:
        query = query.where(CrmTask.priority == priority)
    result = await db.execute(
        query.options(*TASK_LOADS).order_by(CrmTask.due_at, CrmTask.created_at).limit(limit)
    )
    tasks = list(result.scalars().unique())
    items = [task_read(task) for task in tasks]
    return TaskPage(
        items=items,
        total=len(items),
        todo_count=sum(item.status != TaskStatus.DONE for item in items),
        overdue_count=sum(item.is_overdue for item in items),
        completed_count=sum(item.status == TaskStatus.DONE for item in items),
    )


@router.post("/tasks", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def create_task(payload: TaskCreate, db: DBSession, user: CurrentUser) -> TaskRead:
    service.ensure_owner_access(user, payload.assignee_id)
    await validate_task_relationships(
        db,
        user,
        related_lead_id=payload.related_lead_id,
        related_deal_id=payload.related_deal_id,
    )
    task = CrmTask(**payload.model_dump())
    if task.status == TaskStatus.DONE:
        task.completed_at = datetime.now(UTC)
    db.add(task)
    await db.commit()
    return task_read(await get_task_or_404(db, task.id))


@router.patch("/tasks/{task_id}", response_model=TaskRead)
async def update_task(
    task_id: UUID, payload: TaskUpdate, db: DBSession, user: CurrentUser
) -> TaskRead:
    task = await get_task_or_404(db, task_id)
    service.ensure_owner_access(user, task.assignee_id)
    data = payload.model_dump(exclude_unset=True)
    new_assignee = data.get("assignee_id")
    if new_assignee:
        service.ensure_owner_access(user, new_assignee)
    lead_id = data.get("related_lead_id", task.related_lead_id)
    deal_id = data.get("related_deal_id", task.related_deal_id)
    await validate_task_relationships(db, user, related_lead_id=lead_id, related_deal_id=deal_id)
    for field, value in data.items():
        setattr(task, field, value)
    if task.status == TaskStatus.DONE and task.completed_at is None:
        task.completed_at = datetime.now(UTC)
    elif task.status != TaskStatus.DONE:
        task.completed_at = None
    await db.commit()
    return task_read(await get_task_or_404(db, task.id))


@router.get("/deals/{deal_id}/timeline", response_model=DealTimeline)
async def deal_timeline(deal_id: UUID, db: DBSession, user: CurrentUser) -> DealTimeline:
    deal = await service.get_deal_or_404(db, deal_id)
    service.ensure_owner_access(user, deal.owner_id)
    activity_result = await db.execute(
        select(DealActivity)
        .where(DealActivity.deal_id == deal_id)
        .options(selectinload(DealActivity.actor))
        .order_by(DealActivity.occurred_at.desc())
    )
    history_result = await db.execute(
        select(DealStageHistory)
        .where(DealStageHistory.deal_id == deal_id)
        .options(
            selectinload(DealStageHistory.previous_stage),
            selectinload(DealStageHistory.new_stage),
            selectinload(DealStageHistory.changed_by),
        )
        .order_by(DealStageHistory.changed_at.desc())
    )
    return DealTimeline(
        activities=[
            DealActivityRead(
                id=activity.id,
                deal_id=activity.deal_id,
                actor_id=activity.actor_id,
                actor_name=activity.actor.full_name,
                activity_type=activity.activity_type,
                summary=activity.summary,
                details=activity.details,
                occurred_at=activity.occurred_at,
            )
            for activity in activity_result.scalars()
        ],
        stage_history=[
            StageHistoryRead(
                id=item.id,
                previous_stage_name=item.previous_stage.name if item.previous_stage else None,
                new_stage_name=item.new_stage.name,
                changed_by_name=item.changed_by.full_name,
                changed_at=item.changed_at,
                time_spent_seconds=item.time_spent_seconds,
            )
            for item in history_result.scalars()
        ],
    )


@router.post(
    "/deals/{deal_id}/activities",
    response_model=DealActivityRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_deal_activity(
    deal_id: UUID, payload: DealActivityCreate, db: DBSession, user: CurrentUser
) -> DealActivityRead:
    deal = await service.get_deal_or_404(db, deal_id)
    service.ensure_owner_access(user, deal.owner_id)
    activity = DealActivity(
        deal_id=deal.id,
        actor_id=user.id,
        activity_type=payload.activity_type,
        summary=payload.summary,
        details=payload.details,
        occurred_at=payload.occurred_at or datetime.now(UTC),
    )
    deal.last_activity_at = activity.occurred_at
    db.add(activity)
    await db.commit()
    return DealActivityRead(
        id=activity.id,
        deal_id=activity.deal_id,
        actor_id=activity.actor_id,
        actor_name=user.full_name,
        activity_type=activity.activity_type,
        summary=activity.summary,
        details=activity.details,
        occurred_at=activity.occurred_at,
    )


@router.get("/reports/summary", response_model=ReportsSummary)
async def reports_summary(db: DBSession, user: CurrentUser) -> ReportsSummary:
    deal_query = select(Deal).options(*service.DEAL_LOADS)
    lead_query = select(Lead)
    task_query = select(CrmTask)
    if user.role not in service.MANAGER_ROLES:
        deal_query = deal_query.where(Deal.owner_id == user.id)
        lead_query = lead_query.where(Lead.owner_id == user.id)
        task_query = task_query.where(CrmTask.assignee_id == user.id)
    deals = list((await db.execute(deal_query)).scalars().unique())
    leads = list((await db.execute(lead_query)).scalars())
    tasks = list((await db.execute(task_query)).scalars())
    open_deals = [deal for deal in deals if not deal.stage.is_terminal]
    won_deals = [deal for deal in deals if deal.stage.is_won]
    lost_deals = [deal for deal in deals if deal.stage.is_terminal and not deal.stage.is_won]
    closed_count = len(won_deals) + len(lost_deals)

    by_stage = []
    stages = list(
        (await db.execute(select(PipelineStage).order_by(PipelineStage.display_order))).scalars()
    )
    for stage in stages:
        stage_deals = [deal for deal in deals if deal.stage_id == stage.id]
        by_stage.append(
            PipelineReportStage(
                stage_name=stage.name,
                color=stage.color,
                deal_count=len(stage_deals),
                total_value=sum((deal.value for deal in stage_deals), Decimal("0")),
                weighted_value=sum(
                    (deal.value * Decimal(deal.probability) / Decimal(100) for deal in stage_deals),
                    Decimal("0"),
                ),
            )
        )

    owners: dict[UUID, User] = {deal.owner.id: deal.owner for deal in deals}
    by_owner = []
    for owner in sorted(owners.values(), key=lambda item: item.full_name):
        active = [deal for deal in open_deals if deal.owner_id == owner.id]
        won = [deal for deal in won_deals if deal.owner_id == owner.id]
        by_owner.append(
            OwnerPerformance(
                owner_id=owner.id,
                owner_name=owner.full_name,
                active_deals=len(active),
                active_value=sum((deal.value for deal in active), Decimal("0")),
                won_deals=len(won),
                won_value=sum((deal.value for deal in won), Decimal("0")),
            )
        )

    sources = sorted({lead.source for lead in leads}, key=lambda item: item.value)
    by_source = [
        LeadSourceReport(
            source=source,
            lead_count=sum(lead.source == source for lead in leads),
            converted_count=sum(
                lead.source == source and lead.status.value == "converted" for lead in leads
            ),
        )
        for source in sources
    ]
    total_pipeline = sum((deal.value for deal in open_deals), Decimal("0"))
    won_revenue = sum((deal.value for deal in won_deals), Decimal("0"))
    sources = sorted({lead.source for lead in leads}, key=lambda source: source.value)
    by_source = [
        LeadSourceReport(
            source=source,
            lead_count=sum(lead.source == source for lead in leads),
            converted_count=sum(
                lead.source == source and lead.status == LeadStatus.CONVERTED for lead in leads
            ),
        )
        for source in sources
    ]
    return ReportsSummary(
        total_pipeline=total_pipeline,
        weighted_pipeline=sum(
            (deal.value * Decimal(deal.probability) / Decimal(100) for deal in open_deals),
            Decimal("0"),
        ),
        won_revenue=won_revenue,
        win_rate=round((len(won_deals) / closed_count * 100) if closed_count else 0, 1),
        average_deal_size=(
            sum((deal.value for deal in deals), Decimal("0")) / len(deals)
            if deals
            else Decimal("0")
        ),
        overdue_tasks=sum(
            task.status != TaskStatus.DONE and service.aware(task.due_at) < datetime.now(UTC)
            for task in tasks
        ),
        by_stage=by_stage,
        by_owner=by_owner,
        by_source=by_source,
    )
