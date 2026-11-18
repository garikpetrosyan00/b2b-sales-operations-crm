from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.crm import CompanySize, LeadPriority, LeadSource, LeadStatus


class CompanyInput(BaseModel):
    name: str = Field(min_length=1, max_length=240)
    website: str | None = Field(default=None, max_length=500)
    industry: str | None = Field(default=None, max_length=160)
    company_size: CompanySize | None = None
    country: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=5000)

    @field_validator("name", "industry", "country", "notes", mode="before")
    @classmethod
    def normalize_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = " ".join(value.split())
        return normalized or None


class CompanyCreate(CompanyInput):
    pass


class CompanyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=240)
    website: str | None = Field(default=None, max_length=500)
    industry: str | None = Field(default=None, max_length=160)
    company_size: CompanySize | None = None
    country: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=5000)


class CompanyRead(CompanyInput):
    id: UUID
    created_at: datetime
    updated_at: datetime


class ContactInput(BaseModel):
    company_id: UUID
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    work_email: EmailStr
    phone: str | None = Field(default=None, max_length=50)
    job_title: str | None = Field(default=None, max_length=160)

    @field_validator("work_email", mode="before")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class ContactCreate(ContactInput):
    pass


class ContactUpdate(BaseModel):
    company_id: UUID | None = None
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    work_email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    job_title: str | None = Field(default=None, max_length=160)


class ContactRead(ContactInput):
    id: UUID
    company_name: str
    created_at: datetime
    updated_at: datetime


class LeadInput(BaseModel):
    company_id: UUID
    primary_contact_id: UUID
    owner_id: UUID
    source: LeadSource
    status: LeadStatus = LeadStatus.NEW
    estimated_value: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=2)
    priority: LeadPriority = LeadPriority.MEDIUM
    next_follow_up_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=5000)


class LeadCreate(LeadInput):
    pass


class LeadUpdate(BaseModel):
    company_id: UUID | None = None
    primary_contact_id: UUID | None = None
    owner_id: UUID | None = None
    source: LeadSource | None = None
    status: LeadStatus | None = None
    estimated_value: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    priority: LeadPriority | None = None
    next_follow_up_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=5000)


class LeadRead(LeadInput):
    id: UUID
    company_name: str
    contact_name: str
    contact_email: EmailStr
    owner_name: str
    created_at: datetime
    updated_at: datetime


class LeadPage(BaseModel):
    items: list[LeadRead]
    total: int
    page: int
    page_size: int
    pages: int


class LeadConvert(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    value: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    expected_close_date: datetime | None = None

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()


class StageRead(BaseModel):
    id: UUID
    name: str
    display_order: int
    color: str
    probability: int
    sla_hours: int
    is_active: bool
    is_terminal: bool
    is_won: bool


class DealInput(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    company_id: UUID
    primary_contact_id: UUID
    owner_id: UUID
    stage_id: UUID
    value: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    probability: int | None = Field(default=None, ge=0, le=100)
    expected_close_date: datetime | None = None
    last_activity_at: datetime | None = None
    loss_reason: str | None = Field(default=None, max_length=500)
    notes: str | None = Field(default=None, max_length=5000)

    @field_validator("currency")
    @classmethod
    def normalize_deal_currency(cls, value: str) -> str:
        return value.upper()


class DealCreate(DealInput):
    pass


class DealUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=240)
    company_id: UUID | None = None
    primary_contact_id: UUID | None = None
    owner_id: UUID | None = None
    value: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    probability: int | None = Field(default=None, ge=0, le=100)
    expected_close_date: datetime | None = None
    last_activity_at: datetime | None = None
    loss_reason: str | None = Field(default=None, max_length=500)
    notes: str | None = Field(default=None, max_length=5000)


class DealRead(DealInput):
    id: UUID
    source_lead_id: UUID | None
    company_name: str
    contact_name: str
    owner_name: str
    stage_name: str
    stage_color: str
    stage_entered_at: datetime
    sla_breached: bool
    created_at: datetime
    updated_at: datetime


class DealPage(BaseModel):
    items: list[DealRead]
    total: int
    page: int
    page_size: int
    pages: int


class StageTransition(BaseModel):
    stage_id: UUID


class PipelineColumn(BaseModel):
    stage: StageRead
    deals: list[DealRead]
    total_value: Decimal


class PipelineBoard(BaseModel):
    columns: list[PipelineColumn]
    currency: str = "USD"


class DashboardSummary(BaseModel):
    active_pipeline_value: Decimal
    weighted_pipeline_value: Decimal
    open_deal_count: int
    overdue_follow_up_count: int
    deals_requiring_attention: int
    closing_this_month: Decimal
