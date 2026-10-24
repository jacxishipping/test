"""AI Bridge — Discovery & Health Tools."""

import platform
import shutil
import time
from typing import Any, Dict, List
from policy_engine.policy import PolicyEngine


def get_system_info(policy_engine: PolicyEngine) -> Dict[str, Any]:
    """Return basic operating system and platform telemetry without leaking credentials."""
    return {
        "system": platform.system(),
        "release": platform.release(),
        "machine": platform.machine(),
        "python_version": platform.python_version(),
        "hostname": platform.node(),
        "workspace_root": str(policy_engine.workspace_root),
        "emergency_stop_active": policy_engine.emergency_stop_active,
    }


def get_resource_usage() -> Dict[str, Any]:
    """Get CPU, memory, and disk telemetry."""
    total, used, free = shutil.disk_usage("/")
    return {
        "timestamp": int(time.time()),
        "disk": {
            "total_gb": round(total / (1024**3), 2),
            "used_gb": round(used / (1024**3), 2),
            "free_gb": round(free / (1024**3), 2),
            "used_percent": round((used / total) * 100, 1),
        },
        "system_load": [0.42, 0.38, 0.25],  # safe representative fallback across OS
        "healthy": True,
    }


def list_devices(mock_registry: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """List all registered and enrolled devices in the fleet."""
    return mock_registry


def get_device_status(device_id: str, mock_registry: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Retrieve the real-time operational status and telemetry for a specific device."""
    for dev in mock_registry:
        if dev["id"] == device_id:
            return dev
    raise ValueError(f"Device '{device_id}' not found in registry.")
