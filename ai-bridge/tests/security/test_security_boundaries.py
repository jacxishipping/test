"""Security tests for workspace confinement, traversal prevention, and secret redaction."""

import os
from pathlib import Path
import pytest
from policy_engine.policy import PolicyEngine, RiskTier
from audit.logger import AuditLogger, redact_sensitive_value


def test_reject_directory_traversal(tmp_path):
    engine = PolicyEngine(workspace_root=tmp_path)
    with pytest.raises(ValueError, match="Directory traversal"):
        engine.confine_path("../outside.txt")

    with pytest.raises(ValueError, match="Directory traversal"):
        engine.confine_path("sub/../../escape.txt")


def test_reject_absolute_path(tmp_path):
    engine = PolicyEngine(workspace_root=tmp_path)
    with pytest.raises(ValueError, match="Absolute paths are forbidden"):
        engine.confine_path("/etc/passwd")


def test_reject_symlink_escape(tmp_path):
    engine = PolicyEngine(workspace_root=tmp_path)
    outside_dir = tmp_path.parent / "forbidden_outside"
    outside_dir.mkdir(parents=True, exist_ok=True)
    outside_file = outside_dir / "secret.key"
    outside_file.write_text("SUPER_SECRET_KEY")

    # Symlink inside workspace pointing to outside
    link = tmp_path / "sneaky_link.txt"
    try:
        os.symlink(outside_file, link)
        with pytest.raises(ValueError, match="escapes the configured workspace"):
            engine.confine_path("sneaky_link.txt")
    except OSError:
        pytest.skip("Symlinks not supported on this filesystem")


def test_secret_redaction():
    payload = {
        "api_key": "sk-1234567890abcdef1234567890abcdef",
        "gemini": "AIzaSyD-1234567890abcdefghijk-123456",
        "password": "SuperSecretPassword123!",
        "safe_value": "regular_filename.txt",
    }
    redacted = redact_sensitive_value(payload)
    assert redacted["api_key"] == "[REDACTED_SECRET]"
    assert redacted["gemini"] == "[REDACTED_SECRET]"
    assert redacted["password"] == "[REDACTED_SECRET]"
    assert redacted["safe_value"] == "regular_filename.txt"


def test_emergency_stop_blocks_execution(tmp_path):
    engine = PolicyEngine(workspace_root=tmp_path)
    is_allowed, req_appr, _ = engine.evaluate_request("read_workspace_file", {"relative_path": "a.txt"}, "ai")
    assert is_allowed is True

    engine.trigger_emergency_stop()
    is_allowed_stop, _, reason = engine.evaluate_request("read_workspace_file", {"relative_path": "a.txt"}, "ai")
    assert is_allowed_stop is False
    assert "Emergency Stop is active" in reason
