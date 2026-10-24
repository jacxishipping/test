import platform
import shutil
import subprocess
from typing import Callable

# Only named tasks are accepted. User input never becomes a shell command.
def _uptime() -> str:
    if platform.system() == "Windows":
        return "Uptime diagnostic: use system_info on Windows; Linux uptime command is unavailable."
    return _fixed_command(["uptime"])

def _disk_usage() -> str:
    total, used, free = shutil.disk_usage("/")
    return f"Root disk usage: total={total} bytes, used={used} bytes, free={free} bytes"

def _memory_summary() -> str:
    if platform.system() == "Linux":
        return _fixed_command(["free", "-h"])
    if platform.system() == "Windows":
        return "Memory summary is not implemented on Windows in this starter."
    return "Memory summary is not implemented for this operating system."

def _fixed_command(argv: list[str]) -> str:
    try:
        completed = subprocess.run(
            argv, shell=False, check=False, capture_output=True, text=True, timeout=5
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return f"Diagnostic unavailable: {type(exc).__name__}"
    output = (completed.stdout + completed.stderr).strip()
    return output[:8000] if output else f"Command exited with code {completed.returncode}."

TASKS: dict[str, Callable[[], str]] = {
    "uptime": _uptime,
    "disk_usage": _disk_usage,
    "memory_summary": _memory_summary,
}

def run_diagnostic(task_name: str) -> str:
    if task_name not in TASKS:
        raise ValueError(f"Task not allowed. Choose one of: {', '.join(sorted(TASKS))}")
    return TASKS[task_name]()
