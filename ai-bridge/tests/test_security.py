from pathlib import Path
import pytest
from ai_bridge.security import confined_path, read_workspace_text

def test_path_inside_workspace(monkeypatch, tmp_path):
    monkeypatch.setenv("AI_BRIDGE_WORKSPACE", str(tmp_path))
    (tmp_path / "ok.txt").write_text("hello", encoding="utf-8")
    assert confined_path("ok.txt") == (tmp_path / "ok.txt").resolve()
    assert read_workspace_text("ok.txt") == "hello"

def test_reject_absolute_path(monkeypatch, tmp_path):
    monkeypatch.setenv("AI_BRIDGE_WORKSPACE", str(tmp_path))
    with pytest.raises(ValueError):
        confined_path(str(tmp_path / "secret.txt"))

def test_reject_parent_traversal(monkeypatch, tmp_path):
    monkeypatch.setenv("AI_BRIDGE_WORKSPACE", str(tmp_path))
    with pytest.raises(ValueError):
        confined_path("../secret.txt")
