"""Integration tests for Task Orchestration and Approval Workflows."""

from pathlib import Path
import pytest
from policy_engine.policy import PolicyEngine, RiskTier
from audit.logger import AuditLogger
from services.task_orchestrator.orchestrator import TaskOrchestrator
from shared_contracts.models import TaskStatus


def test_tier4_requires_approval(tmp_path):
    policy_engine = PolicyEngine(workspace_root=tmp_path)
    audit_logger = AuditLogger()
    orchestrator = TaskOrchestrator(policy_engine=policy_engine, audit_logger=audit_logger)

    # Submit Tier 4 task (delete_workspace_file)
    task = orchestrator.submit_task(
        tool_name="delete_workspace_file",
        target_device_id="dev-test-1",
        requesting_identity="claude_agent",
        arguments={"relative_path": "old.log"},
    )
    assert task.status == TaskStatus.PENDING_APPROVAL
    assert task.risk_tier == RiskTier.TIER_4_HIGH_RISK
    assert task.requires_approval is True

    # Approve task
    approved_task = orchestrator.approve_task(task.task_id, approver_identity="admin_alice")
    assert approved_task.status == TaskStatus.QUEUED
    assert approved_task.approved_by == "admin_alice"


def test_automatic_backup_before_edit(tmp_path):
    policy_engine = PolicyEngine(workspace_root=tmp_path)
    audit_logger = AuditLogger()
    orchestrator = TaskOrchestrator(policy_engine=policy_engine, audit_logger=audit_logger)

    target_file = tmp_path / "app.py"
    target_file.write_text("print('version 1')")

    task = orchestrator.submit_task(
        tool_name="edit_workspace_file",
        target_device_id="dev-test-1",
        requesting_identity="claude_agent",
        arguments={"relative_path": "app.py", "content": "print('version 2')"},
    )

    if task.status == TaskStatus.PENDING_APPROVAL:
        orchestrator.approve_task(task.task_id, approver_identity="admin_bob")

    # Execute task with runner
    def runner(args):
        target_file.write_text(args["content"])
        return {"bytes": len(args["content"])}

    completed_task = orchestrator.execute_task(task.task_id, runner)
    assert completed_task.status == TaskStatus.COMPLETED
    assert completed_task.backup_path is not None
    assert (tmp_path / completed_task.backup_path).exists()
    assert (tmp_path / completed_task.backup_path).read_text() == "print('version 1')"
