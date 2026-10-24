#!/usr/bin/env python3
"""AI Bridge — Standalone Zero-Dependency Test Suite Runner.
Executes contract verification, workspace security confinement, traversal protection,
secret redaction, approval workflows, and emergency stop tests.
"""

import os
import sys
import tempfile
import unittest
from pathlib import Path

# Add package directories to sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR / "packages"))
sys.path.insert(0, str(BASE_DIR / "services"))
sys.path.insert(0, str(BASE_DIR / "agents"))
sys.path.insert(0, str(BASE_DIR / "apps"))

from shared_contracts.models import (
    Device,
    DeviceOS,
    DeviceStatus,
    RiskTier,
    TaskDefinition,
    TaskStatus,
)
from policy_engine.policy import PolicyEngine, TOOL_RISK_TIERS
from audit.logger import AuditLogger, redact_sensitive_value
from services.task_orchestrator.orchestrator import TaskOrchestrator


class TestContracts(unittest.TestCase):
    def test_device_contract(self):
        dev = Device(
            id="dev-test-1",
            hostname="test-host",
            os=DeviceOS.LINUX,
            os_version="Ubuntu 24.04",
            last_seen_epoch=1742080000,
            workspace_root="/opt/workspace",
            enrolled_at=1742000000,
        )
        self.assertEqual(dev.id, "dev-test-1")
        self.assertEqual(dev.status, DeviceStatus.ONLINE)
        self.assertEqual(dev.os, DeviceOS.LINUX)

    def test_task_definition_status(self):
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
        self.assertFalse(task.requires_approval)
        self.assertEqual(task.risk_tier, RiskTier.TIER_1_READ_ONLY)


class TestSecurityBoundaries(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.workspace_root = Path(self.temp_dir.name)
        self.engine = PolicyEngine(workspace_root=self.workspace_root)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_reject_directory_traversal(self):
        with self.assertRaises(ValueError):
            self.engine.confine_path("../outside.txt")

        with self.assertRaises(ValueError):
            self.engine.confine_path("sub/../../escape.txt")

    def test_reject_absolute_path(self):
        with self.assertRaises(ValueError):
            self.engine.confine_path("/etc/passwd")

    def test_reject_empty_path(self):
        with self.assertRaises(ValueError):
            self.engine.confine_path("")

    def test_secret_redaction(self):
        payload = {
            "api_key": "sk-1234567890abcdef1234567890abcdef",
            "gemini": "AIzaSyD-1234567890abcdefghijk-123456",
            "password": "SuperSecretPassword123!",
            "safe_value": "regular_filename.txt",
        }
        redacted = redact_sensitive_value(payload)
        self.assertEqual(redacted["api_key"], "[REDACTED_SECRET]")
        self.assertEqual(redacted["gemini"], "[REDACTED_SECRET]")
        self.assertEqual(redacted["password"], "[REDACTED_SECRET]")
        self.assertEqual(redacted["safe_value"], "regular_filename.txt")

    def test_emergency_stop_blocks_execution(self):
        is_allowed, _, _ = self.engine.evaluate_request("read_workspace_file", {"relative_path": "a.txt"}, "ai")
        self.assertTrue(is_allowed)

        self.engine.trigger_emergency_stop()
        is_allowed_stop, _, reason = self.engine.evaluate_request("read_workspace_file", {"relative_path": "a.txt"}, "ai")
        self.assertFalse(is_allowed_stop)
        self.assertIn("Emergency Stop is active", reason)


class TestTaskOrchestrationAndApproval(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.workspace_root = Path(self.temp_dir.name)
        self.engine = PolicyEngine(workspace_root=self.workspace_root)
        self.audit = AuditLogger()
        self.orchestrator = TaskOrchestrator(policy_engine=self.engine, audit_logger=self.audit)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_tier4_requires_approval(self):
        task = self.orchestrator.submit_task(
            tool_name="delete_workspace_file",
            target_device_id="dev-test-1",
            requesting_identity="claude_agent",
            arguments={"relative_path": "old.log"},
        )
        self.assertEqual(task.status, TaskStatus.PENDING_APPROVAL)
        self.assertEqual(task.risk_tier, RiskTier.TIER_4_HIGH_RISK)
        self.assertTrue(task.requires_approval)

        approved = self.orchestrator.approve_task(task.task_id, approver_identity="admin_alice")
        self.assertEqual(approved.status, TaskStatus.QUEUED)
        self.assertEqual(approved.approved_by, "admin_alice")

    def test_automatic_backup_before_edit(self):
        target_file = self.workspace_root / "app.py"
        target_file.write_text("print('version 1')")

        task = self.orchestrator.submit_task(
            tool_name="edit_workspace_file",
            target_device_id="dev-test-1",
            requesting_identity="claude_agent",
            arguments={"relative_path": "app.py", "content": "print('version 2')"},
        )

        if task.status == TaskStatus.PENDING_APPROVAL:
            self.orchestrator.approve_task(task.task_id, approver_identity="admin_bob")

        def runner(args):
            target_file.write_text(args["content"])
            return {"bytes": len(args["content"])}

        completed = self.orchestrator.execute_task(task.task_id, runner)
        self.assertEqual(completed.status, TaskStatus.COMPLETED)
        self.assertIsNotNone(completed.backup_path)
        backup_file = self.workspace_root / completed.backup_path
        self.assertTrue(backup_file.exists())
        self.assertEqual(backup_file.read_text(), "print('version 1')")
        self.assertEqual(target_file.read_text(), "print('version 2')")


if __name__ == "__main__":
    print("=" * 60)
    print("  AI BRIDGE TEST SUITE (Security, Contracts, Approval, Auditing)")
    print("=" * 60)
    suite = unittest.TestLoader().loadTestsFromModule(sys.modules[__name__])
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
