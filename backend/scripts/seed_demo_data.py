import asyncio
import secrets
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.crm import (
    ActivityType,
    Company,
    CompanySize,
    Contact,
    CrmTask,
    Deal,
    DealActivity,
    Lead,
    LeadPriority,
    LeadSource,
    LeadStatus,
    PipelineStage,
    TaskPriority,
    TaskStatus,
)
from app.models.user import User, UserRole
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

Output = Callable[[str], None]

STAGES = [
    ("Qualified", 1, "#6366f1", 20, 72, False, False),
    ("Discovery", 2, "#0ea5e9", 35, 96, False, False),
    ("Proposal", 3, "#8b5cf6", 55, 120, False, False),
    ("Negotiation", 4, "#f59e0b", 75, 96, False, False),
    ("Closed Won", 5, "#10b981", 100, 720, True, True),
    ("Closed Lost", 6, "#64748b", 0, 720, True, False),
]

COMPANIES = [
    ("Atlas Manufacturing", "Industrial Automation", CompanySize.ENTERPRISE, "United States"),
    ("Brightpath Logistics", "Logistics", CompanySize.MEDIUM, "United Kingdom"),
    ("CloudCore Systems", "Cloud Infrastructure", CompanySize.MEDIUM, "Germany"),
    ("Evergreen Health", "Healthcare Technology", CompanySize.ENTERPRISE, "Canada"),
    ("FinSight Analytics", "Financial Technology", CompanySize.STARTUP, "Singapore"),
    ("Northwind Retail", "Retail Technology", CompanySize.SMALL, "Netherlands"),
]

CONTACTS = [
    ("Atlas Manufacturing", "Maya", "Patel", "maya.patel@atlas.example", "VP Operations"),
    ("Brightpath Logistics", "Oliver", "Grant", "oliver.grant@brightpath.example", "COO"),
    ("CloudCore Systems", "Sofia", "Weber", "sofia.weber@cloudcore.example", "Head of Sales"),
    ("Evergreen Health", "Daniel", "Kim", "daniel.kim@evergreen.example", "Director of IT"),
    ("FinSight Analytics", "Amelia", "Tan", "amelia.tan@finsight.example", "Co-Founder"),
    ("Northwind Retail", "Lucas", "de Vries", "lucas@northwind.example", "Revenue Lead"),
]

DEALS = [
    ("Atlas workflow modernization", "Atlas Manufacturing", "Qualified", 48000, 18, -4),
    ("Brightpath route intelligence", "Brightpath Logistics", "Qualified", 22000, 10, -1),
    ("CloudCore partner CRM", "CloudCore Systems", "Discovery", 36500, 24, -6),
    ("Evergreen intake automation", "Evergreen Health", "Discovery", 64000, 32, -2),
    ("FinSight sales workspace", "FinSight Analytics", "Proposal", 18500, 14, -7),
    ("Northwind expansion analytics", "Northwind Retail", "Proposal", 27500, 20, -3),
    ("Atlas supplier portal", "Atlas Manufacturing", "Negotiation", 82000, 35, -5),
    ("CloudCore enterprise rollout", "CloudCore Systems", "Negotiation", 96000, 42, -1),
    ("Evergreen support operations", "Evergreen Health", "Closed Won", 54000, -12, -20),
    ("Brightpath renewal platform", "Brightpath Logistics", "Closed Won", 31000, -3, -14),
    ("FinSight compliance workflow", "FinSight Analytics", "Closed Lost", 24000, -8, -18),
    ("Northwind loyalty operations", "Northwind Retail", "Qualified", 15500, 12, -5),
]


async def seed_demo_data(
    session_factory: async_sessionmaker[AsyncSession] = AsyncSessionLocal,
    output: Output = print,
) -> dict[str, int]:
    now = datetime.now(UTC)
    async with session_factory() as db:
        users = list(
            (
                await db.execute(
                    select(User).where(User.is_active.is_(True)).order_by(User.created_at)
                )
            ).scalars()
        )
        for email, name in (
            ("ava.morgan@demo.example", "Ava Morgan"),
            ("liam.chen@demo.example", "Liam Chen"),
        ):
            existing = await db.scalar(select(User).where(func.lower(User.email) == email))
            if existing is None:
                existing = User(
                    email=email,
                    full_name=name,
                    hashed_password=hash_password(secrets.token_urlsafe(32)),
                    role=UserRole.SALES_AGENT,
                )
                db.add(existing)
                await db.flush()
            if existing not in users:
                users.append(existing)
        if not users:
            raise RuntimeError("Create an administrator before seeding demo data")

        stages: dict[str, PipelineStage] = {}
        for name, order, color, probability, sla, terminal, won in STAGES:
            stage = await db.scalar(select(PipelineStage).where(PipelineStage.name == name))
            if stage is None:
                stage = PipelineStage(
                    name=name,
                    display_order=order,
                    color=color,
                    probability=probability,
                    sla_hours=sla,
                    is_terminal=terminal,
                    is_won=won,
                )
                db.add(stage)
                await db.flush()
            stages[name] = stage

        companies: dict[str, Company] = {}
        for name, industry, size, country in COMPANIES:
            company = await db.scalar(
                select(Company).where(func.lower(Company.name) == name.lower())
            )
            if company is None:
                company = Company(
                    name=name,
                    website=f"https://{name.lower().replace(' ', '')}.example",
                    industry=industry,
                    company_size=size,
                    country=country,
                )
                db.add(company)
                await db.flush()
            companies[name] = company

        contacts: dict[str, Contact] = {}
        for company_name, first, last, email, title in CONTACTS:
            contact = await db.scalar(
                select(Contact).where(func.lower(Contact.work_email) == email)
            )
            if contact is None:
                contact = Contact(
                    company_id=companies[company_name].id,
                    first_name=first,
                    last_name=last,
                    work_email=email,
                    job_title=title,
                )
                db.add(contact)
                await db.flush()
            contacts[company_name] = contact

        for index, (title, company_name, stage_name, value, close_days, entered_days) in enumerate(
            DEALS
        ):
            exists = await db.scalar(select(Deal.id).where(Deal.title == title))
            if exists is None:
                stage = stages[stage_name]
                db.add(
                    Deal(
                        title=title,
                        company_id=companies[company_name].id,
                        primary_contact_id=contacts[company_name].id,
                        owner_id=users[index % len(users)].id,
                        stage_id=stage.id,
                        value=Decimal(value),
                        currency="USD",
                        probability=stage.probability,
                        expected_close_date=now + timedelta(days=close_days),
                        last_activity_at=now - timedelta(days=max(1, abs(entered_days) // 2)),
                        stage_entered_at=now + timedelta(days=entered_days),
                        notes="Portfolio demo opportunity with realistic sales operations context.",
                    )
                )

        for index, (company_name, company) in enumerate(companies.items()):
            exists = await db.scalar(
                select(Lead.id).where(
                    Lead.company_id == company.id, Lead.status != LeadStatus.CONVERTED
                )
            )
            if exists is None:
                db.add(
                    Lead(
                        company_id=company.id,
                        primary_contact_id=contacts[company_name].id,
                        owner_id=users[index % len(users)].id,
                        source=list(LeadSource)[index % len(LeadSource)],
                        status=[LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUALIFIED][
                            index % 3
                        ],
                        estimated_value=Decimal(12000 + index * 5500),
                        priority=list(LeadPriority)[index % len(LeadPriority)],
                        next_follow_up_at=now + timedelta(days=index - 2),
                        notes="Demo lead prepared for portfolio walkthroughs.",
                    )
                )

        await db.commit()

        demo_deals = {
            deal.title: deal
            for deal in (
                await db.execute(select(Deal).where(Deal.title.in_([item[0] for item in DEALS])))
            ).scalars()
        }
        demo_leads = list((await db.execute(select(Lead).order_by(Lead.created_at))).scalars())
        task_specs = [
            (
                "Confirm technical discovery agenda",
                "CloudCore partner CRM",
                1,
                TaskPriority.HIGH,
                TaskStatus.IN_PROGRESS,
            ),
            (
                "Send ROI summary and implementation plan",
                "FinSight sales workspace",
                -1,
                TaskPriority.HIGH,
                TaskStatus.TODO,
            ),
            (
                "Prepare procurement follow-up",
                "Atlas supplier portal",
                2,
                TaskPriority.MEDIUM,
                TaskStatus.TODO,
            ),
            (
                "Review rollout stakeholders",
                "Evergreen intake automation",
                4,
                TaskPriority.MEDIUM,
                TaskStatus.TODO,
            ),
            (
                "Share renewal success metrics",
                "Brightpath renewal platform",
                -3,
                TaskPriority.LOW,
                TaskStatus.DONE,
            ),
        ]
        for index, (title, deal_title, due_days, priority, task_state) in enumerate(task_specs):
            if await db.scalar(select(CrmTask.id).where(CrmTask.title == title)) is None:
                completed_at = now - timedelta(days=1) if task_state == TaskStatus.DONE else None
                db.add(
                    CrmTask(
                        title=title,
                        description=(
                            "Portfolio demo follow-up generated from the live sales workflow."
                        ),
                        status=task_state,
                        priority=priority,
                        due_at=now + timedelta(days=due_days),
                        completed_at=completed_at,
                        assignee_id=users[index % len(users)].id,
                        related_deal_id=demo_deals[deal_title].id,
                    )
                )
        if demo_leads:
            title = "Qualify the highest-value inbound lead"
            if await db.scalar(select(CrmTask.id).where(CrmTask.title == title)) is None:
                db.add(
                    CrmTask(
                        title=title,
                        description="Validate business need, timing, and decision process.",
                        status=TaskStatus.TODO,
                        priority=TaskPriority.HIGH,
                        due_at=now + timedelta(days=1),
                        assignee_id=demo_leads[0].owner_id,
                        related_lead_id=demo_leads[0].id,
                    )
                )

        activity_specs = [
            (
                "CloudCore partner CRM",
                ActivityType.MEETING,
                "Discovery workshop completed",
                "Mapped the partner onboarding workflow and agreed on success metrics.",
                2,
            ),
            (
                "Atlas supplier portal",
                ActivityType.EMAIL,
                "Security overview shared",
                "Sent the architecture and access-control summary to procurement.",
                1,
            ),
            (
                "Evergreen intake automation",
                ActivityType.CALL,
                "Stakeholder alignment call",
                "Confirmed the phased rollout and clinical operations stakeholders.",
                3,
            ),
        ]
        for index, (deal_title, activity_kind, summary, details, days_ago) in enumerate(
            activity_specs
        ):
            if (
                await db.scalar(
                    select(DealActivity.id).where(
                        DealActivity.deal_id == demo_deals[deal_title].id,
                        DealActivity.summary == summary,
                    )
                )
                is None
            ):
                db.add(
                    DealActivity(
                        deal_id=demo_deals[deal_title].id,
                        actor_id=users[index % len(users)].id,
                        activity_type=activity_kind,
                        summary=summary,
                        details=details,
                        occurred_at=now - timedelta(days=days_ago),
                    )
                )

        await db.commit()
        counts = {
            "stages": await db.scalar(select(func.count()).select_from(PipelineStage)) or 0,
            "companies": await db.scalar(select(func.count()).select_from(Company)) or 0,
            "contacts": await db.scalar(select(func.count()).select_from(Contact)) or 0,
            "leads": await db.scalar(select(func.count()).select_from(Lead)) or 0,
            "deals": await db.scalar(select(func.count()).select_from(Deal)) or 0,
            "tasks": await db.scalar(select(func.count()).select_from(CrmTask)) or 0,
            "activities": await db.scalar(select(func.count()).select_from(DealActivity)) or 0,
        }
    output(
        "Demo CRM data is ready: " + ", ".join(f"{key}={value}" for key, value in counts.items())
    )
    return counts


if __name__ == "__main__":
    asyncio.run(seed_demo_data())
