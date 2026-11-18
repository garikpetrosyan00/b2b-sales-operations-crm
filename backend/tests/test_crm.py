from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from app.core.security import hash_password
from app.models.crm import Deal, DealStageHistory, Lead, PipelineStage
from app.models.user import User, UserRole
from httpx import AsyncClient
from scripts.seed_demo_data import seed_demo_data
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

LOGIN = {"email": "admin@example.com", "password": "correct-horse-battery-staple"}


async def auth_headers(client: AsyncClient, payload: dict[str, str] = LOGIN) -> dict[str, str]:
    response = await client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def create_crm_fixture(client: AsyncClient, headers: dict[str, str]) -> dict[str, str]:
    users = (await client.get("/api/v1/users", headers=headers)).json()
    company = (
        await client.post(
            "/api/v1/companies",
            headers=headers,
            json={"name": "Acme Operations", "industry": "Manufacturing", "country": "US"},
        )
    ).json()
    contact = (
        await client.post(
            "/api/v1/contacts",
            headers=headers,
            json={
                "company_id": company["id"],
                "first_name": "Maya",
                "last_name": "Stone",
                "work_email": "maya@acme.example",
                "job_title": "COO",
            },
        )
    ).json()
    return {"user": users[0]["id"], "company": company["id"], "contact": contact["id"]}


@pytest.mark.asyncio
async def test_lead_crud_filter_and_conversion(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]
) -> None:
    headers = await auth_headers(client)
    fixture = await create_crm_fixture(client, headers)
    async with session_factory() as db:
        stage = PipelineStage(
            name="Qualified", display_order=1, color="#6366f1", probability=25, sla_hours=72
        )
        db.add(stage)
        await db.commit()

    created = await client.post(
        "/api/v1/leads",
        headers=headers,
        json={
            "company_id": fixture["company"],
            "primary_contact_id": fixture["contact"],
            "owner_id": fixture["user"],
            "source": "referral",
            "status": "qualified",
            "estimated_value": "42000.00",
            "priority": "high",
            "next_follow_up_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
        },
    )
    assert created.status_code == 201, created.text
    lead = created.json()
    assert lead["company_name"] == "Acme Operations"

    listed = await client.get(
        "/api/v1/leads?search=acme&lead_status=qualified&priority=high", headers=headers
    )
    assert listed.status_code == 200
    assert listed.json()["total"] == 1

    updated = await client.patch(
        f"/api/v1/leads/{lead['id']}", headers=headers, json={"priority": "urgent"}
    )
    assert updated.status_code == 200
    assert updated.json()["priority"] == "urgent"

    converted = await client.post(
        f"/api/v1/leads/{lead['id']}/convert",
        headers=headers,
        json={"title": "Acme automation rollout", "currency": "USD"},
    )
    assert converted.status_code == 201, converted.text
    assert converted.json()["source_lead_id"] == lead["id"]
    assert converted.json()["value"] == "42000.00"

    duplicate = await client.post(
        f"/api/v1/leads/{lead['id']}/convert",
        headers=headers,
        json={"title": "Duplicate opportunity"},
    )
    assert duplicate.status_code == 409


@pytest.mark.asyncio
async def test_deal_transition_records_history(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]
) -> None:
    headers = await auth_headers(client)
    fixture = await create_crm_fixture(client, headers)
    async with session_factory() as db:
        discovery = PipelineStage(
            name="Discovery", display_order=1, color="#0ea5e9", probability=30, sla_hours=48
        )
        proposal = PipelineStage(
            name="Proposal", display_order=2, color="#8b5cf6", probability=60, sla_hours=96
        )
        db.add_all([discovery, proposal])
        await db.commit()
        discovery_id, proposal_id = str(discovery.id), str(proposal.id)

    created = await client.post(
        "/api/v1/deals",
        headers=headers,
        json={
            "title": "Acme systems rollout",
            "company_id": fixture["company"],
            "primary_contact_id": fixture["contact"],
            "owner_id": fixture["user"],
            "stage_id": discovery_id,
            "value": "75000",
            "currency": "USD",
        },
    )
    assert created.status_code == 201, created.text
    deal_id = created.json()["id"]
    moved = await client.post(
        f"/api/v1/deals/{deal_id}/transition",
        headers=headers,
        json={"stage_id": proposal_id},
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["stage_name"] == "Proposal"
    assert moved.json()["probability"] == 60

    async with session_factory() as db:
        history = await db.scalar(
            select(DealStageHistory).where(DealStageHistory.deal_id == UUID(deal_id))
        )
        assert history is not None
        assert str(history.previous_stage_id) == discovery_id
        assert str(history.new_stage_id) == proposal_id


@pytest.mark.asyncio
async def test_sales_agent_cannot_access_another_owners_record(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]
) -> None:
    async with session_factory() as db:
        first = User(
            email="first.agent@example.com",
            full_name="First Agent",
            hashed_password=hash_password("first-agent-password"),
            role=UserRole.SALES_AGENT,
        )
        second = User(
            email="second.agent@example.com",
            full_name="Second Agent",
            hashed_password=hash_password("second-agent-password"),
            role=UserRole.SALES_AGENT,
        )
        db.add_all([first, second])
        await db.commit()
        first_id = str(first.id)

    admin_headers = await auth_headers(client)
    fixture = await create_crm_fixture(client, admin_headers)
    created = await client.post(
        "/api/v1/leads",
        headers=admin_headers,
        json={
            "company_id": fixture["company"],
            "primary_contact_id": fixture["contact"],
            "owner_id": first_id,
            "source": "outbound",
            "estimated_value": "10000",
        },
    )
    assert created.status_code == 201
    second_headers = await auth_headers(
        client, {"email": "second.agent@example.com", "password": "second-agent-password"}
    )
    forbidden = await client.get(f"/api/v1/leads/{created.json()['id']}", headers=second_headers)
    assert forbidden.status_code == 403
    listing = await client.get("/api/v1/leads", headers=second_headers)
    assert listing.json()["total"] == 0


@pytest.mark.asyncio
async def test_dashboard_metrics_and_demo_seed_are_idempotent(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]
) -> None:
    first = await seed_demo_data(session_factory, output=lambda _: None)
    second = await seed_demo_data(session_factory, output=lambda _: None)
    assert first == second
    assert first["deals"] >= 12

    headers = await auth_headers(client)
    response = await client.get("/api/v1/dashboard/summary", headers=headers)
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["open_deal_count"] >= 8
    assert float(payload["active_pipeline_value"]) > 0

    async with session_factory() as db:
        assert await db.scalar(select(func.count()).select_from(Deal)) == first["deals"]
        assert await db.scalar(select(func.count()).select_from(Lead)) == first["leads"]
