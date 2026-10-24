from pathlib import Path
import os

MAX_READ_BYTES = 128_000

def workspace_root() -> Path:
    raw = os.environ.get("AI_BRIDGE_WORKSPACE", str(Path.home() / "ai-bridge-workspace"))
    root = Path(raw).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root

def confined_path(relative_path: str) -> Path:
    """Resolve a relative path and reject traversal or symlink escape from workspace."""
    if not isinstance(relative_path, str) or not relative_path.strip():
        raise ValueError("A non-empty relative path is required.")
    candidate = Path(relative_path)
    if candidate.is_absolute():
        raise ValueError("Absolute paths are not allowed.")
    root = workspace_root()
    resolved = (root / candidate).resolve()
    if resolved != root and root not in resolved.parents:
        raise ValueError("Path escapes the configured workspace.")
    return resolved

def read_workspace_text(relative_path: str) -> str:
    path = confined_path(relative_path)
    if not path.is_file():
        raise ValueError("Path is not a regular file.")
    if path.stat().st_size > MAX_READ_BYTES:
        raise ValueError(f"File exceeds the {MAX_READ_BYTES}-byte read limit.")
    return path.read_text(encoding="utf-8", errors="replace")
