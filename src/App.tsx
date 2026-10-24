import React, { useState, useEffect } from 'react';
import TaskAnalytics from './components/TaskAnalytics';
import {
  Shield,
  Server,
  Cpu,
  HardDrive,
  Terminal,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  Copy,
  Download,
  Search,
  Filter,
  Check,
  RefreshCw,
  Eye,
  Sliders,
  ExternalLink,
  Laptop,
  Clock,
  Layers,
  FileCode,
  Lock,
  ChevronRight,
  PlusCircle,
  Activity,
  Zap,
} from 'lucide-react';

// Domain Types
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

interface ToolManifest {
  name: string;
  category: string;
  risk: string;
  description: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'devices' | 'approvals' | 'tasks' | 'sandbox' | 'config' | 'audit'>('devices');
  const [devices, setDevices] = useState<Device[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [tools, setTools] = useState<ToolManifest[]>([]);
  const [emergencyStop, setEmergencyStop] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals & Drawers
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [enrollModalOpen, setEnrollModalOpen] = useState<boolean>(false);
  const [newHostname, setNewHostname] = useState<string>('');
  const [newOs, setNewOs] = useState<'linux' | 'windows'>('linux');
  const [newDesktop, setNewDesktop] = useState<boolean>(false);
  const [enrollTokenResult, setEnrollTokenResult] = useState<string | null>(null);

  // Approval Inspection
  const [reviewTask, setReviewTask] = useState<Task | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  // Sandbox invocation state
  const [selectedTool, setSelectedTool] = useState<string>('get_system_info');
  const [sandboxArgs, setSandboxArgs] = useState<string>('{}');
  const [sandboxTargetDev, setSandboxTargetDev] = useState<string>('');
  const [sandboxOutput, setSandboxOutput] = useState<any>(null);
  const [sandboxRunning, setSandboxRunning] = useState<boolean>(false);

  // Search & Filter
  const [deviceSearch, setDeviceSearch] = useState<string>('');
  const [taskFilterStatus, setTaskFilterStatus] = useState<string>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Fetch initial system state
  const refreshData = async () => {
    try {
      const [devRes, taskRes, auditRes, toolsRes, stopRes] = await Promise.all([
        fetch('/api/devices').then(r => r.json()),
        fetch('/api/tasks').then(r => r.json()),
        fetch('/api/audit').then(r => r.json()),
        fetch('/api/mcp/tools').then(r => r.json()),
        fetch('/api/emergency-stop/status').then(r => r.json()),
      ]);
      setDevices(devRes);
      setTasks(taskRes);
      setAuditLogs(auditRes);
      setTools(toolsRes);
      setEmergencyStop(stopRes.emergency_stop_active);
      if (devRes.length > 0 && !sandboxTargetDev) {
        setSandboxTargetDev(devRes[0].id);
      }
    } catch (e) {
      console.error('Error fetching data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 6000);
    return () => clearInterval(interval);
  }, []);

  const toggleEmergencyStop = async () => {
    try {
      const res = await fetch('/api/emergency-stop/toggle', { method: 'POST' });
      const data = await res.json();
      setEmergencyStop(data.emergency_stop_active);
      showToast(data.message);
      refreshData();
    } catch (e) {
      showToast('Error toggling Emergency Stop');
    }
  };

  const handleEnrollLocal = async () => {
    try {
      const res = await fetch('/api/devices/enroll-local', { method: 'POST' });
      const data = await res.json();
      showToast(data.message || 'Host enrolled successfully!');
      refreshData();
    } catch (e) {
      showToast('Error enrolling local host');
    }
  };

  const handleEnrollDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHostname.trim()) return;
    try {
      const res = await fetch('/api/devices/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostname: newHostname,
          os: newOs,
          desktop_enabled: newDesktop,
          tags: ['enrolled-web', newOs],
        }),
      });
      const data = await res.json();
      setEnrollTokenResult(data.auth_token);
      showToast('Device enrolled successfully!');
      refreshData();
    } catch (e) {
      showToast('Device enrollment failed');
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!confirm(`Are you sure you want to revoke device ${deviceId}? This disconnects the agent immediately.`)) return;
    try {
      await fetch(`/api/devices/${deviceId}/revoke`, { method: 'POST' });
      showToast(`Device ${deviceId} revoked.`);
      refreshData();
      setSelectedDevice(null);
    } catch (e) {
      showToast('Error revoking device');
    }
  };

  const handleApproveTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/approvals/${taskId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approver: 'operator_alice' }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Approval rejected');
      }
      showToast('Task approved and executed.');
      setReviewTask(null);
      refreshData();
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleRejectTask = async (taskId: string) => {
    try {
      await fetch(`/api/approvals/${taskId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason || 'Declined by human reviewer.' }),
      });
      showToast('Task rejected.');
      setReviewTask(null);
      setRejectReason('');
      refreshData();
    } catch (err: any) {
      showToast('Error rejecting task');
    }
  };

  const handleCancelTask = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}/cancel`, { method: 'POST' });
      showToast(`Task ${taskId} cancelled.`);
      refreshData();
    } catch (err) {
      showToast('Failed to cancel task');
    }
  };

  const handleRunSandbox = async () => {
    setSandboxRunning(true);
    setSandboxOutput(null);
    try {
      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(sandboxArgs);
      } catch (e) {
        showToast('Invalid JSON arguments format.');
        setSandboxRunning(false);
        return;
      }

      const res = await fetch('/api/mcp/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool_name: selectedTool,
          device_id: sandboxTargetDev,
          arguments: parsedArgs,
        }),
      });
      const data = await res.json();
      setSandboxOutput(data);
      refreshData();
    } catch (err: any) {
      setSandboxOutput({ error: err.message });
    } finally {
      setSandboxRunning(false);
    }
  };

  const pendingApprovals = tasks.filter(t => t.status === 'pending_approval');
  const filteredDevices = devices.filter(d =>
    d.hostname.toLowerCase().includes(deviceSearch.toLowerCase()) ||
    d.id.toLowerCase().includes(deviceSearch.toLowerCase()) ||
    d.tags.some(t => t.toLowerCase().includes(deviceSearch.toLowerCase()))
  );
  const filteredTasks = tasks.filter(t => taskFilterStatus === 'all' || t.status === taskFilterStatus);

  // Risk styling helper
  const renderRiskBadge = (tier: string) => {
    switch (tier) {
      case 'tier_1_read_only':
        return <span className="text-xs font-mono text-emerald-400">Tier 1 · Read-Only</span>;
      case 'tier_2_low_risk':
        return <span className="text-xs font-mono text-blue-400">Tier 2 · Low-Risk</span>;
      case 'tier_3_sensitive':
        return <span className="text-xs font-mono text-amber-400 font-semibold">Tier 3 · Sensitive</span>;
      case 'tier_4_high_risk':
        return <span className="text-xs font-mono text-rose-400 font-bold">Tier 4 · High-Risk</span>;
      default:
        return <span className="text-xs font-mono text-slate-400">{tier}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-slate-700 px-4 py-2.5 rounded-lg shadow-xl text-xs font-medium text-slate-200 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-blue-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Bar Contract (Single Line Brand, Whitespace-Nowrap Links, 1 Primary Action) */}
      <header className="h-14 border-b border-slate-800/80 bg-[#0F172A]/70 backdrop-blur px-6 flex items-center justify-between gap-8 shrink-0 sticky top-0 z-40">
        {/* Zone 1: Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Layers className="w-4 h-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">AI Bridge</span>
            <span className="hidden sm:inline text-xs text-slate-400 font-normal">Universal Control Platform</span>
          </div>
        </div>

        {/* Zone 2: Single-Line Nav Links */}
        <nav className="flex items-center gap-1 sm:gap-2 text-xs font-medium text-slate-300 overflow-x-auto py-1">
          <button
            onClick={() => setActiveTab('devices')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'devices' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Fleet Devices</span>
            <span className="ml-1 text-[10px] font-mono text-slate-500">({devices.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('approvals')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'approvals' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Approval Queue</span>
            {pendingApprovals.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 rounded">
                {pendingApprovals.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'tasks' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Task History</span>
          </button>

          <button
            onClick={() => setActiveTab('sandbox')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'sandbox' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Tool Sandbox</span>
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'config' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>AI Client Setup</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'audit' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Audit Trail</span>
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action (Emergency Stop Switch) */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={toggleEmergencyStop}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
              emergencyStop
                ? 'bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-900/50'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${emergencyStop ? 'text-white' : 'text-rose-400'}`} />
            <span>{emergencyStop ? 'SYSTEM HALTED: Resume' : 'Emergency Stop'}</span>
          </button>
        </div>
      </header>

      {/* Emergency Stop Active Warning Banner */}
      {emergencyStop && (
        <div className="bg-rose-950/80 border-b border-rose-800/80 px-6 py-2.5 text-xs text-rose-200 flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              GLOBAL KILL SWITCH ACTIVE: All remote task execution, MCP tool invocation, and device mutations are currently halted.
            </span>
          </div>
          <button
            onClick={toggleEmergencyStop}
            className="px-2.5 py-1 text-[11px] font-semibold bg-rose-800 hover:bg-rose-700 rounded text-white"
          >
            Disengage Kill Switch
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-6 flex flex-col gap-6">
        {/* Top Metric Strip (Clean Tabular Numbers, Zero Pill Clutter) */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-4">
            <div className="text-xs text-slate-400 font-medium mb-1">Enrolled Fleet Devices</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-white flex items-baseline gap-2">
              {devices.length}
              <span className="text-xs font-sans text-emerald-400 font-normal">
                ({devices.filter(d => d.status === 'online').length} online)
              </span>
            </div>
          </div>

          <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-4">
            <div className="text-xs text-slate-400 font-medium mb-1">Pending Human Approvals</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-white flex items-baseline gap-2">
              <span className={pendingApprovals.length > 0 ? 'text-amber-400' : 'text-slate-400'}>
                {pendingApprovals.length}
              </span>
              <span className="text-xs font-sans text-slate-500 font-normal">Tier 3/4 gates</span>
            </div>
          </div>

          <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-4">
            <div className="text-xs text-slate-400 font-medium mb-1">MCP Tools Registered</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-white flex items-baseline gap-2">
              {tools.length || 27}
              <span className="text-xs font-sans text-slate-500 font-normal">schema validated</span>
            </div>
          </div>

          <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-4">
            <div className="text-xs text-slate-400 font-medium mb-1">Production Release</div>
            <div className="flex items-center justify-between">
              <div className="text-sm font-mono text-slate-300">v1.0.0 (Linux + Win)</div>
              <a
                href="/release/ai-bridge-v1.0.0.zip"
                download
                className="px-2.5 py-1 text-xs font-medium bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3 h-3" />
                <span>Download .zip</span>
              </a>
            </div>
          </div>
        </section>

        {/* VIEW 1: FLEET DEVICES */}
        {activeTab === 'devices' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search by hostname, ID, or tag..."
                    value={deviceSearch}
                    onChange={e => setDeviceSearch(e.target.value)}
                    className="w-full bg-[#0F172A] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={refreshData}
                  className="px-3 py-2 bg-[#0F172A] hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 rounded-lg flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                  <span>Refresh Fleet</span>
                </button>
                <button
                  onClick={handleEnrollLocal}
                  className="px-3 py-2 bg-emerald-700/80 hover:bg-emerald-600 text-xs font-semibold text-white rounded-lg flex items-center gap-1.5 shadow transition-colors"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Enroll This Host Machine</span>
                </button>
                <button
                  onClick={() => {
                    setEnrollModalOpen(true);
                    setEnrollTokenResult(null);
                  }}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white rounded-lg flex items-center gap-1.5 shadow"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Enroll Remote Host</span>
                </button>
              </div>
            </div>

            {/* Empty State when no devices are enrolled */}
            {devices.length === 0 ? (
              <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-12 text-center flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Server className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white mb-1">No Host Devices Enrolled Yet</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    All mock and sample data has been removed. You are running in real execution mode. Enroll the current host machine with 1 click to test real live telemetry, or enroll any remote Linux/Windows machine.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 mt-1">
                  <button
                    onClick={handleEnrollLocal}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white rounded-lg flex items-center gap-2 shadow transition-colors"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Enroll This Machine Now</span>
                  </button>
                  <button
                    onClick={() => {
                      setEnrollModalOpen(true);
                      setEnrollTokenResult(null);
                    }}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Enroll Remote Host (Linux / Windows)</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-[#0F172A] border border-slate-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-medium">
                    <tr>
                      <th className="py-3 px-4">Device / Hostname</th>
                      <th className="py-3 px-4">Operating System</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">CPU Usage</th>
                      <th className="py-3 px-4 text-right">Memory (RAM)</th>
                      <th className="py-3 px-4 text-right">Disk Used</th>
                      <th className="py-3 px-4">Tags</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                    {filteredDevices.map(device => {
                      const isRevoked = device.status === 'revoked';
                      return (
                        <tr key={device.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-4 font-sans">
                            <div className="flex items-center gap-2.5">
                              {device.os === 'linux' ? (
                                <Server className="w-4 h-4 text-amber-400 shrink-0" />
                              ) : (
                                <Laptop className="w-4 h-4 text-blue-400 shrink-0" />
                              )}
                              <div>
                                <div className="font-semibold text-slate-200">{device.hostname}</div>
                                <div className="text-[11px] font-mono text-slate-500">{device.id}</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-sans">
                            <div className="text-slate-300">{device.os_version}</div>
                            <div className="text-[11px] text-slate-500">{device.ip_address}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`text-xs font-sans font-medium ${
                                isRevoked
                                  ? 'text-rose-400'
                                  : device.status === 'online'
                                  ? 'text-emerald-400'
                                  : 'text-slate-500'
                              }`}
                            >
                              {isRevoked ? 'Revoked' : 'Online · Active'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span>{device.telemetry?.cpu_percent.toFixed(1)}%</span>
                              <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 rounded-full"
                                  style={{ width: `${Math.min(100, device.telemetry?.cpu_percent || 0)}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="text-slate-300">
                              {((device.telemetry?.memory_used_mb || 0) / 1024).toFixed(1)} GB /{' '}
                              {((device.telemetry?.memory_total_mb || 0) / 1024).toFixed(0)} GB
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="text-slate-300">
                              {device.telemetry?.disk_used_gb.toFixed(1)} GB / {device.telemetry?.disk_total_gb.toFixed(0)} GB
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-sans">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {device.tags.map(t => (
                                <span key={t} className="text-[11px] text-slate-400">
                                  #{t}
                                </span>
                              ))}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right font-sans">
                            <button
                              onClick={() => setSelectedDevice(device)}
                              className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            )}
          </div>
        )}

        {/* VIEW 2: APPROVAL QUEUE */}
        {activeTab === 'approvals' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Real-Time Approval Queue</h2>
                <p className="text-xs text-slate-400">
                  Tier 3 (Sensitive) and Tier 4 (High-Risk) actions require explicit human operator confirmation before execution.
                </p>
              </div>
              <div className="text-xs font-mono text-slate-400">
                Active approvals pending: <span className="text-amber-400 font-bold">{pendingApprovals.length}</span>
              </div>
            </div>

            {pendingApprovals.length === 0 ? (
              <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-12 text-center flex flex-col items-center justify-center gap-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-400/60" />
                <div className="text-sm font-semibold text-slate-300">Approval Queue is Clear</div>
                <p className="text-xs text-slate-500 max-w-sm">
                  No pending high-risk tasks. When an AI assistant requests a file deletion, config edit, or service restart, it will appear here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {pendingApprovals.map(task => (
                  <div
                    key={task.task_id}
                    className="bg-[#0F172A] border border-slate-800 rounded-lg p-5 flex flex-col gap-4 transition-all hover:border-slate-700"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold font-mono text-white">{task.tool_name}</span>
                            {renderRiskBadge(task.risk_tier)}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            Target: <span className="font-semibold text-slate-200">{task.device_hostname}</span> ({task.target_device_id}) · Requested by{' '}
                            <span className="font-mono text-slate-300">{task.requesting_identity}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          onClick={() => setReviewTask(task)}
                          className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Review Payload</span>
                        </button>
                        <button
                          onClick={() => handleRejectTask(task.task_id)}
                          className="px-3 py-1.5 text-xs font-semibold bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 text-rose-300 rounded-md flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                        <button
                          onClick={() => handleApproveTask(task.task_id)}
                          className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md flex items-center gap-1.5 shadow"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve & Execute</span>
                        </button>
                      </div>
                    </div>

                    {/* Blast Radius / Impact Notice */}
                    <div className="bg-slate-900/80 border border-slate-800/80 rounded p-3 text-xs flex flex-col gap-1.5">
                      <div className="text-slate-400 font-medium">Policy Verification:</div>
                      <div className="text-slate-300 font-mono text-[11px] leading-relaxed">
                        {task.output || 'Awaiting operator signature.'}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-1">
                        <Lock className="w-3 h-3 text-slate-400" />
                        <span>Pre-execution automatic snapshot will be created before modification.</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: TASK HISTORY */}
        {activeTab === 'tasks' && (
          <div className="flex flex-col gap-6">
            {/* Task Analytics Dashboard Component (Recharts Pie Chart by Device & Risk Tier) */}
            <TaskAnalytics tasks={tasks} devices={devices} />

            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight">Recent Orchestration Logs</h2>
                <p className="text-xs text-slate-400">Complete log of orchestrated tool executions and parameter payloads.</p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-[#0F172A] border border-slate-800 p-1 rounded-lg text-xs font-medium">
                {['all', 'completed', 'pending_approval', 'cancelled', 'rejected'].map(st => (
                  <button
                    key={st}
                    onClick={() => setTaskFilterStatus(st)}
                    className={`px-2.5 py-1 rounded capitalize transition-colors ${
                      taskFilterStatus === st ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {st.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#0F172A] border border-slate-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-medium">
                    <tr>
                      <th className="py-3 px-4">Task ID</th>
                      <th className="py-3 px-4">Tool</th>
                      <th className="py-3 px-4">Target Device</th>
                      <th className="py-3 px-4">Risk Tier</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Output / Details</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {filteredTasks.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500 font-sans text-xs">
                          No tasks executed yet. Run any tool in the Tool Sandbox or connect an MCP client to record real executions.
                        </td>
                      </tr>
                    ) : (
                      filteredTasks.map(t => (
                        <tr key={t.task_id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 text-slate-400">{t.task_id}</td>
                          <td className="py-3 px-4 font-semibold text-slate-200">{t.tool_name}</td>
                          <td className="py-3 px-4 font-sans text-slate-300">{t.device_hostname}</td>
                          <td className="py-3 px-4 font-sans">{renderRiskBadge(t.risk_tier)}</td>
                          <td className="py-3 px-4 font-sans">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                t.status === 'completed'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : t.status === 'pending_approval'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : t.status === 'cancelled'
                                  ? 'bg-slate-800 text-slate-400'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}
                            >
                              {t.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{t.output || 'None'}</td>
                          <td className="py-3 px-4 text-right font-sans">
                            {t.status === 'pending_approval' && (
                              <button
                                onClick={() => handleCancelTask(t.task_id)}
                                className="px-2 py-1 text-[11px] text-slate-400 hover:text-rose-300 transition-colors"
                              >
                                Cancel
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: TOOL SANDBOX */}
        {activeTab === 'sandbox' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-5 flex flex-col gap-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-blue-400" />
                  <span>Invoke MCP Tool Interactively</span>
                </h3>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-medium">Target Device:</label>
                  <select
                    value={sandboxTargetDev}
                    onChange={e => setSandboxTargetDev(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  >
                    {devices.length === 0 ? (
                      <option value="local-host">Current Machine (Local Host Environment)</option>
                    ) : (
                      devices.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.hostname} ({d.os.toUpperCase()} · {d.status})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-medium">Select MCP Tool:</label>
                  <select
                    value={selectedTool}
                    onChange={e => {
                      setSelectedTool(e.target.value);
                      if (e.target.value === 'read_workspace_file') setSandboxArgs('{"relative_path": "README.md"}');
                      else if (e.target.value === 'get_service_status') setSandboxArgs('{"service_name": "ai-bridge-agent"}');
                      else if (e.target.value === 'list_workspace') setSandboxArgs('{"relative_directory": "."}');
                      else if (e.target.value === 'search_workspace') setSandboxArgs('{"query": "config"}');
                      else setSandboxArgs('{}');
                    }}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  >
                    {tools.map(t => (
                      <option key={t.name} value={t.name}>
                        {t.name} [{t.category} · {t.risk}]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-medium">JSON Arguments Schema:</label>
                  <textarea
                    rows={4}
                    value={sandboxArgs}
                    onChange={e => setSandboxArgs(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <button
                  onClick={handleRunSandbox}
                  disabled={sandboxRunning}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {sandboxRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{sandboxRunning ? 'Executing Tool...' : 'Execute Tool via MCP'}</span>
                </button>
              </div>

              {/* Tool Information */}
              {tools.find(t => t.name === selectedTool) && (
                <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-4 text-xs">
                  <div className="text-slate-400 font-medium mb-1">Tool Specification:</div>
                  <div className="text-slate-200 font-bold mb-1">{selectedTool}</div>
                  <p className="text-slate-400 leading-relaxed mb-3">
                    {tools.find(t => t.name === selectedTool)?.description}
                  </p>
                  <div className="text-xs font-mono text-slate-500">
                    Category: <span className="text-slate-300">{tools.find(t => t.name === selectedTool)?.category}</span> · Risk:{' '}
                    <span className="text-slate-300">{tools.find(t => t.name === selectedTool)?.risk}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-5 flex flex-col h-full min-h-[420px]">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-3">
                  <span className="text-xs font-bold text-slate-300 font-mono">MCP Output Console</span>
                  {sandboxOutput && (
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(sandboxOutput, null, 2), 'sandbox_out')}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-sans"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedKey === 'sandbox_out' ? 'Copied' : 'Copy JSON'}</span>
                    </button>
                  )}
                </div>

                <div className="flex-1 bg-slate-950 rounded border border-slate-900 p-4 font-mono text-xs text-slate-200 overflow-y-auto">
                  {sandboxOutput ? (
                    <pre className="whitespace-pre-wrap">{JSON.stringify(sandboxOutput, null, 2)}</pre>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2">
                      <Terminal className="w-6 h-6 text-slate-700" />
                      <span>Select a tool and click 'Execute Tool' to view structured JSON response.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 5: AI CLIENT CONFIG */}
        {activeTab === 'config' && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">AI Assistant & MCP Client Integrations</h2>
              <p className="text-xs text-slate-400">
                Configure your AI models to connect to AI Bridge using standard Model Context Protocol connectors.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Claude Desktop */}
              <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">Anthropic Claude Desktop</span>
                    <span className="text-xs font-mono text-slate-500">stdio transport</span>
                  </div>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        JSON.stringify(
                          {
                            mcpServers: {
                              'ai-bridge': {
                                command: 'python',
                                args: ['-m', 'services.mcp_server.server', '--transport', 'stdio'],
                                env: { AI_BRIDGE_WORKSPACE: '~/ai-bridge-workspace' },
                              },
                            },
                          },
                          null,
                          2
                        ),
                        'claude_cfg'
                      )
                    }
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedKey === 'claude_cfg' ? 'Copied!' : 'Copy Config'}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  Add this block to your <code className="text-slate-300">claude_desktop_config.json</code>:
                </p>
                <div className="bg-slate-950 p-3 rounded border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                  <pre>{`{
  "mcpServers": {
    "ai-bridge": {
      "command": "python",
      "args": ["-m", "services.mcp_server.server", "--transport", "stdio"],
      "env": {
        "AI_BRIDGE_WORKSPACE": "~/ai-bridge-workspace"
      }
    }
  }
}`}</pre>
                </div>
              </div>

              {/* Claude Code CLI */}
              <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">Claude Code CLI</span>
                    <span className="text-xs font-mono text-slate-500">terminal CLI</span>
                  </div>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        'claude mcp add ai-bridge python -- -m services.mcp_server.server --transport stdio',
                        'claude_code'
                      )
                    }
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedKey === 'claude_code' ? 'Copied!' : 'Copy Command'}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-400">Run this single command inside your terminal:</p>
                <div className="bg-slate-950 p-3 rounded border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                  <code>claude mcp add ai-bridge python -- -m services.mcp_server.server --transport stdio</code>
                </div>
              </div>

              {/* Google Gemini CLI & SDK */}
              <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">Google Gemini CLI / SDK</span>
                    <span className="text-xs font-mono text-slate-500">MCP & Function Calling</span>
                  </div>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        'gemini mcp add ai-bridge python -m services.mcp_server.server --transport stdio',
                        'gemini_cfg'
                      )
                    }
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedKey === 'gemini_cfg' ? 'Copied!' : 'Copy Command'}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-400">Add to Gemini CLI or declare tools via the Gemini TypeScript/Python SDK:</p>
                <div className="bg-slate-950 p-3 rounded border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                  <code>gemini mcp add ai-bridge python -m services.mcp_server.server --transport stdio</code>
                </div>
              </div>

              {/* OpenAI ChatGPT */}
              <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">OpenAI ChatGPT / Codex</span>
                    <span className="text-xs font-mono text-slate-500">Streamable SSE</span>
                  </div>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        'https://control.example.com/api/mcp/sse',
                        'chatgpt_cfg'
                      )
                    }
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedKey === 'chatgpt_cfg' ? 'Copied!' : 'Copy URL'}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-400">Configure Custom Action or Remote MCP connector endpoint:</p>
                <div className="bg-slate-950 p-3 rounded border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                  <code>https://control.example.com/api/mcp/sse</code>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 6: AUDIT TRAIL */}
        {activeTab === 'audit' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Tamper-Evident Audit Trail</h2>
                <p className="text-xs text-slate-400">
                  Cryptographically structured audit events with automated secret redaction for API keys, passwords, and tokens.
                </p>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                Showing last <span className="text-white font-bold">{auditLogs.length}</span> events
              </div>
            </div>

            <div className="bg-[#0F172A] border border-slate-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-medium">
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Event ID</th>
                      <th className="py-3 px-4">Actor</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Risk Tier</th>
                      <th className="py-3 px-4">Outcome</th>
                      <th className="py-3 px-4">Redacted Payload</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px] tabular-nums">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500 font-sans text-xs">
                          No audit events recorded yet. Run a real tool in the Tool Sandbox or connect an MCP client to log cryptographically signed events.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map(log => (
                        <tr key={log.event_id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                            {new Date(log.timestamp * 1000).toLocaleTimeString()}
                          </td>
                          <td className="py-3 px-4 text-slate-400">{log.event_id}</td>
                          <td className="py-3 px-4 font-sans font-medium text-slate-200">{log.actor}</td>
                          <td className="py-3 px-4 text-slate-300 font-semibold">{log.action}</td>
                          <td className="py-3 px-4 font-sans">{log.risk_tier ? renderRiskBadge(log.risk_tier) : '—'}</td>
                          <td className="py-3 px-4 font-sans">
                            <span
                              className={`text-xs ${
                                log.outcome === 'success'
                                  ? 'text-emerald-400'
                                  : log.outcome === 'denied'
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              {log.outcome}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400 max-w-sm truncate">
                            {JSON.stringify(log.payload)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: ENROLL DEVICE */}
      {enrollModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl max-w-lg w-full p-6 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-blue-400" />
                <span>Enroll New Host Device</span>
              </h3>
              <button
                onClick={() => setEnrollModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            </div>

            {enrollTokenResult ? (
              <div className="flex flex-col gap-3 py-2">
                <div className="bg-emerald-950/40 border border-emerald-800/80 rounded p-3 text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Device registered! Use the one-time token below to start the agent:</span>
                </div>

                <div className="bg-slate-950 p-3 rounded border border-slate-800 flex items-center justify-between font-mono text-xs text-blue-400">
                  <span>{enrollTokenResult}</span>
                  <button
                    onClick={() => copyToClipboard(enrollTokenResult, 'token')}
                    className="text-slate-400 hover:text-white"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="text-[11px] text-slate-400 mt-2 font-mono bg-slate-900 p-2.5 rounded">
                  # Run on host:
                  <br />
                  python3 -m agents.{newOs}.{newOs}_agent --server https://control.example.com --token {enrollTokenResult}
                </div>

                <button
                  onClick={() => setEnrollModalOpen(false)}
                  className="mt-3 w-full py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white rounded-lg"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleEnrollDevice} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-300 font-medium">Device Hostname</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. srv-prod-db-01.corp"
                    value={newHostname}
                    onChange={e => setNewHostname(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-300 font-medium">Target Operating System</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setNewOs('linux')}
                      className={`p-3 rounded-lg border text-xs font-medium flex items-center gap-2 ${
                        newOs === 'linux' ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                    >
                      <Server className="w-4 h-4 text-amber-400" />
                      <span>Linux Server (systemd)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewOs('windows')}
                      className={`p-3 rounded-lg border text-xs font-medium flex items-center gap-2 ${
                        newOs === 'windows' ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                    >
                      <Laptop className="w-4 h-4 text-blue-400" />
                      <span>Windows Workstation</span>
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={newDesktop}
                    onChange={e => setNewDesktop(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-blue-600"
                  />
                  <span>Enable optional desktop GUI automation helper (interactive session)</span>
                </label>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEnrollModalOpen(false)}
                    className="px-3 py-2 text-xs text-slate-400 hover:text-white font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white rounded-lg"
                  >
                    Generate Enrollment Token
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: INSPECT DEVICE DRAWER */}
      {selectedDevice && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-end">
          <div className="bg-[#0F172A] border-l border-slate-800 w-full max-w-md h-full p-6 flex flex-col justify-between shadow-2xl">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  {selectedDevice.os === 'linux' ? (
                    <Server className="w-5 h-5 text-amber-400" />
                  ) : (
                    <Laptop className="w-5 h-5 text-blue-400" />
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-white">{selectedDevice.hostname}</h3>
                    <div className="text-[11px] font-mono text-slate-500">{selectedDevice.id}</div>
                  </div>
                </div>
                <button onClick={() => setSelectedDevice(null)} className="text-slate-400 hover:text-white text-xs">
                  ✕
                </button>
              </div>

              <div className="flex flex-col gap-3 text-xs">
                <div>
                  <div className="text-slate-500 font-medium mb-0.5">Operating System</div>
                  <div className="text-slate-200">{selectedDevice.os_version}</div>
                </div>

                <div>
                  <div className="text-slate-500 font-medium mb-0.5">Workspace Boundary (Sandbox Chroot)</div>
                  <div className="text-slate-200 font-mono text-[11px] bg-slate-900 p-2 rounded border border-slate-800">
                    {selectedDevice.workspace_root}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500 font-medium mb-0.5">Network Address & Agent Version</div>
                  <div className="text-slate-200 font-mono text-[11px]">
                    {selectedDevice.ip_address} · Agent v{selectedDevice.agent_version}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500 font-medium mb-1">Hardware Resource Probes</div>
                  <div className="grid grid-cols-3 gap-2 text-center font-mono text-[11px]">
                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                      <div className="text-slate-500 text-[10px]">CPU</div>
                      <div className="font-bold text-slate-200">{selectedDevice.telemetry?.cpu_percent.toFixed(1)}%</div>
                    </div>
                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                      <div className="text-slate-500 text-[10px]">RAM</div>
                      <div className="font-bold text-slate-200">
                        {((selectedDevice.telemetry?.memory_used_mb || 0) / 1024).toFixed(1)} GB
                      </div>
                    </div>
                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                      <div className="text-slate-500 text-[10px]">Disk</div>
                      <div className="font-bold text-slate-200">{selectedDevice.telemetry?.disk_used_gb.toFixed(0)} GB</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4 flex flex-col gap-2">
              {selectedDevice.status !== 'revoked' ? (
                <button
                  onClick={() => handleRevokeDevice(selectedDevice.id)}
                  className="w-full py-2 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 text-rose-300 text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Revoke Device Access</span>
                </button>
              ) : (
                <div className="text-center text-xs text-rose-400 font-medium py-1">Device Access Revoked</div>
              )}
              <button
                onClick={() => setSelectedDevice(null)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: REVIEW TASK PAYLOAD MODAL */}
      {reviewTask && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl max-w-xl w-full p-6 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span>Operator Review: {reviewTask.tool_name}</span>
                </h3>
                <div className="text-xs text-slate-400 mt-0.5">Task ID: {reviewTask.task_id}</div>
              </div>
              <button onClick={() => setReviewTask(null)} className="text-slate-400 hover:text-white text-xs">
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded border border-slate-800 font-mono text-[11px]">
                <span className="text-slate-400">Target Device:</span>
                <span className="text-slate-200 font-semibold">{reviewTask.device_hostname}</span>
              </div>

              <div>
                <div className="text-slate-400 font-medium mb-1">Requested Arguments:</div>
                <div className="bg-slate-950 p-3 rounded border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-48">
                  <pre>{JSON.stringify(reviewTask.arguments, null, 2)}</pre>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-slate-400 font-medium">Rejection Reason (if declining):</label>
                <input
                  type="text"
                  placeholder="e.g. Unapproved production modification without change ticket"
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-3">
              <button
                onClick={() => handleRejectTask(reviewTask.task_id)}
                className="px-3.5 py-2 text-xs font-semibold bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-lg flex items-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Reject Request</span>
              </button>
              <button
                onClick={() => handleApproveTask(reviewTask.task_id)}
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1.5 shadow"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approve & Execute</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
