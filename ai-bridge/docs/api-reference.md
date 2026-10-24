# AI Bridge API Reference

The Control API is served over HTTP/JSON with standard REST conventions.

## Base URL
`/api`

## Authentication
Device and client operations use Bearer token authentication:
`Authorization: Bearer <TOKEN>`

---

## Endpoints

### 1. Devices

#### `GET /api/devices`
List all enrolled devices, their current status (online, offline, revoked), operating system, and latest telemetry metrics.

#### `POST /api/devices/enroll`
Enroll a new agent host.
- Request Body:
```json
{
  "token": "bootstrap-token-alpha",
  "hostname": "srv-prod-api-01",
  "os": "linux",
  "os_version": "Ubuntu 24.04",
  "machine": "x86_64"
}
```
- Response:
```json
{
  "device_id": "dev-linux-a1b2c3",
  "auth_token": "tok-9f8e7d6c5b4a",
  "status": "enrolled"
}
```

#### `POST /api/devices/{device_id}/revoke`
Revoke device access immediately.

#### `POST /api/devices/{device_id}/heartbeat`
Transmit agent telemetry.

---

### 2. Task Orchestrator

#### `GET /api/tasks`
List all tasks and their execution states.

#### `POST /api/tasks/submit`
Submit a task for execution. If the tool is Tier 3 or Tier 4, the task enters `pending_approval`.

---

### 3. Approvals

#### `GET /api/approvals`
Retrieve pending tasks requiring operator review.

#### `POST /api/approvals/{task_id}/approve`
Approve a pending task for immediate queue execution.

#### `POST /api/approvals/{task_id}/reject`
Reject a pending task.

---

### 4. Emergency Stop

#### `POST /api/emergency-stop/trigger`
Engage global kill switch.

#### `POST /api/emergency-stop/reset`
Disengage kill switch.
