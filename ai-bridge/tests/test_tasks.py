import pytest
from ai_bridge.tasks import run_diagnostic

def test_reject_arbitrary_commands():
    with pytest.raises(ValueError):
        run_diagnostic("rm -rf /")

def test_reject_unknown_task():
    with pytest.raises(ValueError):
        run_diagnostic("restart_service")
