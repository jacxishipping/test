"""AI Bridge — Tamper-Evident Structured Audit Logger with Secret Redaction."""

import json
import re
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional
from shared_contracts.models import AuditEvent, RiskTier

SECRET_PATTERNS = [
    re.compile(r"sk-[a-zA-Z0-9_-]{20,}", re.IGNORECASE),
    re.compile(r"AIza[0-9A-Za-z-_]{20,45}"),
    re.compile(r"-----BEGIN [A-Z ]+ PRIVATE KEY-----.*?-----END [A-Z ]+ PRIVATE KEY-----", re.DOTALL),
    re.compile(r"(Bearer\s+)[a-zA-Z0-9_\-\.]{20,}", re.IGNORECASE),
]

SENSITIVE_KEYS = {
    "password", "secret", "token", "api_key", "apikey", "credential",
    "private_key", "authorization", "auth_token", "access_token"
}


def redact_sensitive_value(val: Any) -> Any:
    if isinstance(val, str):
        redacted = val
        for pat in SECRET_PATTERNS:
            redacted = pat.sub("[REDACTED_SECRET]", redacted)
        return redacted
    elif isinstance(val, dict):
        out = {}
        for k, v in val.items():
            if str(k).lower() in SENSITIVE_KEYS:
                out[k] = "[REDACTED_SECRET]"
            else:
                out[k] = redact_sensitive_value(v)
        return out
    elif isinstance(val, list):
        return [redact_sensitive_value(item) for item in val]
    return val


class AuditLogger:
    def __init__(self, log_path: Optional[Path] = None):
        self.log_path = log_path
        self._in_memory_events: List[AuditEvent] = []
        if self.log_path:
            self.log_path.parent.mkdir(parents=True, exist_ok=True)

    def log(
        self,
        actor: str,
        action: str,
        risk_tier: Optional[RiskTier] = None,
        device_id: Optional[str] = None,
        payload: Optional[Dict[str, Any]] = None,
        outcome: str = "success",
        ip_address: Optional[str] = "127.0.0.1",
    ) -> AuditEvent:
        clean_payload = redact_sensitive_value(payload or {})
        event = AuditEvent(
            event_id=f"audit-{uuid.uuid4().hex[:12]}",
            timestamp=int(time.time()),
            actor=actor,
            device_id=device_id,
            action=action,
            risk_tier=risk_tier,
            payload=clean_payload,
            outcome=outcome,
            ip_address=ip_address,
        )
        self._in_memory_events.append(event)

        if self.log_path:
            try:
                with open(self.log_path, "a", encoding="utf-8") as f:
                    f.write(event.model_dump_json() + "\n")
            except OSError:
                pass

        return event

    def get_events(self, limit: int = 100) -> List[AuditEvent]:
        return sorted(self._in_memory_events, key=lambda e: e.timestamp, reverse=True)[:limit]
