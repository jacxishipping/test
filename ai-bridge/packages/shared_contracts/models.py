"""AI Bridge — Shared Contracts & Typed Domain Models."""

from enum import Enum
from typing import Any, Dict, List, Optional

try:
    from pydantic import BaseModel as _PydanticBaseModel, Field
    HAS_PYDANTIC = True
except ImportError:
    HAS_PYDANTIC = False
    class _PydanticBaseModel:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)
        def model_dump(self) -> Dict[str, Any]:
            res = {}
            for k, v in self.__dict__.items():
                if hasattr(v, "model_dump"):
                    res[k] = v.model_dump()
                elif hasattr(v, "value"):
                    res[k] = v.value
                else:
                    res[k] = v
            return res
        def model_dump_json(self) -> str:
            import json
            return json.dumps(self.model_dump())
    def Field(default_factory=None, **kwargs):
        return default_factory() if default_factory else None

BaseModel = _PydanticBaseModel


class RiskTier(str, Enum):
    TIER_1_READ_ONLY = "tier_1_read_only"
    TIER_2_LOW_RISK = "tier_2_low_risk"
    TIER_3_SENSITIVE = "tier_3_sensitive"
    TIER_4_HIGH_RISK = "tier_4_high_risk"


class DeviceStatus(str, Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    DEGRADED = "degraded"
    REVOKED = "revoked"


class DeviceOS(str, Enum):
    LINUX = "linux"
    WINDOWS = "windows"
    MACOS = "macos"


class TaskStatus(str, Enum):
    PENDING_APPROVAL = "pending_approval"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REJECTED = "rejected"


class DeviceTelemetry(BaseModel):
    cpu_percent: float = 0.0
    memory_used_mb: float = 0.0
    memory_total_mb: float = 0.0
    disk_used_gb: float = 0.0
    disk_total_gb: float = 0.0
    uptime_seconds: int = 0
    load_avg: List[float] = None

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not hasattr(self, 'cpu_percent'): self.cpu_percent = 0.0
        if not hasattr(self, 'memory_used_mb'): self.memory_used_mb = 0.0
        if not hasattr(self, 'memory_total_mb'): self.memory_total_mb = 0.0
        if not hasattr(self, 'disk_used_gb'): self.disk_used_gb = 0.0
        if not hasattr(self, 'disk_total_gb'): self.disk_total_gb = 0.0
        if not hasattr(self, 'uptime_seconds'): self.uptime_seconds = 0
        if not hasattr(self, 'load_avg') or self.load_avg is None: self.load_avg = [0.1, 0.2, 0.1]


class Device(BaseModel):
    id: str = ""
    hostname: str = ""
    os: DeviceOS = DeviceOS.LINUX
    os_version: str = ""
    status: DeviceStatus = DeviceStatus.ONLINE
    ip_address: str = "127.0.0.1"
    agent_version: str = "1.0.0"
    last_seen_epoch: int = 0
    workspace_root: str = ""
    telemetry: Optional[DeviceTelemetry] = None
    tags: List[str] = None
    enrolled_at: int = 0
    desktop_enabled: bool = False

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not hasattr(self, 'status'): self.status = DeviceStatus.ONLINE
        if not hasattr(self, 'tags') or self.tags is None: self.tags = []
        if not hasattr(self, 'desktop_enabled'): self.desktop_enabled = False


class TaskDefinition(BaseModel):
    task_id: str = ""
    tool_name: str = ""
    target_device_id: str = ""
    requesting_identity: str = ""
    risk_tier: RiskTier = RiskTier.TIER_1_READ_ONLY
    arguments: Dict[str, Any] = None
    requires_approval: bool = False
    status: TaskStatus = TaskStatus.QUEUED
    created_at: int = 0
    updated_at: int = 0
    approved_by: Optional[str] = None
    approved_at: Optional[int] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    timeout_seconds: int = 60
    backup_path: Optional[str] = None

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not hasattr(self, 'arguments') or self.arguments is None: self.arguments = {}
        if not hasattr(self, 'status'): self.status = TaskStatus.QUEUED
        if not hasattr(self, 'approved_by'): self.approved_by = None
        if not hasattr(self, 'approved_at'): self.approved_at = None
        if not hasattr(self, 'result'): self.result = None
        if not hasattr(self, 'error'): self.error = None
        if not hasattr(self, 'backup_path'): self.backup_path = None


class ApprovalRequest(BaseModel):
    approval_id: str = ""
    task_id: str = ""
    tool_name: str = ""
    target_device_id: str = ""
    device_hostname: str = ""
    risk_tier: RiskTier = RiskTier.TIER_3_SENSITIVE
    arguments: Dict[str, Any] = None
    reason: str = ""
    created_at: int = 0
    status: str = "pending"
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[int] = None

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not hasattr(self, 'arguments') or self.arguments is None: self.arguments = {}


class AuditEvent(BaseModel):
    event_id: str = ""
    timestamp: int = 0
    actor: str = ""
    device_id: Optional[str] = None
    action: str = ""
    risk_tier: Optional[RiskTier] = None
    payload: Dict[str, Any] = None
    outcome: str = "success"
    ip_address: Optional[str] = None

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not hasattr(self, 'payload') or self.payload is None: self.payload = {}
        if not hasattr(self, 'outcome'): self.outcome = "success"
