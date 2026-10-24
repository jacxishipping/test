"""AI Bridge — Risk-Based Policy Engine & Confinement."""

import os
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from shared_contracts.models import RiskTier

# Map tool names to their inherent risk tiers
TOOL_RISK_TIERS: Dict[str, RiskTier] = {
    # Discovery & Diagnostics (Tier 1: Read-Only)
    "list_devices": RiskTier.TIER_1_READ_ONLY,
    "get_device_status": RiskTier.TIER_1_READ_ONLY,
    "get_system_info": RiskTier.TIER_1_READ_ONLY,
    "get_resource_usage": RiskTier.TIER_1_READ_ONLY,
    "list_workspace": RiskTier.TIER_1_READ_ONLY,
    "read_workspace_file": RiskTier.TIER_1_READ_ONLY,
    "search_workspace": RiskTier.TIER_1_READ_ONLY,
    "get_service_status": RiskTier.TIER_1_READ_ONLY,
    "get_recent_logs": RiskTier.TIER_1_READ_ONLY,
    "list_processes": RiskTier.TIER_1_READ_ONLY,
    "get_disk_usage": RiskTier.TIER_1_READ_ONLY,
    "get_memory_usage": RiskTier.TIER_1_READ_ONLY,
    "list_docker_containers": RiskTier.TIER_1_READ_ONLY,
    "git_status": RiskTier.TIER_1_READ_ONLY,
    "git_diff": RiskTier.TIER_1_READ_ONLY,
    "get_task_status": RiskTier.TIER_1_READ_ONLY,
    "get_task_result": RiskTier.TIER_1_READ_ONLY,
    "get_desktop_status": RiskTier.TIER_1_READ_ONLY,

    # Low-Risk Changes (Tier 2)
    "create_workspace_file": RiskTier.TIER_2_LOW_RISK,
    "run_project_tests": RiskTier.TIER_2_LOW_RISK,
    "run_linter": RiskTier.TIER_2_LOW_RISK,
    "create_backup": RiskTier.TIER_2_LOW_RISK,

    # Sensitive Changes (Tier 3)
    "edit_workspace_file": RiskTier.TIER_3_SENSITIVE,
    "move_workspace_file": RiskTier.TIER_3_SENSITIVE,
    "launch_approved_application": RiskTier.TIER_3_SENSITIVE,
    "perform_approved_ui_action": RiskTier.TIER_3_SENSITIVE,
    "capture_desktop_screenshot": RiskTier.TIER_3_SENSITIVE,

    # High-Risk Operations (Tier 4)
    "delete_workspace_file": RiskTier.TIER_4_HIGH_RISK,
    "deploy_application": RiskTier.TIER_4_HIGH_RISK,
    "cancel_task": RiskTier.TIER_2_LOW_RISK,
    "request_approval": RiskTier.TIER_1_READ_ONLY,
    "approve_task": RiskTier.TIER_4_HIGH_RISK,
}

MAX_READ_BYTES = 512_000
MAX_WRITE_BYTES = 1_048_576  # 1 MB per write operation


class PolicyEngine:
    def __init__(self, workspace_root: Optional[Path] = None, allow_tier3_auto: bool = False):
        raw_ws = os.environ.get("AI_BRIDGE_WORKSPACE", str(Path.home() / "ai-bridge-workspace"))
        self.workspace_root = (workspace_root or Path(raw_ws)).expanduser().resolve()
        self.workspace_root.mkdir(parents=True, exist_ok=True)
        self.allow_tier3_auto = allow_tier3_auto
        self.emergency_stop_active = False

    def trigger_emergency_stop(self) -> None:
        self.emergency_stop_active = True

    def reset_emergency_stop(self) -> None:
        self.emergency_stop_active = False

    def classify_tool(self, tool_name: str) -> RiskTier:
        return TOOL_RISK_TIERS.get(tool_name, RiskTier.TIER_4_HIGH_RISK)

    def evaluate_request(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
        requesting_identity: str,
    ) -> Tuple[bool, bool, str]:
        """
        Evaluate if tool execution is authorized.
        Returns:
            (is_allowed, requires_approval, reason)
        """
        if self.emergency_stop_active:
            return False, False, "Emergency Stop is active. All tool executions are halted."

        risk_tier = self.classify_tool(tool_name)

        # Path validation for workspace tools
        if "relative_path" in arguments:
            try:
                self.confine_path(arguments["relative_path"])
            except ValueError as e:
                return False, False, f"Path confinement violation: {str(e)}"

        if "destination_path" in arguments:
            try:
                self.confine_path(arguments["destination_path"])
            except ValueError as e:
                return False, False, f"Destination path confinement violation: {str(e)}"

        # Content size validation
        if "content" in arguments and isinstance(arguments["content"], str):
            if len(arguments["content"].encode("utf-8")) > MAX_WRITE_BYTES:
                return False, False, f"Content exceeds maximum write quota of {MAX_WRITE_BYTES} bytes."

        # Tier-based approval rules
        if risk_tier == RiskTier.TIER_1_READ_ONLY:
            return True, False, "Tier 1: Read-only operation pre-approved."

        if risk_tier == RiskTier.TIER_2_LOW_RISK:
            return True, False, "Tier 2: Low-risk modification pre-approved within bounds."

        if risk_tier == RiskTier.TIER_3_SENSITIVE:
            if self.allow_tier3_auto:
                return True, False, "Tier 3: Pre-approved via administrator policy flag."
            return True, True, "Tier 3: Sensitive change requires operator approval."

        if risk_tier == RiskTier.TIER_4_HIGH_RISK:
            return True, True, "Tier 4: High-risk operation strictly requires explicit human confirmation."

        return False, False, "Unrecognized risk category."

    def confine_path(self, relative_path: str) -> Path:
        """
        Enforce strict confinement within workspace_root.
        Rejects empty paths, absolute paths, parent directory traversal (..),
        and resolves symlinks to verify target stays inside root.
        """
        if not isinstance(relative_path, str) or not relative_path.strip():
            raise ValueError("A non-empty relative path is required.")

        candidate = Path(relative_path)
        if candidate.is_absolute():
            raise ValueError("Absolute paths are forbidden. Provide a path relative to workspace.")

        # Normalize without resolving to detect obvious traversal
        normalized_parts = candidate.parts
        if ".." in normalized_parts:
            raise ValueError("Directory traversal ('..') is strictly forbidden.")

        resolved = (self.workspace_root / candidate).resolve()

        # Enforce that resolved path is equal to or a child of workspace_root
        if resolved != self.workspace_root and self.workspace_root not in resolved.parents:
            raise ValueError("Path escapes the configured workspace boundary.")

        return resolved
