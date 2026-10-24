"""AI Bridge — Production Model Context Protocol (MCP) Server."""

import argparse
import sys
from typing import Any, Dict, List
from mcp.server.fastmcp import FastMCP
from policy_engine.policy import PolicyEngine
from audit.logger import AuditLogger
from services.task_orchestrator.orchestrator import TaskOrchestrator

from services.mcp_server.tools import discovery, files, diagnostics, development, execution, desktop

# Initialize server components
policy_engine = PolicyEngine()
audit_logger = AuditLogger()
orchestrator = TaskOrchestrator(policy_engine=policy_engine, audit_logger=audit_logger)

# Fleet device registry (starts empty for real production enrollment)
DEVICE_REGISTRY: List[Dict[str, Any]] = []

mcp = FastMCP("ai-bridge")

# --- Discovery & Health Tools ---
@mcp.tool()
def list_devices() -> List[Dict[str, Any]]:
    """List all enrolled Linux and Windows devices in the AI Bridge fleet."""
    return discovery.list_devices(DEVICE_REGISTRY)

@mcp.tool()
def get_device_status(device_id: str) -> Dict[str, Any]:
    """Retrieve operational status, uptime, and telemetry of an enrolled device."""
    return discovery.get_device_status(device_id, DEVICE_REGISTRY)

@mcp.tool()
def get_system_info() -> Dict[str, Any]:
    """Return platform metadata, OS release, and workspace path of the host."""
    return discovery.get_system_info(policy_engine)

@mcp.tool()
def get_resource_usage() -> Dict[str, Any]:
    """Retrieve current CPU, memory, and disk utilization statistics."""
    return discovery.get_resource_usage()

# --- Files Tools ---
@mcp.tool()
def list_workspace(relative_directory: str = ".") -> List[Dict[str, Any]]:
    """List directories and files inside the configured workspace with size and modification times."""
    return files.list_workspace(policy_engine, relative_directory)

@mcp.tool()
def read_workspace_file(relative_path: str) -> str:
    """Read a UTF-8 text file inside workspace (enforces path confinement and 512KB read cap)."""
    return files.read_workspace_file(policy_engine, relative_path)

@mcp.tool()
def search_workspace(query: str, max_matches: int = 50) -> List[Dict[str, Any]]:
    """Search for text within files inside the workspace with bounded line matches."""
    return files.search_workspace(policy_engine, query, max_matches)

@mcp.tool()
def create_workspace_file(relative_path: str, content: str) -> Dict[str, Any]:
    """Create a new file inside the workspace (Tier 2 low-risk change)."""
    return files.create_workspace_file(policy_engine, relative_path, content)

@mcp.tool()
def edit_workspace_file(relative_path: str, content: str) -> Dict[str, Any]:
    """Edit an existing file in the workspace (Tier 3: creates automatic rollback backup)."""
    return files.edit_workspace_file(policy_engine, relative_path, content)

@mcp.tool()
def move_workspace_file(source_path: str, destination_path: str) -> Dict[str, Any]:
    """Move or rename a file within the workspace (Tier 3 sensitive change)."""
    return files.move_workspace_file(policy_engine, source_path, destination_path)

@mcp.tool()
def delete_workspace_file(relative_path: str) -> Dict[str, Any]:
    """Delete a file within workspace (Tier 4 high-risk operation requiring approval)."""
    return files.delete_workspace_file(policy_engine, relative_path)

# --- Diagnostics Tools ---
@mcp.tool()
def get_service_status(service_name: str) -> Dict[str, Any]:
    """Inspect systemd or Windows service state and recent status logs."""
    return diagnostics.get_service_status(service_name)

@mcp.tool()
def get_recent_logs(service_or_tag: str, lines: int = 50) -> Dict[str, Any]:
    """Inspect recent journald or application log output (bounded line count)."""
    return diagnostics.get_recent_logs(service_or_tag, lines)

@mcp.tool()
def list_processes(limit: int = 30) -> List[Dict[str, Any]]:
    """List active processes with CPU and memory usage (no secret leaks)."""
    return diagnostics.list_processes(limit)

@mcp.tool()
def get_disk_usage() -> Dict[str, Any]:
    """Get detailed disk storage volume breakdown."""
    return diagnostics.get_disk_usage()

@mcp.tool()
def get_memory_usage() -> Dict[str, Any]:
    """Get detailed RAM utilization breakdown."""
    return diagnostics.get_memory_usage()

@mcp.tool()
def list_docker_containers() -> List[Dict[str, Any]]:
    """Inspect local Docker containers, images, and port mappings."""
    return diagnostics.list_docker_containers()

# --- Development Tools ---
@mcp.tool()
def git_status() -> Dict[str, Any]:
    """Inspect Git branch status and uncommitted changes in the workspace."""
    return development.git_status(policy_engine)

@mcp.tool()
def git_diff(relative_path: str = "") -> Dict[str, Any]:
    """Inspect Git diff of working directory modifications."""
    return development.git_diff(policy_engine, relative_path)

@mcp.tool()
def run_project_tests(test_path: str = "tests") -> Dict[str, Any]:
    """Run test suite with strict timeouts and output capture."""
    return development.run_project_tests(policy_engine, test_path)

@mcp.tool()
def run_linter() -> Dict[str, Any]:
    """Run code linter across workspace files."""
    return development.run_linter(policy_engine)

@mcp.tool()
def create_backup(note: str = "snapshot") -> Dict[str, Any]:
    """Create a gzipped tarball backup of the current workspace."""
    return development.create_backup(policy_engine, note)

@mcp.tool()
def deploy_application(environment: str = "staging") -> Dict[str, Any]:
    """Deploy application to staging or production (Tier 4 high-risk operation)."""
    return development.deploy_application(policy_engine, environment)

# --- Execution & Approval Tools ---
@mcp.tool()
def submit_task(tool_name: str, target_device_id: str, arguments: Dict[str, Any], timeout_seconds: int = 60) -> Dict[str, Any]:
    """Submit a task to the queue. Automatically routes Tier 3/4 tasks to approval."""
    return execution.submit_task(orchestrator, tool_name, target_device_id, "ai_assistant", arguments, timeout_seconds)

@mcp.tool()
def get_task_status(task_id: str) -> Dict[str, Any]:
    """Inspect execution state and approval status of a submitted task."""
    return execution.get_task_status(orchestrator, task_id)

@mcp.tool()
def get_task_result(task_id: str) -> Dict[str, Any]:
    """Retrieve result payload of a completed task."""
    return execution.get_task_result(orchestrator, task_id)

@mcp.tool()
def cancel_task(task_id: str) -> Dict[str, Any]:
    """Cancel a pending or running task."""
    return execution.cancel_task(orchestrator, task_id, "ai_assistant")

@mcp.tool()
def request_approval(tool_name: str, target_device_id: str, reason: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """Request human operator approval for a high-risk or sensitive operation."""
    return execution.request_approval(orchestrator, tool_name, target_device_id, reason, arguments, "ai_assistant")

@mcp.tool()
def approve_task(task_id: str) -> Dict[str, Any]:
    """Approve a pending task in the approval queue."""
    return execution.approve_task(orchestrator, task_id, "operator")

# --- Desktop Automation Tools ---
@mcp.tool()
def get_desktop_status() -> Dict[str, Any]:
    """Check whether desktop GUI automation is enabled on the device."""
    return desktop.get_desktop_status(desktop_enabled=False)

@mcp.tool()
def capture_desktop_screenshot() -> Dict[str, Any]:
    """Capture a screenshot of the authorized interactive desktop session."""
    return desktop.capture_desktop_screenshot(desktop_enabled=False)

@mcp.tool()
def launch_approved_application(app_name: str) -> Dict[str, Any]:
    """Launch an application from the strict desktop allowlist."""
    return desktop.launch_approved_application(app_name, desktop_enabled=False)

@mcp.tool()
def perform_approved_ui_action(action: str, target: str) -> Dict[str, Any]:
    """Perform a bounded UI interaction within an approved desktop application."""
    return desktop.perform_approved_ui_action(action, target, desktop_enabled=False)


def main():
    parser = argparse.ArgumentParser(description="AI Bridge MCP Server")
    parser.add_argument("--transport", choices=["stdio", "sse", "streamable-http"], default="stdio", help="Transport mechanism")
    parser.add_argument("--port", type=int, default=8080, help="Port for HTTP/SSE transport")
    args = parser.parse_args()

    if args.transport == "stdio":
        mcp.run(transport="stdio")
    else:
        mcp.run(transport="sse")


if __name__ == "__main__":
    main()
