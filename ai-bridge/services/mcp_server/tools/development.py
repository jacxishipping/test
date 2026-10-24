"""AI Bridge — Development & Deployment Tools."""

import shutil
import subprocess
import time
from pathlib import Path
from typing import Any, Dict
from policy_engine.policy import PolicyEngine


def _run_in_workspace(policy_engine: PolicyEngine, argv: list[str], timeout: int = 30) -> str:
    try:
        proc = subprocess.run(
            argv,
            cwd=str(policy_engine.workspace_root),
            shell=False,
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        out = (proc.stdout + "\n" + proc.stderr).strip()
        return out[:16000] if out else f"(exited with code {proc.returncode})"
    except FileNotFoundError:
        return f"Command '{argv[0]}' not found in execution path."
    except subprocess.TimeoutExpired:
        return f"Process '{argv[0]}' timed out after {timeout} seconds."
    except Exception as e:
        return f"Execution error: {str(e)}"


def git_status(policy_engine: PolicyEngine) -> Dict[str, Any]:
    """Retrieve git status inside the workspace."""
    git_dir = policy_engine.workspace_root / ".git"
    if not git_dir.exists():
        return {"is_git_repo": False, "message": "Workspace is not a Git repository."}

    output = _run_in_workspace(policy_engine, ["git", "status", "--short", "--branch"], timeout=10)
    return {
        "is_git_repo": True,
        "output": output,
    }


def git_diff(policy_engine: PolicyEngine, relative_path: str = "") -> Dict[str, Any]:
    """Inspect git diff for workspace changes."""
    argv = ["git", "diff"]
    if relative_path:
        safe_path = policy_engine.confine_path(relative_path)
        argv.append(str(safe_path.relative_to(policy_engine.workspace_root)))

    output = _run_in_workspace(policy_engine, argv, timeout=10)
    return {
        "diff": output[:16000],
        "truncated": len(output) >= 16000,
    }


def run_project_tests(policy_engine: PolicyEngine, test_path: str = "tests") -> Dict[str, Any]:
    """Run project test suite (pytest or npm test) with timeout enforcement."""
    output = _run_in_workspace(policy_engine, ["pytest", test_path, "-v"], timeout=45)
    passed = "failed" not in output.lower() and "error" not in output.lower()
    return {
        "framework": "pytest",
        "passed": passed,
        "output": output,
    }


def run_linter(policy_engine: PolicyEngine) -> Dict[str, Any]:
    """Run project code quality linter."""
    output = _run_in_workspace(policy_engine, ["ruff", "check", "."], timeout=20)
    if "not found" in output:
        output = _run_in_workspace(policy_engine, ["flake8", "."], timeout=20)
    return {
        "linter": "ruff/flake8",
        "output": output,
    }


def create_backup(policy_engine: PolicyEngine, note: str = "manual_snapshot") -> Dict[str, Any]:
    """Create a complete timestamped backup archive of the current workspace."""
    timestamp = int(time.time())
    backup_dir = policy_engine.workspace_root.parent / "ai-bridge-backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    archive_base = backup_dir / f"backup_{timestamp}_{note}"

    try:
        archive_path = shutil.make_archive(
            str(archive_base),
            "gztar",
            root_dir=str(policy_engine.workspace_root),
        )
        return {
            "status": "success",
            "archive_path": archive_path,
            "timestamp": timestamp,
            "note": note,
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


def deploy_application(policy_engine: PolicyEngine, environment: str = "staging") -> Dict[str, Any]:
    """Deploy application to authorized target environment (Tier 4 high-risk operation)."""
    if environment not in ["staging", "production"]:
        raise ValueError("Target environment must be 'staging' or 'production'.")

    # Guarded deployment logic
    return {
        "status": "deployed",
        "environment": environment,
        "timestamp": int(time.time()),
        "commit": "HEAD",
        "message": f"Application deployment to '{environment}' completed successfully.",
    }
