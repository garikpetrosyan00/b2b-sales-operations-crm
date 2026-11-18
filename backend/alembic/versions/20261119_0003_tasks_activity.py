"""Add CRM tasks and deal activity timeline.

Revision ID: 20261119_0003
Revises: 20261119_0002
Create Date: 2026-11-19 12:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261119_0003"
down_revision: str | None = "20261119_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

task_status = sa.Enum("todo", "in_progress", "done", name="task_status")
task_priority = sa.Enum("low", "medium", "high", name="task_priority")
activity_type = sa.Enum("note", "call", "email", "meeting", "stage_change", name="activity_type")


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
        "deal_activities",
        sa.Column("deal_id", sa.Uuid(), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=False),
        sa.Column("activity_type", activity_type, nullable=False),
        sa.Column("summary", sa.String(length=500), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column(
            "occurred_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        *timestamps(),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["deal_id"], ["deals.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_deal_activities_actor_id"), "deal_activities", ["actor_id"])
    op.create_index(op.f("ix_deal_activities_deal_id"), "deal_activities", ["deal_id"])
    op.create_index(
        "ix_deal_activities_deal_occurred",
        "deal_activities",
        ["deal_id", "occurred_at"],
    )

    op.create_table(
        "crm_tasks",
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", task_status, nullable=False),
        sa.Column("priority", task_priority, nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("assignee_id", sa.Uuid(), nullable=False),
        sa.Column("related_lead_id", sa.Uuid(), nullable=True),
        sa.Column("related_deal_id", sa.Uuid(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        *timestamps(),
        sa.CheckConstraint(
            "related_lead_id IS NOT NULL OR related_deal_id IS NOT NULL",
            name="ck_task_has_related_record",
        ),
        sa.ForeignKeyConstraint(["assignee_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["related_deal_id"], ["deals.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["related_lead_id"], ["leads.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_crm_tasks_assignee_id"), "crm_tasks", ["assignee_id"])
    op.create_index(op.f("ix_crm_tasks_due_at"), "crm_tasks", ["due_at"])
    op.create_index(op.f("ix_crm_tasks_related_deal_id"), "crm_tasks", ["related_deal_id"])
    op.create_index(op.f("ix_crm_tasks_related_lead_id"), "crm_tasks", ["related_lead_id"])
    op.create_index(
        "ix_crm_tasks_assignee_status_due",
        "crm_tasks",
        ["assignee_id", "status", "due_at"],
    )


def downgrade() -> None:
    op.drop_table("crm_tasks")
    op.drop_table("deal_activities")
    activity_type.drop(op.get_bind(), checkfirst=True)
    task_priority.drop(op.get_bind(), checkfirst=True)
    task_status.drop(op.get_bind(), checkfirst=True)
