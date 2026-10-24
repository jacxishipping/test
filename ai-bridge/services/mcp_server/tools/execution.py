"""AI Bridge — Task Execution & Approval Tools."""

from typing import Any, Dict
from services.task_orchestrator.orchestrator import TaskOrchestrator


def submit_task(
    orchestrator: TaskOrchestrator,
    tool_name: str,
    target_device_id: str,
    requesting_identity: str,
    arguments: Dict[str, Any],
    timeout_seconds: int = 60,
) -> Dict[str, Any]:
    """Submit a task to the queue. Tier 3/4 tasks will be placed in pending_approval state."""
    task = orchestrator.submit_task(
        tool_name=tool_name,
        target_device_id=target_device_id,
        requesting_identity=requesting_identity,
        arguments=arguments,
        timeout_seconds=timeout_seconds,
    )
    return {
        "task_id": task.task_id,
        "status": task.status.value,
        "risk_tier": task.risk_tier.value,
        "requires_approval": task.requires_approval,
    }


def get_task_status(orchestrator: TaskOrchestrator, task_id: str) -> Dict[str, Any]:
    """Check current state, approval status, and duration of a task."""
    task = orchestrator.tasks.get(task_id)
    if not task:
        raise ValueError(f"Task '{task_id}' not found.")
    return {
        "task_id": task.task_id,
        "status": task.status.value,
        "tool_name": task.tool_name,
        "requires_approval": task.requires_approval,
        "approved_by": task.approved_by,
        "error": task.error,
        "has_result": task.result is not None,
    }


def get_task_result(orchestrator: TaskOrchestrator, task_id: str) -> Dict[str, Any]:
    """Retrieve full execution result payload for a completed task."""
    task = orchestrator.tasks.get(task_id)
    if not task:
        raise ValueError(f"Task '{task_id}' not found.")
    return {
        "task_id": task.task_id,
        "status": task.status.value,
        "result": task.result,
        "error": task.error,
        "backup_path": task.backup_path,
    }


def cancel_task(orchestrator: TaskOrchestrator, task_id: str, requesting_identity: str = "operator") -> Dict[str, Any]:
    """Cancel a pending or queued task."""
    task = orchestrator.cancel_task(task_id, canceller_identity=requesting_identity)
    return {
        "task_id": task.task_id,
        "status": task.status.value,
        "cancelled": True,
    }


def request_approval(
    orchestrator: TaskOrchestrator,
    tool_name: str,
    target_device_id: str,
    reason: str,
    arguments: Dict[str, Any],
    requesting_identity: str = "ai_assistant",
) -> Dict[str, Any]:
    """Submit an explicit human approval request for a sensitive action."""
    task = orchestrator.submit_task(
        tool_name=tool_name,
        target_device_id=target_device_id,
        requesting_identity=requesting_identity,
        arguments=arguments,
    )
    return {
        "approval_id": f"appr-{task.task_id}",
        "task_id": task.task_id,
        "tool_name": tool_name,
        "status": "pending_operator_review",
        "reason": reason,
    }


def approve_task(orchestrator: TaskOrchestrator, task_id: str, approver_identity: str = "operator") -> Dict[str, Any]:
    """Approve a pending task and move it to the execution queue."""
    task = orchestrator.approve_task(task_id, approver_identity=approver_identity)
    return {
        "task_id": task.task_id,
        "status": task.status.value,
        "approved_by": approver_identity,
    }
