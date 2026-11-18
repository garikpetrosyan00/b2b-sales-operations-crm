from datetime import UTC, datetime, timedelta

import pytest
from app.models.crm import PipelineStage
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from tests.test_crm import auth_headers, create_crm_fixture


async def create_deal_fixture(
    client: AsyncClient,
    headers: dict[str, str],
    session_factory: async_sessionmaker[AsyncSession],
) -> tuple[dict[str, str], dict[str, str]]:
    fixture = await create_crm_fixture(client, headers)
    async with session_factory() as db:
        stage = PipelineStage(
            name="Qualified",
            display_order=1,
            color="#6366f1",
            probability=20,
            sla_hours=72,
        )
        db.add(stage)
        await db.commit()
        stage_id = str(stage.id)
    response = await client.post(
        "/api/v1/deals",
        headers=headers,
        json={
            "title": "Acme portfolio opportunity",
            "company_id": fixture["company"],
            "primary_contact_id": fixture["contact"],
            "owner_id": fixture["user"],
            "stage_id": stage_id,
            "value": "64000",
            "currency": "USD",
        },
    )
    assert response.status_code == 201, response.text
    return fixture, response.json()


@pytest.mark.asyncio
async def test_task_workflow_and_report_metrics(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]
) -> None:
    headers = await auth_headers(client)
    fixture, deal = await create_deal_fixture(client, headers, session_factory)
    created = await client.post(
        "/api/v1/tasks",
        headers=headers,
        json={
            "title": "Prepare discovery agenda",
            "description": "Confirm stakeholders and desired business outcome.",
            "priority": "high",
            "due_at": (datetime.now(UTC) - timedelta(hours=2)).isoformat(),
            "assignee_id": fixture["user"],
            "related_deal_id": deal["id"],
        },
    )
    assert created.status_code == 201, created.text
    task = created.json()
    assert task["related_record_name"] == "Acme portfolio opportunity"
    assert task["is_overdue"] is True

    listed = await client.get("/api/v1/tasks?priority=high", headers=headers)
    assert listed.status_code == 200, listed.text
    assert listed.json()["total"] == 1
    assert listed.json()["overdue_count"] == 1

    completed = await client.patch(
        f"/api/v1/tasks/{task['id']}", headers=headers, json={"status": "done"}
    )
    assert completed.status_code == 200, completed.text
    assert completed.json()["completed_at"] is not None
    assert completed.json()["is_overdue"] is False

    report = await client.get("/api/v1/reports/summary", headers=headers)
    assert report.status_code == 200, report.text
    assert report.json()["total_pipeline"] == "64000.00"
    assert report.json()["overdue_tasks"] == 0


@pytest.mark.asyncio
async def test_deal_activity_timeline(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]
) -> None:
    headers = await auth_headers(client)
    _, deal = await create_deal_fixture(client, headers, session_factory)
    activity = await client.post(
        f"/api/v1/deals/{deal['id']}/activities",
        headers=headers,
        json={
            "activity_type": "meeting",
            "summary": "Discovery workshop completed",
            "details": "Mapped the current workflow and agreed on success metrics.",
        },
    )
    assert activity.status_code == 201, activity.text
    assert activity.json()["actor_name"] == "Demo Administrator"

    timeline = await client.get(f"/api/v1/deals/{deal['id']}/timeline", headers=headers)
    assert timeline.status_code == 200, timeline.text
    assert timeline.json()["activities"][0]["summary"] == "Discovery workshop completed"
