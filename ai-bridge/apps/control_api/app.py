"""AI Bridge — Central Remote Control API Service."""

import time
import uuid
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, Header, Depends
from pydantic import BaseModel, Field

from shared_contracts.models import (
    ApprovalRequest,
    AuditEvent,
    Device,
    DeviceOS,
    DeviceStatus,
    DeviceTelemetry,
    RiskTier,
    TaskDefinition,
    TaskStatus,
)
from policy_engine.policy import PolicyEngine
from audit.logger import AuditLogger
from services.task_orchestrator.orchestrator import TaskOrchestrator

app = FastAPI(title="AI Bridge Control API", version="1.0.0")

# In-memory storage for devices, tokens, and system state
policy_engine = PolicyEngine()
audit_logger = AuditLogger()
orchestrator = TaskOrchestrator(policy_engine=policy_engine, audit_logger=audit_logger)

ENROLLMENT_TOKENS: Dict[str, Dict[str, Any]] = {
    "bootstrap-token-alpha": {"created_at": int(time.time()), "max_uses": 5, "uses": 0}
}
DEVICE_TOKENS: Dict[str, str] = {}  # device_id -> auth_token
REGISTERED_DEVICES: Dict[str, Device] = {}

# Seed initial demonstration devices
_dev1 = Device(
    id="dev-prod-linux-01",
    hostname="srv-prod-api-01.internal",
    os=DeviceOS.LINUX,
    os_version="Ubuntu 24.04 LTS (Kernel 6.8.0-generic)",
    status=DeviceStatus.ONLINE,
    ip_address="10.0.4.12",
    agent_version="1.0.0",
    last_seen_epoch=int(time.time()),
    workspace_root="/opt/ai-bridge/workspace",
    tags=["production", "api", "linux"],
    enrolled_at=int(time.time()) - 86400 * 14,
    desktop_enabled=False,
    telemetry=DeviceTelemetry(
        cpu_percent=14.2,
        memory_used_mb=4210.0,
        memory_total_mb=16384.0,
        disk_used_gb=42.1,
        disk_total_gb=200.0,
        uptime_seconds=1284000,
        load_avg=[0.42, 0.38, 0.25],
    ),
)
REGISTERED_DEVICES[_dev1.id] = _dev1
DEVICE_TOKENS[_dev1.id] = "tok-dev-prod-linux-01-secret"

_dev2 = Device(
    id="dev-stage-win-02",
    hostname="win-qa-workstation-02",
    os=DeviceOS.WINDOWS,
    os_version="Windows 11 Pro 23H2 (Build 22631)",
    status=DeviceStatus.ONLINE,
    ip_address="10.0.8.44",
    agent_version="1.0.0",
    last_seen_epoch=int(time.time()),
    workspace_root="C:\\Workspace\\ai-bridge",
    tags=["staging", "windows", "desktop-automation"],
    enrolled_at=int(time.time()) - 86400 * 5,
    desktop_enabled=True,
    telemetry=DeviceTelemetry(
        cpu_percent=22.8,
        memory_used_mb=7820.0,
        memory_total_mb=32768.0,
        disk_used_gb=180.5,
        disk_total_gb=512.0,
        uptime_seconds=348200,
        load_avg=[0.22, 0.18, 0.15],
    ),
)
REGISTERED_DEVICES[_dev2.id] = _dev2
DEVICE_TOKENS[_dev2.id] = "tok-dev-stage-win-02-secret"


# --- Request/Response Models ---
class EnrollRequest(BaseModel):
    token: str
    hostname: str
    os: str
    os_version: str
    machine: str = "x86_64"


class HeartbeatRequest(BaseModel):
    timestamp: int
    telemetry: DeviceTelemetry


class SubmitTaskRequest(BaseModel):
    tool_name: str
    target_device_id: str
    requesting_identity: str = "ai_assistant"
    arguments: Dict[str, Any] = Field(default_factory=dict)
    timeout_seconds: int = 60


class ApprovalDecisionRequest(BaseModel):
    reviewer_identity: str = "operator"
    reason: Optional[str] = None


# --- Endpoints ---
@app.get("/api/health")
def get_health():
    return {
        "status": "healthy",
        "emergency_stop_active": policy_engine.emergency_stop_active,
        "enrolled_devices": len(REGISTERED_DEVICES),
        "active_tasks": len([t for t in orchestrator.tasks.values() if t.status in [TaskStatus.QUEUED, TaskStatus.RUNNING]]),
    }


@app.post("/api/emergency-stop/trigger")
def trigger_emergency_stop():
    policy_engine.trigger_emergency_stop()
    audit_logger.log(actor="operator", action="emergency_stop_triggered", outcome="success")
    return {"emergency_stop_active": True, "message": "Global Emergency Stop engaged. All tasks halted."}


@app.post("/api/emergency-stop/reset")
def reset_emergency_stop():
    policy_engine.reset_emergency_stop()
    audit_logger.log(actor="operator", action="emergency_stop_reset", outcome="success")
    return {"emergency_stop_active": False, "message": "Emergency Stop released. Normal operations resumed."}


@app.get("/api/devices")
def list_devices():
    return list(REGISTERED_DEVICES.values())


@app.post("/api/devices/enroll")
def enroll_device(req: EnrollRequest):
    if req.token not in ENROLLMENT_TOKENS:
        raise HTTPException(status_code=401, detail="Invalid or expired enrollment token.")

    token_info = ENROLLMENT_TOKENS[req.token]
    if token_info["uses"] >= token_info["max_uses"]:
        raise HTTPException(status_code=401, detail="Enrollment token has reached its usage limit.")

    token_info["uses"] += 1
    device_id = f"dev-{req.os}-{uuid.uuid4().hex[:6]}"
    auth_token = f"tok-{uuid.uuid4().hex}"

    target_os = DeviceOS.WINDOWS if req.os == "windows" else DeviceOS.LINUX

    new_device = Device(
        id=device_id,
        hostname=req.hostname,
        os=target_os,
        os_version=req.os_version,
        status=DeviceStatus.ONLINE,
        ip_address="127.0.0.1",
        agent_version="1.0.0",
        last_seen_epoch=int(time.time()),
        workspace_root="/opt/ai-bridge/workspace" if target_os == DeviceOS.LINUX else "C:\\Workspace\\ai-bridge",
        enrolled_at=int(time.time()),
        telemetry=DeviceTelemetry(),
    )
    REGISTERED_DEVICES[device_id] = new_device
    DEVICE_TOKENS[device_id] = auth_token

    audit_logger.log(
        actor="system",
        action="device_enrolled",
        device_id=device_id,
        payload={"hostname": req.hostname, "os": req.os},
    )
    return {"device_id": device_id, "auth_token": auth_token, "status": "enrolled"}


@app.post("/api/devices/{device_id}/revoke")
def revoke_device(device_id: str):
    if device_id not in REGISTERED_DEVICES:
        raise HTTPException(status_code=404, detail="Device not found.")

    REGISTERED_DEVICES[device_id].status = DeviceStatus.REVOKED
    if device_id in DEVICE_TOKENS:
        del DEVICE_TOKENS[device_id]

    audit_logger.log(actor="operator", action="device_revoked", device_id=device_id)
    return {"status": "revoked", "device_id": device_id}


@app.post("/api/devices/{device_id}/heartbeat")
def device_heartbeat(device_id: str, req: HeartbeatRequest, authorization: Optional[str] = Header(None)):
    if device_id not in REGISTERED_DEVICES:
        raise HTTPException(status_code=404, detail="Device not registered.")

    expected_tok = DEVICE_TOKENS.get(device_id)
    if not authorization or authorization != f"Bearer {expected_tok}":
        raise HTTPException(status_code=403, detail="Invalid device authentication token.")

    device = REGISTERED_DEVICES[device_id]
    if device.status == DeviceStatus.REVOKED:
        raise HTTPException(status_code=403, detail="Device enrollment has been revoked.")

    device.status = DeviceStatus.ONLINE
    device.last_seen_epoch = req.timestamp
    device.telemetry = req.telemetry
    return {"acknowledged": True}


@app.get("/api/tasks")
def list_tasks():
    return sorted(orchestrator.tasks.values(), key=lambda t: t.created_at, reverse=True)


@app.post("/api/tasks/submit")
def submit_task(req: SubmitTaskRequest):
    try:
        task = orchestrator.submit_task(
            tool_name=req.tool_name,
            target_device_id=req.target_device_id,
            requesting_identity=req.requesting_identity,
            arguments=req.arguments,
            timeout_seconds=req.timeout_seconds,
        )
        return task
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/approvals")
def list_approvals():
    pending = [
        t for t in orchestrator.tasks.values() if t.status == TaskStatus.PENDING_APPROVAL
    ]
    return pending


@app.post("/api/approvals/{task_id}/approve")
def approve_task(task_id: str, req: ApprovalDecisionRequest):
    try:
        task = orchestrator.approve_task(task_id, approver_identity=req.reviewer_identity)
        return task
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/approvals/{task_id}/reject")
def reject_task(task_id: str, req: ApprovalDecisionRequest):
    try:
        task = orchestrator.reject_task(
            task_id,
            reviewer_identity=req.reviewer_identity,
            reason=req.reason or "Rejected by administrator",
        )
        return task
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/audit")
def get_audit_logs(limit: int = 100):
    return audit_logger.get_events(limit=limit)
