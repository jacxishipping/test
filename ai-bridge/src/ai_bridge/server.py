import platform
from pathlib import Path
from mcp.server.fastmcp import FastMCP
from ai_bridge.security import confined_path, read_workspace_text, workspace_root
from ai_bridge.tasks import run_diagnostic

mcp = FastMCP("ai-bridge")

@mcp.tool()
def system_info() -> dict:
    """Return basic operating-system information without exposing secrets."""
    return {
        "system": platform.system(),
        "release": platform.release(),
        "machine": platform.machine(),
        "python": platform.python_version(),
        "workspace": str(workspace_root()),
    }

@mcp.tool()
def list_workspace(relative_directory: str = ".") -> list[dict]:
    """List entries inside the configured workspace. No arbitrary filesystem access."""
    directory = confined_path(relative_directory)
    if not directory.exists() or not directory.is_dir():
        raise ValueError("Directory does not exist inside the workspace.")
    items = []
    for child in sorted(directory.iterdir(), key=lambda p: p.name.lower())[:200]:
        # Resolve symlinks and omit any that escape the workspace.
        try:
            safe_child = confined_path(str(child.relative_to(workspace_root())))
        except ValueError:
            continue
        items.append({
            "name": child.name,
            "type": "directory" if safe_child.is_dir() else "file",
            "size_bytes": safe_child.stat().st_size if safe_child.is_file() else None,
        })
    return items

@mcp.tool()
def read_workspace_file(relative_path: str) -> str:
    """Read a UTF-8 text file inside the configured workspace (max 128 KB)."""
    return read_workspace_text(relative_path)

@mcp.tool()
def run_diagnostic_task(task_name: str) -> str:
    """Run one predefined, read-only diagnostic task: uptime, disk_usage, memory_summary."""
    return run_diagnostic(task_name)

if __name__ == "__main__":
    # stdio is the safest initial transport for a local MCP client.
    mcp.run(transport="stdio")
