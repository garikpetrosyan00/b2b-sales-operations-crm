import enum
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    false,
    func,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.user import User


class CompanySize(enum.StrEnum):
    STARTUP = "startup"
    SMALL = "small"
    MEDIUM = "medium"
    ENTERPRISE = "enterprise"


class LeadSource(enum.StrEnum):
    WEBSITE = "website"
    REFERRAL = "referral"
    OUTBOUND = "outbound"
    EVENT = "event"
    PARTNER = "partner"
    OTHER = "other"


class LeadStatus(enum.StrEnum):
    NEW = "new"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    UNQUALIFIED = "unqualified"
    CONVERTED = "converted"


class LeadPriority(enum.StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class TaskStatus(enum.StrEnum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"


class TaskPriority(enum.StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ActivityType(enum.StrEnum):
    NOTE = "note"
    CALL = "call"
    EMAIL = "email"
    MEETING = "meeting"
    STAGE_CHANGE = "stage_change"


class Company(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "companies"
    # PostgreSQL migration uses a functional lower(name) index. A named-column
    # index keeps SQLite metadata portable for the isolated test suite.
    __table_args__ = (Index("ix_companies_name_lower", "name", unique=True),)

    name: Mapped[str] = mapped_column(String(200))
    website: Mapped[str | None] = mapped_column(String(500))
    industry: Mapped[str | None] = mapped_column(String(120), index=True)
    company_size: Mapped[CompanySize | None] = mapped_column(
        Enum(
            CompanySize,
            name="company_size",
            values_callable=lambda values: [v.value for v in values],
        )
    )
    country: Mapped[str | None] = mapped_column(String(120), index=True)
    notes: Mapped[str | None] = mapped_column(Text)

    contacts: Mapped[list["Contact"]] = relationship(back_populates="company")
    leads: Mapped[list["Lead"]] = relationship(back_populates="company")
    deals: Mapped[list["Deal"]] = relationship(back_populates="company")


class Contact(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "contacts"
    __table_args__ = (Index("ix_contacts_email_lower", "work_email", unique=True),)

    company_id: Mapped[UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    work_email: Mapped[str] = mapped_column(String(320))
    phone: Mapped[str | None] = mapped_column(String(50))
    job_title: Mapped[str | None] = mapped_column(String(160))

    company: Mapped[Company] = relationship(back_populates="contacts")
    leads: Mapped[list["Lead"]] = relationship(back_populates="primary_contact")
    deals: Mapped[list["Deal"]] = relationship(back_populates="primary_contact")


class PipelineStage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "pipeline_stages"
    __table_args__ = (
        UniqueConstraint("name", name="uq_pipeline_stages_name"),
        UniqueConstraint("display_order", name="uq_pipeline_stages_display_order"),
        CheckConstraint("probability >= 0 AND probability <= 100", name="ck_stage_probability"),
        CheckConstraint("sla_hours > 0", name="ck_stage_sla_hours"),
    )

    name: Mapped[str] = mapped_column(String(100))
    display_order: Mapped[int] = mapped_column(Integer)
    color: Mapped[str] = mapped_column(String(20))
    probability: Mapped[int] = mapped_column(Integer)
    sla_hours: Mapped[int] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    is_terminal: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    is_won: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())

    deals: Mapped[list["Deal"]] = relationship(back_populates="stage")


class Lead(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "leads"
    __table_args__ = (
        CheckConstraint("estimated_value >= 0", name="ck_lead_estimated_value"),
        Index("ix_leads_status_owner", "status", "owner_id"),
        Index("ix_leads_follow_up", "next_follow_up_at"),
    )

    company_id: Mapped[UUID] = mapped_column(ForeignKey("companies.id"), index=True)
    primary_contact_id: Mapped[UUID] = mapped_column(ForeignKey("contacts.id"), index=True)
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    source: Mapped[LeadSource] = mapped_column(
        Enum(
            LeadSource, name="lead_source", values_callable=lambda values: [v.value for v in values]
        )
    )
    status: Mapped[LeadStatus] = mapped_column(
        Enum(
            LeadStatus, name="lead_status", values_callable=lambda values: [v.value for v in values]
        ),
        default=LeadStatus.NEW,
    )
    estimated_value: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    priority: Mapped[LeadPriority] = mapped_column(
        Enum(
            LeadPriority,
            name="lead_priority",
            values_callable=lambda values: [v.value for v in values],
        ),
        default=LeadPriority.MEDIUM,
    )
    next_follow_up_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    notes: Mapped[str | None] = mapped_column(Text)

    company: Mapped[Company] = relationship(back_populates="leads")
    primary_contact: Mapped[Contact] = relationship(back_populates="leads")
    owner: Mapped["User"] = relationship(back_populates="leads")
    tasks: Mapped[list["CrmTask"]] = relationship(back_populates="lead")


class Deal(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "deals"
    __table_args__ = (
        CheckConstraint("value >= 0", name="ck_deal_value"),
        CheckConstraint("probability >= 0 AND probability <= 100", name="ck_deal_probability"),
        CheckConstraint("length(currency) = 3", name="ck_deal_currency"),
        Index("ix_deals_stage_owner", "stage_id", "owner_id"),
        Index("ix_deals_expected_close", "expected_close_date"),
    )

    title: Mapped[str] = mapped_column(String(240))
    company_id: Mapped[UUID] = mapped_column(ForeignKey("companies.id"), index=True)
    primary_contact_id: Mapped[UUID] = mapped_column(ForeignKey("contacts.id"), index=True)
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    stage_id: Mapped[UUID] = mapped_column(ForeignKey("pipeline_stages.id"), index=True)
    source_lead_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("leads.id", ondelete="SET NULL"), unique=True
    )
    value: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    probability: Mapped[int] = mapped_column(Integer)
    expected_close_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), index=True
    )
    last_activity_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    stage_entered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now().astimezone(),
        server_default=func.now(),
    )
    loss_reason: Mapped[str | None] = mapped_column(String(500))
    notes: Mapped[str | None] = mapped_column(Text)

    company: Mapped[Company] = relationship(back_populates="deals")
    primary_contact: Mapped[Contact] = relationship(back_populates="deals")
    owner: Mapped["User"] = relationship(back_populates="deals")
    stage: Mapped[PipelineStage] = relationship(back_populates="deals")
    stage_history: Mapped[list["DealStageHistory"]] = relationship(
        back_populates="deal", cascade="all, delete-orphan"
    )
    activities: Mapped[list["DealActivity"]] = relationship(
        back_populates="deal", cascade="all, delete-orphan"
    )
    tasks: Mapped[list["CrmTask"]] = relationship(back_populates="deal")


class DealStageHistory(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "deal_stage_history"

    deal_id: Mapped[UUID] = mapped_column(ForeignKey("deals.id", ondelete="CASCADE"), index=True)
    previous_stage_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("pipeline_stages.id", ondelete="SET NULL")
    )
    new_stage_id: Mapped[UUID] = mapped_column(ForeignKey("pipeline_stages.id"))
    changed_by_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    time_spent_seconds: Mapped[int | None] = mapped_column(Integer)

    deal: Mapped[Deal] = relationship(back_populates="stage_history")
    previous_stage: Mapped[PipelineStage | None] = relationship(foreign_keys=[previous_stage_id])
    new_stage: Mapped[PipelineStage] = relationship(foreign_keys=[new_stage_id])
    changed_by: Mapped["User"] = relationship()


class DealActivity(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "deal_activities"
    __table_args__ = (Index("ix_deal_activities_deal_occurred", "deal_id", "occurred_at"),)

    deal_id: Mapped[UUID] = mapped_column(ForeignKey("deals.id", ondelete="CASCADE"), index=True)
    actor_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    activity_type: Mapped[ActivityType] = mapped_column(
        Enum(
            ActivityType,
            name="activity_type",
            values_callable=lambda values: [value.value for value in values],
        )
    )
    summary: Mapped[str] = mapped_column(String(500))
    details: Mapped[str | None] = mapped_column(Text)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now().astimezone(),
        server_default=func.now(),
    )

    deal: Mapped[Deal] = relationship(back_populates="activities")
    actor: Mapped["User"] = relationship(back_populates="deal_activities")


class CrmTask(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "crm_tasks"
    __table_args__ = (
        CheckConstraint(
            "related_lead_id IS NOT NULL OR related_deal_id IS NOT NULL",
            name="ck_task_has_related_record",
        ),
        Index("ix_crm_tasks_assignee_status_due", "assignee_id", "status", "due_at"),
    )

    title: Mapped[str] = mapped_column(String(240))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[TaskStatus] = mapped_column(
        Enum(
            TaskStatus,
            name="task_status",
            values_callable=lambda values: [value.value for value in values],
        ),
        default=TaskStatus.TODO,
    )
    priority: Mapped[TaskPriority] = mapped_column(
        Enum(
            TaskPriority,
            name="task_priority",
            values_callable=lambda values: [value.value for value in values],
        ),
        default=TaskPriority.MEDIUM,
    )
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    assignee_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    related_lead_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("leads.id", ondelete="CASCADE"), index=True
    )
    related_deal_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("deals.id", ondelete="CASCADE"), index=True
    )

    assignee: Mapped["User"] = relationship(back_populates="crm_tasks")
    lead: Mapped[Lead | None] = relationship(back_populates="tasks")
    deal: Mapped[Deal | None] = relationship(back_populates="tasks")
