import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory persistent state for Control Plane
interface Device {
  id: string;
  hostname: string;
  os: 'linux' | 'windows';
  os_version: string;
  status: 'online' | 'offline' | 'degraded' | 'revoked';
  ip_address: string;
  agent_version: string;
  last_seen_epoch: number;
  workspace_root: string;
  tags: string[];
  desktop_enabled: boolean;
  telemetry: {
    cpu_percent: number;
    memory_used_mb: number;
    memory_total_mb: number;
    disk_used_gb: number;
    disk_total_gb: number;
    uptime_seconds: number;
    load_avg: number[];
  };
}

interface Task {
  task_id: string;
  tool_name: string;
  target_device_id: string;
  device_hostname: string;
  requesting_identity: string;
  risk_tier: 'tier_1_read_only' | 'tier_2_low_risk' | 'tier_3_sensitive' | 'tier_4_high_risk';
  arguments: Record<string, any>;
  requires_approval: boolean;
  status: 'pending_approval' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'rejected';
  created_at: number;
  updated_at: number;
  approved_by?: string;
  result?: any;
  error?: string;
  backup_path?: string;
  output?: string;
}

interface AuditLog {
  event_id: string;
  timestamp: number;
  actor: string;
  device_id?: string;
  action: string;
  risk_tier?: string;
  payload: Record<string, any>;
  outcome: 'success' | 'failure' | 'denied';
}

let emergencyStopActive = false;

let devices: Device[] = [
  {
    id: 'dev-prod-linux-01',
    hostname: 'srv-prod-api-01.internal',
    os: 'linux',
    os_version: 'Ubuntu 24.04 LTS (Kernel 6.8.0-generic)',
    status: 'online',
    ip_address: '10.0.4.12',
    agent_version: '1.0.0',
    last_seen_epoch: Math.floor(Date.now() / 1000),
    workspace_root: '/opt/ai-bridge/workspace',
    tags: ['production', 'api', 'linux', 'docker-host'],
    desktop_enabled: false,
    telemetry: {
      cpu_percent: 18.4,
      memory_used_mb: 4210.0,
      memory_total_mb: 16384.0,
      disk_used_gb: 42.1,
      disk_total_gb: 200.0,
      uptime_seconds: 1284000,
      load_avg: [0.42, 0.38, 0.25],
    },
  },
  {
    id: 'dev-stage-win-02',
    hostname: 'win-qa-workstation-02',
    os: 'windows',
    os_version: 'Windows 11 Pro 23H2 (Build 22631)',
    status: 'online',
    ip_address: '10.0.8.44',
    agent_version: '1.0.0',
    last_seen_epoch: Math.floor(Date.now() / 1000) - 20,
    workspace_root: 'C:\\Workspace\\ai-bridge',
    tags: ['staging', 'windows', 'desktop-automation'],
    desktop_enabled: true,
    telemetry: {
      cpu_percent: 24.6,
      memory_used_mb: 8192.0,
      memory_total_mb: 32768.0,
      disk_used_gb: 180.5,
      disk_total_gb: 512.0,
      uptime_seconds: 348200,
      load_avg: [0.24, 0.19, 0.16],
    },
  },
  {
    id: 'dev-dev-docker-03',
    hostname: 'docker-sandbox-runner',
    os: 'linux',
    os_version: 'Debian GNU/Linux 12 (bookworm)',
    status: 'online',
    ip_address: '172.18.0.2',
    agent_version: '1.0.0',
    last_seen_epoch: Math.floor(Date.now() / 1000) - 5,
    workspace_root: '/workspace/sandbox',
    tags: ['dev', 'container', 'ci-runner'],
    desktop_enabled: false,
    telemetry: {
      cpu_percent: 8.2,
      memory_used_mb: 1280.0,
      memory_total_mb: 8192.0,
      disk_used_gb: 14.8,
      disk_total_gb: 100.0,
      uptime_seconds: 86400,
      load_avg: [0.10, 0.08, 0.05],
    },
  },
];

let tasks: Task[] = [
  {
    task_id: 'task-9a8b7c6d',
    tool_name: 'read_workspace_file',
    target_device_id: 'dev-prod-linux-01',
    device_hostname: 'srv-prod-api-01.internal',
    requesting_identity: 'claude_desktop',
    risk_tier: 'tier_1_read_only',
    arguments: { relative_path: 'src/main.py' },
    requires_approval: false,
    status: 'completed',
    created_at: Math.floor(Date.now() / 1000) - 3600,
    updated_at: Math.floor(Date.now() / 1000) - 3599,
    result: { bytes_read: 1420, encoding: 'utf-8' },
    output: 'Successfully read 1,420 bytes from src/main.py. Zero path escapes detected.',
  },
  {
    task_id: 'task-8b7c6d5e',
    tool_name: 'get_service_status',
    target_device_id: 'dev-prod-linux-01',
    device_hostname: 'srv-prod-api-01.internal',
    requesting_identity: 'gemini_cli',
    risk_tier: 'tier_1_read_only',
    arguments: { service_name: 'nginx' },
    requires_approval: false,
    status: 'completed',
    created_at: Math.floor(Date.now() / 1000) - 3000,
    updated_at: Math.floor(Date.now() / 1000) - 2998,
    output: 'nginx.service is active (running) with 4 worker processes.',
  },
  {
    task_id: 'task-7c6d5e4f',
    tool_name: 'list_processes',
    target_device_id: 'dev-stage-win-02',
    device_hostname: 'win-qa-workstation-02',
    requesting_identity: 'chatgpt_mcp',
    risk_tier: 'tier_1_read_only',
    arguments: { limit: 20 },
    requires_approval: false,
    status: 'completed',
    created_at: Math.floor(Date.now() / 1000) - 2400,
    updated_at: Math.floor(Date.now() / 1000) - 2397,
    output: 'Retrieved 20 running processes via Windows CIM queries.',
  },
  {
    task_id: 'task-6d5e4f3a',
    tool_name: 'run_project_tests',
    target_device_id: 'dev-dev-docker-03',
    device_hostname: 'docker-sandbox-runner',
    requesting_identity: 'claude_code',
    risk_tier: 'tier_2_low_risk',
    arguments: { test_path: 'tests' },
    requires_approval: false,
    status: 'completed',
    created_at: Math.floor(Date.now() / 1000) - 1800,
    updated_at: Math.floor(Date.now() / 1000) - 1760,
    output: 'Pytest suite passed: 9 passed in 0.045s (100% test coverage).',
  },
  {
    task_id: 'task-5a4b3c2d',
    tool_name: 'run_linter',
    target_device_id: 'dev-prod-linux-01',
    device_hostname: 'srv-prod-api-01.internal',
    requesting_identity: 'claude_code',
    risk_tier: 'tier_2_low_risk',
    arguments: {},
    requires_approval: false,
    status: 'failed',
    error: 'Ruff linter detected 3 syntax violations in legacy_module.py.',
    created_at: Math.floor(Date.now() / 1000) - 1400,
    updated_at: Math.floor(Date.now() / 1000) - 1395,
    output: 'Execution failed: 3 lint errors found in legacy_module.py.',
  },
  {
    task_id: 'task-4b3c2d1e',
    tool_name: 'create_backup',
    target_device_id: 'dev-prod-linux-01',
    device_hostname: 'srv-prod-api-01.internal',
    requesting_identity: 'gemini_cli',
    risk_tier: 'tier_2_low_risk',
    arguments: { note: 'pre_migration_dump' },
    requires_approval: false,
    status: 'completed',
    created_at: Math.floor(Date.now() / 1000) - 900,
    updated_at: Math.floor(Date.now() / 1000) - 880,
    output: 'Created backup archive backup_pre_migration_dump.tar.gz (42.5 MB).',
  },
  {
    task_id: 'task-3c2d1e0f',
    tool_name: 'launch_approved_application',
    target_device_id: 'dev-stage-win-02',
    device_hostname: 'win-qa-workstation-02',
    requesting_identity: 'chatgpt_mcp',
    risk_tier: 'tier_3_sensitive',
    arguments: { app_name: 'code' },
    requires_approval: false,
    status: 'completed',
    created_at: Math.floor(Date.now() / 1000) - 600,
    updated_at: Math.floor(Date.now() / 1000) - 598,
    output: 'Launched approved desktop application: code in Session 1.',
  },
  {
    task_id: 'task-2d1e0f9a',
    tool_name: 'capture_desktop_screenshot',
    target_device_id: 'dev-stage-win-02',
    device_hostname: 'win-qa-workstation-02',
    requesting_identity: 'claude_desktop',
    risk_tier: 'tier_3_sensitive',
    arguments: {},
    requires_approval: false,
    status: 'failed',
    error: 'Desktop capture timeout: user session locked by screen saver policy.',
    created_at: Math.floor(Date.now() / 1000) - 450,
    updated_at: Math.floor(Date.now() / 1000) - 440,
    output: 'Failed: Session display buffer locked by screensaver.',
  },
  {
    task_id: 'task-1f2e3d4c',
    tool_name: 'edit_workspace_file',
    target_device_id: 'dev-stage-win-02',
    device_hostname: 'win-qa-workstation-02',
    requesting_identity: 'chatgpt_mcp',
    risk_tier: 'tier_3_sensitive',
    arguments: { relative_path: 'config/app_settings.json', content: '{"port": 8080, "workers": 4, "env": "staging"}' },
    requires_approval: true,
    status: 'pending_approval',
    created_at: Math.floor(Date.now() / 1000) - 300,
    updated_at: Math.floor(Date.now() / 1000) - 300,
    output: 'Tier 3 Sensitive Change: modification of configuration file. Automatic rollback backup prepared at .backups/app_settings.json.bak.',
  },
  {
    task_id: 'task-0e9d8c7b',
    tool_name: 'deploy_application',
    target_device_id: 'dev-prod-linux-01',
    device_hostname: 'srv-prod-api-01.internal',
    requesting_identity: 'claude_desktop',
    risk_tier: 'tier_4_high_risk',
    arguments: { environment: 'staging' },
    requires_approval: true,
    status: 'completed',
    approved_by: 'operator_alice',
    created_at: Math.floor(Date.now() / 1000) - 250,
    updated_at: Math.floor(Date.now() / 1000) - 220,
    output: 'Approved by operator_alice. Blue-green deployment to staging succeeded.',
  },
  {
    task_id: 'task-5e4d3c2b',
    tool_name: 'delete_workspace_file',
    target_device_id: 'dev-prod-linux-01',
    device_hostname: 'srv-prod-api-01.internal',
    requesting_identity: 'gemini_cli',
    risk_tier: 'tier_4_high_risk',
    arguments: { relative_path: 'temp_debug_dump.tar.gz' },
    requires_approval: true,
    status: 'pending_approval',
    created_at: Math.floor(Date.now() / 1000) - 60,
    updated_at: Math.floor(Date.now() / 1000) - 60,
    output: 'Tier 4 High-Risk Operation: file deletion requested. Blast radius: local workspace unrecoverable if unbacked. Awaiting operator confirmation.',
  },
  {
    task_id: 'task-9f8e7d6c',
    tool_name: 'deploy_application',
    target_device_id: 'dev-dev-docker-03',
    device_hostname: 'docker-sandbox-runner',
    requesting_identity: 'claude_code',
    risk_tier: 'tier_4_high_risk',
    arguments: { environment: 'production' },
    requires_approval: true,
    status: 'failed',
    error: 'Container preflight healthcheck failed: port 8000 connection refused.',
    created_at: Math.floor(Date.now() / 1000) - 150,
    updated_at: Math.floor(Date.now() / 1000) - 120,
    output: 'Deployment aborted: health probe failed after 30 seconds.',
  },
  {
    task_id: 'task-8e7d6c5b',
    tool_name: 'delete_workspace_file',
    target_device_id: 'dev-stage-win-02',
    device_hostname: 'win-qa-workstation-02',
    requesting_identity: 'gemini_cli',
    risk_tier: 'tier_4_high_risk',
    arguments: { relative_path: 'certificates/rootCA.crt' },
    requires_approval: true,
    status: 'rejected',
    error: 'Rejected by operator: certificates directory is protected.',
    created_at: Math.floor(Date.now() / 1000) - 100,
    updated_at: Math.floor(Date.now() / 1000) - 95,
    output: 'Rejected: Certificates are critical assets and cannot be removed by AI.',
  },
];

let auditLogs: AuditLog[] = [
  {
    event_id: 'audit-001',
    timestamp: Math.floor(Date.now() / 1000) - 180,
    actor: 'claude_desktop',
    device_id: 'dev-prod-linux-01',
    action: 'tool_invoke:read_workspace_file',
    risk_tier: 'tier_1_read_only',
    payload: { relative_path: 'src/main.py' },
    outcome: 'success',
  },
  {
    event_id: 'audit-002',
    timestamp: Math.floor(Date.now() / 1000) - 120,
    actor: 'system_probe',
    device_id: 'dev-prod-linux-01',
    action: 'heartbeat_received',
    risk_tier: 'tier_1_read_only',
    payload: { cpu: 18.4, mem_mb: 4210 },
    outcome: 'success',
  },
  {
    event_id: 'audit-003',
    timestamp: Math.floor(Date.now() / 1000) - 60,
    actor: 'gemini_cli',
    device_id: 'dev-prod-linux-01',
    action: 'task_submitted:delete_workspace_file',
    risk_tier: 'tier_4_high_risk',
    payload: { relative_path: 'temp_debug_dump.tar.gz' },
    outcome: 'success',
  },
];

// Helper: redact secrets from payload
function redactSecrets(obj: any): any {
  if (typeof obj === 'string') {
    return obj
      .replace(/sk-[a-zA-Z0-9_-]{20,}/gi, '[REDACTED_SECRET]')
      .replace(/AIza[0-9A-Za-z-_]{20,45}/g, '[REDACTED_SECRET]')
      .replace(/-----BEGIN [A-Z ]+ PRIVATE KEY-----.*?-----END [A-Z ]+ PRIVATE KEY-----/gs, '[REDACTED_PRIVATE_KEY]')
      .replace(/(Bearer\s+)[a-zA-Z0-9_\-\.]{20,}/gi, '$1[REDACTED_SECRET]');
  }
  if (typeof obj === 'object' && obj !== null) {
    const res: Record<string, any> = Array.isArray(obj) ? [] : {};
    for (const [k, v] of Object.entries(obj)) {
      if (/password|secret|token|api_key|credential/i.test(k)) {
        res[k] = '[REDACTED_SECRET]';
      } else {
        res[k] = redactSecrets(v);
      }
    }
    return res;
  }
  return obj;
}

// Log audit event
function recordAudit(actor: string, action: string, device_id: string | undefined, payload: any, outcome: 'success' | 'failure' | 'denied' = 'success', risk_tier?: string) {
  const event: AuditLog = {
    event_id: `audit-${Math.random().toString(36).substring(2, 9)}`,
    timestamp: Math.floor(Date.now() / 1000),
    actor,
    device_id,
    action,
    risk_tier,
    payload: redactSecrets(payload),
    outcome,
  };
  auditLogs.unshift(event);
  if (auditLogs.length > 200) auditLogs.pop();
  return event;
}

// REST API Endpoints
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    emergency_stop_active: emergencyStopActive,
    enrolled_devices: devices.length,
    active_tasks: tasks.filter(t => t.status === 'running' || t.status === 'queued').length,
    pending_approvals: tasks.filter(t => t.status === 'pending_approval').length,
  });
});

app.get('/api/emergency-stop/status', (req: Request, res: Response) => {
  res.json({ emergency_stop_active: emergencyStopActive });
});

app.post('/api/emergency-stop/toggle', (req: Request, res: Response) => {
  emergencyStopActive = !emergencyStopActive;
  const outcome = emergencyStopActive ? 'triggered' : 'reset';
  recordAudit('operator', `emergency_stop_${outcome}`, undefined, {}, 'success');
  res.json({
    emergency_stop_active: emergencyStopActive,
    message: emergencyStopActive
      ? 'Global Emergency Stop engaged. All task executions halted.'
      : 'Emergency Stop released. Normal operations resumed.',
  });
});

app.get('/api/devices', (req: Request, res: Response) => {
  res.json(devices);
});

app.post('/api/devices/enroll', (req: Request, res: Response) => {
  const { hostname, os, tags, desktop_enabled } = req.body;
  if (!hostname || !os) {
    return res.status(400).json({ error: 'hostname and os are required.' });
  }

  const newDevice: Device = {
    id: `dev-${os}-${Math.random().toString(36).substring(2, 8)}`,
    hostname: hostname.trim(),
    os: os === 'windows' ? 'windows' : 'linux',
    os_version: os === 'windows' ? 'Windows 11 Pro 23H2' : 'Ubuntu 24.04 LTS',
    status: 'online',
    ip_address: '10.0.' + Math.floor(Math.random() * 254) + '.' + Math.floor(Math.random() * 254),
    agent_version: '1.0.0',
    last_seen_epoch: Math.floor(Date.now() / 1000),
    workspace_root: os === 'windows' ? 'C:\\Workspace\\ai-bridge' : '/opt/ai-bridge/workspace',
    tags: Array.isArray(tags) ? tags : ['auto-enrolled', os],
    desktop_enabled: Boolean(desktop_enabled),
    telemetry: {
      cpu_percent: Math.round(Math.random() * 25 * 10) / 10,
      memory_used_mb: 3200,
      memory_total_mb: 16384,
      disk_used_gb: 25.4,
      disk_total_gb: 250.0,
      uptime_seconds: 3600,
      load_avg: [0.15, 0.12, 0.10],
    },
  };

  devices.unshift(newDevice);
  recordAudit('operator', 'device_enrolled', newDevice.id, { hostname, os });
  res.status(201).json({
    device: newDevice,
    auth_token: `tok-${Math.random().toString(36).substring(2, 14)}`,
    message: 'Device enrolled successfully.',
  });
});

app.post('/api/devices/:id/revoke', (req: Request, res: Response) => {
  const { id } = req.params;
  const dev = devices.find(d => d.id === id);
  if (!dev) {
    return res.status(404).json({ error: 'Device not found.' });
  }
  dev.status = 'revoked';
  recordAudit('operator', 'device_revoked', id, { hostname: dev.hostname });
  res.json({ message: `Device ${id} access has been revoked.`, device: dev });
});

app.get('/api/tasks', (req: Request, res: Response) => {
  res.json(tasks);
});

app.post('/api/tasks/submit', (req: Request, res: Response) => {
  if (emergencyStopActive) {
    return res.status(403).json({ error: 'Emergency Stop is active. All submissions blocked.' });
  }

  const { tool_name, target_device_id, arguments: args, requesting_identity } = req.body;
  if (!tool_name || !target_device_id) {
    return res.status(400).json({ error: 'tool_name and target_device_id are required.' });
  }

  const targetDev = devices.find(d => d.id === target_device_id);
  if (!targetDev) {
    return res.status(404).json({ error: 'Target device not found.' });
  }
  if (targetDev.status === 'revoked') {
    return res.status(403).json({ error: 'Device enrollment is revoked.' });
  }

  // Risk tier classification
  let risk_tier: Task['risk_tier'] = 'tier_1_read_only';
  let requires_approval = false;

  if (['create_workspace_file', 'run_project_tests', 'run_linter', 'create_backup'].includes(tool_name)) {
    risk_tier = 'tier_2_low_risk';
  } else if (['edit_workspace_file', 'move_workspace_file', 'launch_approved_application', 'perform_approved_ui_action', 'capture_desktop_screenshot'].includes(tool_name)) {
    risk_tier = 'tier_3_sensitive';
    requires_approval = true;
  } else if (['delete_workspace_file', 'deploy_application', 'approve_task'].includes(tool_name)) {
    risk_tier = 'tier_4_high_risk';
    requires_approval = true;
  }

  const taskId = `task-${Math.random().toString(36).substring(2, 10)}`;
  const now = Math.floor(Date.now() / 1000);

  const newTask: Task = {
    task_id: taskId,
    tool_name,
    target_device_id,
    device_hostname: targetDev.hostname,
    requesting_identity: requesting_identity || 'ai_assistant',
    risk_tier,
    arguments: args || {},
    requires_approval,
    status: requires_approval ? 'pending_approval' : 'completed',
    created_at: now,
    updated_at: now,
    output: requires_approval
      ? `Task paused in approval queue. Operator review required for ${risk_tier.toUpperCase()}.`
      : `Executed successfully on ${targetDev.hostname}. Result payload validated.`,
    result: requires_approval ? undefined : { execution_time_ms: 45, exit_code: 0, status: 'ok' },
  };

  tasks.unshift(newTask);
  recordAudit(newTask.requesting_identity, `task_submitted:${tool_name}`, target_device_id, { args }, 'success', risk_tier);

  res.status(201).json(newTask);
});

app.post('/api/tasks/:id/cancel', (req: Request, res: Response) => {
  const { id } = req.params;
  const task = tasks.find(t => t.task_id === id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });

  task.status = 'cancelled';
  task.updated_at = Math.floor(Date.now() / 1000);
  task.output = 'Cancelled by operator.';
  recordAudit('operator', 'task_cancelled', task.target_device_id, { task_id: id });
  res.json(task);
});

app.get('/api/approvals', (req: Request, res: Response) => {
  const pending = tasks.filter(t => t.status === 'pending_approval');
  res.json(pending);
});

app.post('/api/approvals/:id/approve', (req: Request, res: Response) => {
  if (emergencyStopActive) {
    return res.status(403).json({ error: 'Cannot approve tasks while Emergency Stop is engaged.' });
  }

  const { id } = req.params;
  const task = tasks.find(t => t.task_id === id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });
  if (task.status !== 'pending_approval') {
    return res.status(400).json({ error: `Task status is '${task.status}', not pending_approval.` });
  }

  task.status = 'completed';
  task.approved_by = req.body.approver || 'operator_admin';
  task.updated_at = Math.floor(Date.now() / 1000);
  task.backup_path = task.tool_name.includes('file') ? `.backups/${task.arguments.relative_path || 'file'}.${task.updated_at}.bak` : undefined;
  task.output = `Approved by ${task.approved_by}. Executed on host. Pre-execution backup created at ${task.backup_path || 'N/A'}.`;
  task.result = { status: 'success', bytes_affected: 2048, backup: task.backup_path };

  recordAudit(task.approved_by || 'operator_admin', `task_approved:${task.tool_name}`, task.target_device_id, { task_id: id }, 'success', task.risk_tier);
  res.json(task);
});

app.post('/api/approvals/:id/reject', (req: Request, res: Response) => {
  const { id } = req.params;
  const task = tasks.find(t => t.task_id === id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });

  task.status = 'rejected';
  task.updated_at = Math.floor(Date.now() / 1000);
  task.error = req.body.reason || 'Rejected by operator in approval queue.';
  task.output = `Rejected: ${task.error}`;

  recordAudit('operator', `task_rejected:${task.tool_name}`, task.target_device_id, { task_id: id, reason: task.error }, 'denied', task.risk_tier);
  res.json(task);
});

app.get('/api/audit', (req: Request, res: Response) => {
  res.json(auditLogs);
});

// MCP Tools Manifest
const MCP_TOOLS = [
  { name: 'list_devices', category: 'Discovery', risk: 'Tier 1 (Read-Only)', description: 'List all enrolled Linux and Windows hosts in the fleet.' },
  { name: 'get_device_status', category: 'Discovery', risk: 'Tier 1 (Read-Only)', description: 'Retrieve telemetry and heartbeat metrics of a target device.' },
  { name: 'get_system_info', category: 'Discovery', risk: 'Tier 1 (Read-Only)', description: 'Inspect operating system kernel, platform architecture, and hostname.' },
  { name: 'get_resource_usage', category: 'Discovery', risk: 'Tier 1 (Read-Only)', description: 'Inspect real-time CPU, RAM, and Disk storage metrics.' },
  { name: 'list_workspace', category: 'Files', risk: 'Tier 1 (Read-Only)', description: 'List files and directories inside workspace sandbox.' },
  { name: 'read_workspace_file', category: 'Files', risk: 'Tier 1 (Read-Only)', description: 'Read text content of a workspace file with 512KB cap.' },
  { name: 'search_workspace', category: 'Files', risk: 'Tier 1 (Read-Only)', description: 'Text search inside workspace files with bounded match count.' },
  { name: 'create_workspace_file', category: 'Files', risk: 'Tier 2 (Low-Risk)', description: 'Create a new file within the workspace root.' },
  { name: 'edit_workspace_file', category: 'Files', risk: 'Tier 3 (Sensitive)', description: 'Modify an existing file with automatic rollback backup.' },
  { name: 'move_workspace_file', category: 'Files', risk: 'Tier 3 (Sensitive)', description: 'Move or rename a file within workspace.' },
  { name: 'delete_workspace_file', category: 'Files', risk: 'Tier 4 (High-Risk)', description: 'Permanently remove a file from workspace (approval required).' },
  { name: 'get_service_status', category: 'Diagnostics', risk: 'Tier 1 (Read-Only)', description: 'Inspect systemd or Windows service state.' },
  { name: 'get_recent_logs', category: 'Diagnostics', risk: 'Tier 1 (Read-Only)', description: 'Read journald or application event logs.' },
  { name: 'list_processes', category: 'Diagnostics', risk: 'Tier 1 (Read-Only)', description: 'List active processes sorted by CPU and memory.' },
  { name: 'get_disk_usage', category: 'Diagnostics', risk: 'Tier 1 (Read-Only)', description: 'Detailed breakdown of disk partitions and free space.' },
  { name: 'get_memory_usage', category: 'Diagnostics', risk: 'Tier 1 (Read-Only)', description: 'Detailed breakdown of RAM and swap statistics.' },
  { name: 'list_docker_containers', category: 'Diagnostics', risk: 'Tier 1 (Read-Only)', description: 'Inspect Docker containers, status, and ports.' },
  { name: 'git_status', category: 'Development', risk: 'Tier 1 (Read-Only)', description: 'Inspect Git branch and uncommitted working tree changes.' },
  { name: 'git_diff', category: 'Development', risk: 'Tier 1 (Read-Only)', description: 'Inspect workspace Git diff with output cap.' },
  { name: 'run_project_tests', category: 'Development', risk: 'Tier 2 (Low-Risk)', description: 'Execute project test suite (pytest/npm) with timeout.' },
  { name: 'run_linter', category: 'Development', risk: 'Tier 2 (Low-Risk)', description: 'Run code linter across workspace files.' },
  { name: 'create_backup', category: 'Development', risk: 'Tier 2 (Low-Risk)', description: 'Generate a timestamped gzipped tarball backup.' },
  { name: 'deploy_application', category: 'Development', risk: 'Tier 4 (High-Risk)', description: 'Deploy application to staging or production.' },
  { name: 'get_desktop_status', category: 'Desktop', risk: 'Tier 1 (Read-Only)', description: 'Inspect availability of interactive desktop automation.' },
  { name: 'capture_desktop_screenshot', category: 'Desktop', risk: 'Tier 3 (Sensitive)', description: 'Capture screenshot of active interactive user session.' },
  { name: 'launch_approved_application', category: 'Desktop', risk: 'Tier 3 (Sensitive)', description: 'Launch allowlisted desktop app (terminal, code, browser).' },
  { name: 'perform_approved_ui_action', category: 'Desktop', risk: 'Tier 3 (Sensitive)', description: 'Perform bounded click or keypress in approved application.' },
];

app.get('/api/mcp/tools', (req: Request, res: Response) => {
  res.json(MCP_TOOLS);
});

// Interactive Tool Invocation Sandbox
app.post('/api/mcp/invoke', (req: Request, res: Response) => {
  if (emergencyStopActive) {
    return res.status(403).json({ error: 'Invocation blocked by Global Emergency Stop.' });
  }

  const { tool_name, device_id, arguments: args } = req.body;
  const tool = MCP_TOOLS.find(t => t.name === tool_name);
  if (!tool) {
    return res.status(404).json({ error: `Unknown tool: ${tool_name}` });
  }

  const targetDev = devices.find(d => d.id === device_id) || devices[0];

  // If Tier 3 or Tier 4, route through approval queue unless pre-approved
  if (tool.risk.includes('Tier 3') || tool.risk.includes('Tier 4')) {
    const taskId = `task-${Math.random().toString(36).substring(2, 10)}`;
    const now = Math.floor(Date.now() / 1000);
    const pendingTask: Task = {
      task_id: taskId,
      tool_name,
      target_device_id: targetDev.id,
      device_hostname: targetDev.hostname,
      requesting_identity: 'sandbox_operator',
      risk_tier: tool.risk.includes('Tier 4') ? 'tier_4_high_risk' : 'tier_3_sensitive',
      arguments: args || {},
      requires_approval: true,
      status: 'pending_approval',
      created_at: now,
      updated_at: now,
      output: `Interactive execution halted. This operation requires confirmation in the Approval Queue (${tool.risk}).`,
    };
    tasks.unshift(pendingTask);
    recordAudit('sandbox_operator', `task_submitted:${tool_name}`, targetDev.id, { args }, 'success', pendingTask.risk_tier);
    return res.json({
      status: 'pending_approval',
      task_id: taskId,
      message: `Operation submitted to Approval Queue. Risk level: ${tool.risk}.`,
      tool_name,
      target_device: targetDev.hostname,
    });
  }

  // Tier 1 and Tier 2 execute immediately
  let responseData: any = {};
  if (tool_name === 'get_system_info') {
    responseData = {
      hostname: targetDev.hostname,
      os: targetDev.os,
      os_version: targetDev.os_version,
      agent_version: targetDev.agent_version,
      workspace_root: targetDev.workspace_root,
      emergency_stop_active: emergencyStopActive,
    };
  } else if (tool_name === 'get_resource_usage') {
    responseData = targetDev.telemetry;
  } else if (tool_name === 'list_workspace') {
    responseData = [
      { name: 'src', type: 'directory', size_bytes: null, modified_time: Math.floor(Date.now() / 1000) - 3600 },
      { name: 'config', type: 'directory', size_bytes: null, modified_time: Math.floor(Date.now() / 1000) - 7200 },
      { name: 'README.md', type: 'file', size_bytes: 4210, modified_time: Math.floor(Date.now() / 1000) - 1200 },
      { name: 'pyproject.toml', type: 'file', size_bytes: 840, modified_time: Math.floor(Date.now() / 1000) - 400 },
    ];
  } else if (tool_name === 'list_docker_containers') {
    responseData = [
      { id: 'c3f19a02d41b', name: 'redis-cache-stage', image: 'redis:7.2-alpine', status: 'Up 14 hours', ports: '0.0.0.0:6379->6379/tcp' },
      { id: '8a90e314f822', name: 'postgres-db-16', image: 'postgres:16-bullseye', status: 'Up 4 days', ports: '0.0.0.0:5432->5432/tcp' },
      { id: '2f11c7901844', name: 'nginx-reverse-proxy', image: 'nginx:alpine', status: 'Up 4 days', ports: '80/tcp, 443/tcp' },
    ];
  } else if (tool_name === 'git_status') {
    responseData = {
      is_git_repo: true,
      branch: 'main',
      clean: false,
      staged: ['services/mcp_server/server.py'],
      unstaged: ['packages/policy_engine/policy.py'],
      untracked: [],
    };
  } else if (tool_name === 'run_project_tests') {
    responseData = {
      framework: 'pytest',
      passed: true,
      tests_ran: 9,
      failures: 0,
      duration_seconds: 0.045,
      output: '9 passed in 0.045s (100% test coverage for security, contracts, and approval rules)',
    };
  } else {
    responseData = {
      tool: tool_name,
      status: 'executed',
      timestamp: Math.floor(Date.now() / 1000),
      device: targetDev.hostname,
      arguments: args,
    };
  }

  recordAudit('sandbox_operator', `tool_invoke:${tool_name}`, targetDev.id, { args }, 'success', 'tier_1_read_only');
  res.json({
    status: 'completed',
    tool_name,
    target_device: targetDev.hostname,
    result: responseData,
  });
});

// Trigger packaging of production release
app.get('/api/export-release', (req: Request, res: Response) => {
  const releasePath = path.join(__dirname, 'public', 'release', 'ai-bridge-v1.0.0.zip');
  if (fs.existsSync(releasePath)) {
    const stats = fs.statSync(releasePath);
    return res.json({
      download_url: '/release/ai-bridge-v1.0.0.zip',
      file_size_bytes: stats.size,
      file_size_kb: Math.round(stats.size / 1024),
      version: '1.0.0',
      available: true,
    });
  }
  res.status(404).json({ error: 'Release archive not yet generated.' });
});

// Mount Vite middleware for dev
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AI Bridge Control API] Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
