"""Unit tests for AI Bridge shared domain models and contracts."""

import pytest
from shared_contracts.models import (
    Device,
    DeviceOS,
    DeviceStatus,
    RiskTier,
    TaskDefinition,
    TaskStatus,
)


def test_device_contract():
    dev = Device(
        id="dev-test-1",
        hostname="test-host",
        os=DeviceOS.LINUX,
        os_version="Ubuntu 24.04",
        last_seen_epoch=1742080000,
        workspace_root="/opt/workspace",
        enrolled_at=1742000000,
    )
    assert dev.id == "dev-test-1"
    assert dev.status == DeviceStatus.ONLINE
    assert dev.os == DeviceOS.LINUX


def test_task_definition_status():
    task = TaskDefinition(
        task_id="task-1",
        tool_name="read_workspace_file",
        target_device_id="dev-test-1",
        requesting_identity="claude_agent",
        risk_tier=RiskTier.TIER_1_READ_ONLY,
        arguments={"relative_path": "README.md"},
        requires_approval=False,
        status=TaskStatus.QUEUED,
        created_at=1742080000,
        updated_at=1742080000,
    )
    assert not task.requires_approval
    assert task.risk_tier == RiskTier.TIER_1_READ_ONLY
