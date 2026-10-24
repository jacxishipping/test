"""AI Bridge — Task Orchestrator & Execution Engine."""

import shutil
import time
import uuid
from pathlib import Path
from typing import Any, Callable, Dict, Optional
from policy_engine.policy import PolicyEngine
from shared_contracts.models import RiskTier, TaskDefinition, TaskStatus
from audit.logger import AuditLogger


class TaskOrchestrator:
    def __init__(self, policy_engine: PolicyEngine, audit_logger: AuditLogger):
        self.policy_engine = policy_engine
        self.audit_logger = audit_logger
        self.tasks: Dict[str, TaskDefinition] = {}
        self.cancellation_tokens: Dict[str, bool] = {}

    def submit_task(
        self,
        tool_name: str,
        target_device_id: str,
        requesting_identity: str,
        arguments: Dict[str, Any],
        timeout_seconds: int = 60,
    ) -> TaskDefinition:
        is_allowed, requires_approval, reason = self.policy_engine.evaluate_request(
            tool_name, arguments, requesting_identity
        )

        if not is_allowed:
            raise PermissionError(f"Task rejected by policy engine: {reason}")

        risk_tier = self.policy_engine.classify_tool(tool_name)
        now = int(time.time())
        task_id = f"task-{uuid.uuid4().hex[:10]}"

        status = TaskStatus.PENDING_APPROVAL if requires_approval else TaskStatus.QUEUED

        task = TaskDefinition(
            task_id=task_id,
            tool_name=tool_name,
            target_device_id=target_device_id,
            requesting_identity=requesting_identity,
            risk_tier=risk_tier,
            arguments=arguments,
            requires_approval=requires_approval,
            status=status,
            created_at=now,
            updated_at=now,
            timeout_seconds=timeout_seconds,
        )
        self.tasks[task_id] = task
        self.cancellation_tokens[task_id] = False

        self.audit_logger.log(
            actor=requesting_identity,
            action=f"task_submitted:{tool_name}",
            risk_tier=risk_tier,
            device_id=target_device_id,
            payload={"task_id": task_id, "requires_approval": requires_approval, "arguments": arguments},
        )
        return task

    def approve_task(self, task_id: str, approver_identity: str) -> TaskDefinition:
        task = self.tasks.get(task_id)
        if not task:
            raise ValueError(f"Task not found: {task_id}")

        if task.status != TaskStatus.PENDING_APPROVAL:
            raise ValueError(f"Cannot approve task with status '{task.status.value}'. Must be pending_approval.")

        task.status = TaskStatus.QUEUED
        task.approved_by = approver_identity
        task.approved_at = int(time.time())
        task.updated_at = int(time.time())

        self.audit_logger.log(
            actor=approver_identity,
            action=f"task_approved:{task.tool_name}",
            risk_tier=task.risk_tier,
            device_id=task.target_device_id,
            payload={"task_id": task_id},
        )
        return task

    def reject_task(self, task_id: str, reviewer_identity: str, reason: str = "Rejected by operator") -> TaskDefinition:
        task = self.tasks.get(task_id)
        if not task:
            raise ValueError(f"Task not found: {task_id}")

        task.status = TaskStatus.REJECTED
        task.error = reason
        task.updated_at = int(time.time())

        self.audit_logger.log(
            actor=reviewer_identity,
            action=f"task_rejected:{task.tool_name}",
            risk_tier=task.risk_tier,
            device_id=task.target_device_id,
            payload={"task_id": task_id, "reason": reason},
            outcome="denied",
        )
        return task

    def cancel_task(self, task_id: str, canceller_identity: str) -> TaskDefinition:
        task = self.tasks.get(task_id)
        if not task:
            raise ValueError(f"Task not found: {task_id}")

        self.cancellation_tokens[task_id] = True
        task.status = TaskStatus.CANCELLED
        task.updated_at = int(time.time())

        self.audit_logger.log(
            actor=canceller_identity,
            action="task_cancelled",
            device_id=task.target_device_id,
            payload={"task_id": task_id},
        )
        return task

    def execute_task(self, task_id: str, runner_func: Callable[[Dict[str, Any]], Dict[str, Any]]) -> TaskDefinition:
        task = self.tasks.get(task_id)
        if not task:
            raise ValueError(f"Task not found: {task_id}")

        if task.status != TaskStatus.QUEUED:
            raise ValueError(f"Task {task_id} is not in QUEUED state (current: {task.status}).")

        # Check for Emergency Stop
        if self.policy_engine.emergency_stop_active:
            task.status = TaskStatus.FAILED
            task.error = "Emergency Stop is active. Execution halted."
            task.updated_at = int(time.time())
            return task

        # Check for pre-execution cancellation
        if self.cancellation_tokens.get(task_id, False):
            task.status = TaskStatus.CANCELLED
            task.updated_at = int(time.time())
            return task

        # Pre-execution backup if modifying a file
        if task.tool_name in ["edit_workspace_file", "delete_workspace_file"]:
            rel_path = task.arguments.get("relative_path")
            if rel_path:
                try:
                    file_to_backup = self.policy_engine.confine_path(rel_path)
                    if file_to_backup.exists() and file_to_backup.is_file():
                        backup_dir = self.policy_engine.workspace_root / ".backups"
                        backup_dir.mkdir(parents=True, exist_ok=True)
                        ts = int(time.time())
                        backup_file = backup_dir / f"{file_to_backup.name}.{ts}.bak"
                        shutil.copy2(file_to_backup, backup_file)
                        task.backup_path = str(backup_file.relative_to(self.policy_engine.workspace_root))
                except Exception:
                    pass

        task.status = TaskStatus.RUNNING
        task.updated_at = int(time.time())

        try:
            res = runner_func(task.arguments)
            task.status = TaskStatus.COMPLETED
            task.result = res
            task.updated_at = int(time.time())
            self.audit_logger.log(
                actor=task.requesting_identity,
                action=f"task_completed:{task.tool_name}",
                risk_tier=task.risk_tier,
                device_id=task.target_device_id,
                payload={"task_id": task_id, "backup_path": task.backup_path},
            )
        except Exception as e:
            task.status = TaskStatus.FAILED
            task.error = str(e)
            task.updated_at = int(time.time())
            self.audit_logger.log(
                actor=task.requesting_identity,
                action=f"task_failed:{task.tool_name}",
                risk_tier=task.risk_tier,
                device_id=task.target_device_id,
                payload={"task_id": task_id, "error": str(e)},
                outcome="failure",
            )

        return task
