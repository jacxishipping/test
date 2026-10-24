"""AI Bridge — Workspace File Tools."""

import os
import shutil
from pathlib import Path
from typing import Any, Dict, List
from policy_engine.policy import PolicyEngine, MAX_READ_BYTES


def list_workspace(policy_engine: PolicyEngine, relative_directory: str = ".") -> List[Dict[str, Any]]:
    """List directory contents within the configured workspace. Path traversal is rejected."""
    dir_path = policy_engine.confine_path(relative_directory)
    if not dir_path.exists() or not dir_path.is_dir():
        raise ValueError(f"Directory '{relative_directory}' does not exist inside workspace.")

    items = []
    for entry in sorted(dir_path.iterdir(), key=lambda p: p.name.lower())[:300]:
        try:
            safe_entry = policy_engine.confine_path(str(entry.relative_to(policy_engine.workspace_root)))
        except ValueError:
            continue

        items.append({
            "name": entry.name,
            "path": str(safe_entry.relative_to(policy_engine.workspace_root)),
            "type": "directory" if safe_entry.is_dir() else "file",
            "size_bytes": safe_entry.stat().st_size if safe_entry.is_file() else None,
            "modified_time": int(safe_entry.stat().st_mtime),
        })
    return items


def read_workspace_file(policy_engine: PolicyEngine, relative_path: str) -> str:
    """Read a UTF-8 text file inside the workspace up to the safety limit."""
    file_path = policy_engine.confine_path(relative_path)
    if not file_path.exists() or not file_path.is_file():
        raise ValueError(f"File '{relative_path}' not found in workspace.")

    if file_path.stat().st_size > MAX_READ_BYTES:
        raise ValueError(f"File exceeds maximum read size of {MAX_READ_BYTES} bytes.")

    return file_path.read_text(encoding="utf-8", errors="replace")


def search_workspace(policy_engine: PolicyEngine, query: str, max_matches: int = 50) -> List[Dict[str, Any]]:
    """Search for text queries within files in the workspace."""
    if not query or len(query.strip()) < 2:
        raise ValueError("Search query must be at least 2 characters.")

    matches = []
    root = policy_engine.workspace_root

    for current_dir, _, files in os.walk(root):
        # Ignore backup and git directories
        if ".backups" in current_dir or ".git" in current_dir:
            continue

        for fname in files:
            full_path = Path(current_dir) / fname
            try:
                safe_path = policy_engine.confine_path(str(full_path.relative_to(root)))
                if safe_path.stat().st_size > MAX_READ_BYTES:
                    continue
                text = safe_path.read_text(encoding="utf-8", errors="ignore")
                for line_no, line in enumerate(text.splitlines(), start=1):
                    if query.lower() in line.lower():
                        matches.append({
                            "file": str(safe_path.relative_to(root)),
                            "line": line_no,
                            "match": line.strip()[:200],
                        })
                        if len(matches) >= max_matches:
                            return matches
            except Exception:
                continue

    return matches


def create_workspace_file(policy_engine: PolicyEngine, relative_path: str, content: str) -> Dict[str, Any]:
    """Create a new file inside the workspace."""
    target_path = policy_engine.confine_path(relative_path)
    if target_path.exists():
        raise FileExistsError(f"File '{relative_path}' already exists. Use edit_workspace_file to modify.")

    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(content, encoding="utf-8")
    return {
        "status": "created",
        "path": relative_path,
        "bytes_written": len(content.encode("utf-8")),
    }


def edit_workspace_file(policy_engine: PolicyEngine, relative_path: str, content: str) -> Dict[str, Any]:
    """Modify an existing file inside workspace. Automatically creates a backup before overwriting."""
    target_path = policy_engine.confine_path(relative_path)
    if not target_path.exists() or not target_path.is_file():
        raise FileNotFoundError(f"File '{relative_path}' does not exist to edit.")

    target_path.write_text(content, encoding="utf-8")
    return {
        "status": "updated",
        "path": relative_path,
        "bytes_written": len(content.encode("utf-8")),
    }


def move_workspace_file(policy_engine: PolicyEngine, source_path: str, destination_path: str) -> Dict[str, Any]:
    """Move or rename a file within the workspace."""
    src = policy_engine.confine_path(source_path)
    dst = policy_engine.confine_path(destination_path)

    if not src.exists():
        raise FileNotFoundError(f"Source '{source_path}' does not exist.")
    if dst.exists():
        raise FileExistsError(f"Destination '{destination_path}' already exists.")

    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(src, dst)
    return {
        "status": "moved",
        "source": source_path,
        "destination": destination_path,
    }


def delete_workspace_file(policy_engine: PolicyEngine, relative_path: str) -> Dict[str, Any]:
    """Delete a file within workspace. High-risk operation."""
    target_path = policy_engine.confine_path(relative_path)
    if not target_path.exists():
        raise FileNotFoundError(f"File '{relative_path}' does not exist.")

    if target_path.is_file():
        target_path.unlink()
    elif target_path.is_dir():
        shutil.rmtree(target_path)

    return {
        "status": "deleted",
        "path": relative_path,
    }
