"""Add companies, contacts, leads, pipeline, deals, and stage history.

Revision ID: 20261119_0002
Revises: 20261118_0001
Create Date: 2026-11-19 00:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261119_0002"
down_revision: str | None = "20261118_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

company_size = sa.Enum("startup", "small", "medium", "enterprise", name="company_size")
lead_source = sa.Enum(
    "website", "referral", "outbound", "event", "partner", "other", name="lead_source"
)
lead_status = sa.Enum(
    "new", "contacted", "qualified", "unqualified", "converted", name="lead_status"
)
lead_priority = sa.Enum("low", "medium", "high", "urgent", name="lead_priority")


def timestamps() -> list[sa.Column]:
    return [
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    ]


def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("website", sa.String(length=500), nullable=True),
        sa.Column("industry", sa.String(length=120), nullable=True),
        sa.Column("company_size", company_size, nullable=True),
        sa.Column("country", sa.String(length=120), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        *timestamps(),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_companies_name_lower", "companies", [sa.text("lower(name)")], unique=True)
    op.create_index(op.f("ix_companies_industry"), "companies", ["industry"])
    op.create_index(op.f("ix_companies_country"), "companies", ["country"])

    op.create_table(
        "pipeline_stages",
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("color", sa.String(length=20), nullable=False),
        sa.Column("probability", sa.Integer(), nullable=False),
        sa.Column("sla_hours", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("is_terminal", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("is_won", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        *timestamps(),
        sa.CheckConstraint("probability >= 0 AND probability <= 100", name="ck_stage_probability"),
        sa.CheckConstraint("sla_hours > 0", name="ck_stage_sla_hours"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("display_order", name="uq_pipeline_stages_display_order"),
        sa.UniqueConstraint("name", name="uq_pipeline_stages_name"),
    )

    op.create_table(
        "contacts",
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("work_email", sa.String(length=320), nullable=False),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("job_title", sa.String(length=160), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_contacts_company_id"), "contacts", ["company_id"])
    op.create_index(
        "ix_contacts_email_lower", "contacts", [sa.text("lower(work_email)")], unique=True
    )

    op.create_table(
        "leads",
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("primary_contact_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("source", lead_source, nullable=False),
        sa.Column("status", lead_status, nullable=False),
        sa.Column("estimated_value", sa.Numeric(14, 2), nullable=False),
        sa.Column("priority", lead_priority, nullable=False),
        sa.Column("next_follow_up_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        *timestamps(),
        sa.CheckConstraint("estimated_value >= 0", name="ck_lead_estimated_value"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["primary_contact_id"], ["contacts.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_leads_company_id"), "leads", ["company_id"])
    op.create_index(op.f("ix_leads_primary_contact_id"), "leads", ["primary_contact_id"])
    op.create_index(op.f("ix_leads_owner_id"), "leads", ["owner_id"])
    op.create_index("ix_leads_status_owner", "leads", ["status", "owner_id"])
    op.create_index("ix_leads_follow_up", "leads", ["next_follow_up_at"])

    op.create_table(
        "deals",
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("primary_contact_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("stage_id", sa.Uuid(), nullable=False),
        sa.Column("source_lead_id", sa.Uuid(), nullable=True),
        sa.Column("value", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("probability", sa.Integer(), nullable=False),
        sa.Column("expected_close_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_activity_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "stage_entered_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("loss_reason", sa.String(length=500), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        *timestamps(),
        sa.CheckConstraint("length(currency) = 3", name="ck_deal_currency"),
        sa.CheckConstraint("probability >= 0 AND probability <= 100", name="ck_deal_probability"),
        sa.CheckConstraint("value >= 0", name="ck_deal_value"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["primary_contact_id"], ["contacts.id"]),
        sa.ForeignKeyConstraint(["source_lead_id"], ["leads.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["stage_id"], ["pipeline_stages.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_lead_id"),
    )
    op.create_index(op.f("ix_deals_company_id"), "deals", ["company_id"])
    op.create_index(op.f("ix_deals_primary_contact_id"), "deals", ["primary_contact_id"])
    op.create_index(op.f("ix_deals_owner_id"), "deals", ["owner_id"])
    op.create_index(op.f("ix_deals_stage_id"), "deals", ["stage_id"])
    op.create_index("ix_deals_stage_owner", "deals", ["stage_id", "owner_id"])
    op.create_index("ix_deals_expected_close", "deals", ["expected_close_date"])

    op.create_table(
        "deal_stage_history",
        sa.Column("deal_id", sa.Uuid(), nullable=False),
        sa.Column("previous_stage_id", sa.Uuid(), nullable=True),
        sa.Column("new_stage_id", sa.Uuid(), nullable=False),
        sa.Column("changed_by_id", sa.Uuid(), nullable=False),
        sa.Column(
            "changed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("time_spent_seconds", sa.Integer(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["changed_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["deal_id"], ["deals.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["previous_stage_id"], ["pipeline_stages.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["new_stage_id"], ["pipeline_stages.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_deal_stage_history_deal_id"), "deal_stage_history", ["deal_id"])
    op.create_index(op.f("ix_deal_stage_history_changed_at"), "deal_stage_history", ["changed_at"])


def downgrade() -> None:
    op.drop_table("deal_stage_history")
    op.drop_table("deals")
    op.drop_table("leads")
    op.drop_table("contacts")
    op.drop_table("pipeline_stages")
    op.drop_table("companies")
    lead_priority.drop(op.get_bind(), checkfirst=True)
    lead_status.drop(op.get_bind(), checkfirst=True)
    lead_source.drop(op.get_bind(), checkfirst=True)
    company_size.drop(op.get_bind(), checkfirst=True)
