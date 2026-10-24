#!/usr/bin/env python3
"""AI Bridge — Release Packaging Script.
Creates a clean, production-ready distributable zip archive containing all code,
documentation, deployment assets, and tests without temporary files.
"""

import os
import shutil
import zipfile
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DIST_DIR = ROOT_DIR.parent / "public" / "release"
DIST_DIR.mkdir(parents=True, exist_ok=True)
ARCHIVE_PATH = DIST_DIR / "ai-bridge-v1.0.0.zip"

EXCLUDE_PATTERNS = {
    "__pycache__", ".pytest_cache", ".git", ".DS_Store", "*.pyc", "*.pyo"
}

def should_exclude(p: Path) -> bool:
    for part in p.parts:
        if part in EXCLUDE_PATTERNS or part.endswith(".pyc") or part.endswith(".pyo"):
            return True
    return False

def package_release():
    print(f"Building release archive: {ARCHIVE_PATH}")
    with zipfile.ZipFile(ARCHIVE_PATH, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path in ROOT_DIR.rglob("*"):
            if file_path.is_file() and not should_exclude(file_path):
                rel_path = file_path.relative_to(ROOT_DIR.parent)
                zf.write(file_path, arcname=str(rel_path))
    size_kb = round(ARCHIVE_PATH.stat().st_size / 1024, 1)
    print(f"Package created successfully: {size_kb} KB at {ARCHIVE_PATH}")

if __name__ == "__main__":
    package_release()
