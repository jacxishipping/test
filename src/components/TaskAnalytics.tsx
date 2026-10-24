import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CheckCircle2, XCircle, AlertCircle, Clock, Filter, Server, Shield, PieChart as PieIcon, BarChart2 } from 'lucide-react';

export interface Task {
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

export interface Device {
  id: string;
  hostname: string;
  os: 'linux' | 'windows';
}

interface TaskAnalyticsProps {
  tasks: Task[];
  devices: Device[];
}

export default function TaskAnalytics({ tasks, devices }: TaskAnalyticsProps) {
  const [selectedDeviceFilter, setSelectedDeviceFilter] = useState<string>('all');
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<string>('all');

  // Filter tasks based on selected device & risk tier
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchDevice = selectedDeviceFilter === 'all' || task.target_device_id === selectedDeviceFilter;
      const matchRisk = selectedRiskFilter === 'all' || task.risk_tier === selectedRiskFilter;
      return matchDevice && matchRisk;
    });
  }, [tasks, selectedDeviceFilter, selectedRiskFilter]);

  // Aggregate statistics
  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter(t => t.status === 'completed').length;
    const failed = filteredTasks.filter(t => t.status === 'failed' || t.status === 'rejected').length;
    const pending = filteredTasks.filter(t => t.status === 'pending_approval' || t.status === 'queued' || t.status === 'running').length;
    const cancelled = filteredTasks.filter(t => t.status === 'cancelled').length;

    const evaluatedTotal = completed + failed;
    const successRate = evaluatedTotal > 0 ? Math.round((completed / evaluatedTotal) * 100) : 100;
    const failureRate = evaluatedTotal > 0 ? Math.round((failed / evaluatedTotal) * 100) : 0;

    return { total, completed, failed, pending, cancelled, successRate, failureRate, evaluatedTotal };
  }, [filteredTasks]);

  // Recharts pie data for Successful vs Failed
  const pieData = useMemo(() => {
    const data = [
      { name: 'Successful', value: stats.completed, color: '#10B981', textColor: 'text-emerald-400' },
      { name: 'Failed / Rejected', value: stats.failed, color: '#EF4444', textColor: 'text-rose-400' },
    ];
    if (stats.pending > 0) {
      data.push({ name: 'Pending Review', value: stats.pending, color: '#F59E0B', textColor: 'text-amber-400' });
    }
    if (stats.cancelled > 0) {
      data.push({ name: 'Cancelled', value: stats.cancelled, color: '#64748B', textColor: 'text-slate-400' });
    }
    return data.filter(d => d.value > 0);
  }, [stats]);

  // Breakdown by Risk Tier
  const riskTierBreakdown = useMemo(() => {
    const tiers: Array<{ key: Task['risk_tier']; label: string }> = [
      { key: 'tier_1_read_only', label: 'Tier 1 · Read-Only' },
      { key: 'tier_2_low_risk', label: 'Tier 2 · Low-Risk' },
      { key: 'tier_3_sensitive', label: 'Tier 3 · Sensitive' },
      { key: 'tier_4_high_risk', label: 'Tier 4 · High-Risk' },
    ];

    return tiers.map(tier => {
      // Look at tasks matching the device filter for this specific tier
      const tierTasks = tasks.filter(t => {
        const matchDev = selectedDeviceFilter === 'all' || t.target_device_id === selectedDeviceFilter;
        return matchDev && t.risk_tier === tier.key;
      });
      const comp = tierTasks.filter(t => t.status === 'completed').length;
      const fail = tierTasks.filter(t => t.status === 'failed' || t.status === 'rejected').length;
      const pend = tierTasks.filter(t => t.status === 'pending_approval').length;
      const total = tierTasks.length;
      const pct = total > 0 ? Math.round((comp / total) * 100) : 0;

      return {
        ...tier,
        total,
        completed: comp,
        failed: fail,
        pending: pend,
        successPct: pct,
      };
    });
  }, [tasks, selectedDeviceFilter]);

  // Breakdown by Device
  const deviceBreakdown = useMemo(() => {
    return devices.map(dev => {
      const devTasks = tasks.filter(t => {
        const matchRisk = selectedRiskFilter === 'all' || t.risk_tier === selectedRiskFilter;
        return t.target_device_id === dev.id && matchRisk;
      });
      const comp = devTasks.filter(t => t.status === 'completed').length;
      const fail = devTasks.filter(t => t.status === 'failed' || t.status === 'rejected').length;
      const total = devTasks.length;
      const rate = total > 0 ? Math.round((comp / (comp + fail || 1)) * 100) : 100;

      return {
        id: dev.id,
        hostname: dev.hostname,
        os: dev.os,
        total,
        completed: comp,
        failed: fail,
        successRate: rate,
      };
    });
  }, [devices, tasks, selectedRiskFilter]);

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0];
      const percent = stats.total > 0 ? ((entry.value / stats.total) * 100).toFixed(1) : 0;
      return (
        <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs font-mono">
          <div className="font-sans font-semibold text-slate-200 flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.payload.color }} />
            <span>{entry.name}</span>
          </div>
          <div className="text-slate-400">
            Count: <span className="text-white font-bold">{entry.value}</span> ({percent}%)
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-5 flex flex-col gap-5">
      {/* Header & Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">Task Analytics & Reliability</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time execution outcomes categorized by enrolled device host and policy risk tier.
          </p>
        </div>

        {/* Categorization Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Device Category Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 font-medium">Device:</span>
            <select
              value={selectedDeviceFilter}
              onChange={e => setSelectedDeviceFilter(e.target.value)}
              className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer text-xs"
            >
              <option value="all" className="bg-slate-900 text-slate-200">All Enrolled Hosts</option>
              {devices.map(d => (
                <option key={d.id} value={d.id} className="bg-slate-900 text-slate-200">
                  {d.hostname}
                </option>
              ))}
            </select>
          </div>

          {/* Risk Tier Category Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs">
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 font-medium">Risk Tier:</span>
            <select
              value={selectedRiskFilter}
              onChange={e => setSelectedRiskFilter(e.target.value)}
              className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer text-xs"
            >
              <option value="all" className="bg-slate-900 text-slate-200">All Risk Tiers</option>
              <option value="tier_1_read_only" className="bg-slate-900 text-slate-200">Tier 1 · Read-Only</option>
              <option value="tier_2_low_risk" className="bg-slate-900 text-slate-200">Tier 2 · Low-Risk</option>
              <option value="tier_3_sensitive" className="bg-slate-900 text-slate-200">Tier 3 · Sensitive</option>
              <option value="tier_4_high_risk" className="bg-slate-900 text-slate-200">Tier 4 · High-Risk</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Left Column: Donut Pie Chart from Recharts */}
        <div className="md:col-span-5 flex flex-col items-center justify-center p-3 bg-slate-900/40 rounded-lg border border-slate-800/60 relative">
          <div className="w-full h-52 relative flex items-center justify-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="#0F172A"
                    strokeWidth={2}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-500 font-mono">No tasks matching selected filter</div>
            )}

            {/* Center Summary Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold font-mono text-white tabular-nums">
                {stats.successRate}%
              </span>
              <span className="text-[10px] text-slate-400 font-medium">SUCCESS</span>
            </div>
          </div>

          {/* Clean Legend (No pill boxes, unboxed text with indicators) */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-2 text-xs font-mono">
            {pieData.map(item => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-slate-400 font-sans text-[11px]">{item.name}:</span>
                <span className="font-bold text-slate-200 tabular-nums">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Risk Tier Breakdown & Device Health Breakdown */}
        <div className="md:col-span-7 flex flex-col gap-4">
          {/* Categorized by Risk Tier */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Execution by Risk Tier</span>
              <span className="text-slate-500 font-mono text-[11px]">
                {selectedDeviceFilter === 'all' ? 'All Hosts' : selectedDeviceFilter}
              </span>
            </div>

            <div className="flex flex-col gap-2 font-mono text-xs">
              {riskTierBreakdown.map(tier => {
                const isSelected = selectedRiskFilter === 'all' || selectedRiskFilter === tier.key;
                return (
                  <div
                    key={tier.key}
                    className={`p-2.5 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-slate-900/60 border-slate-800'
                        : 'bg-slate-900/20 border-slate-900 opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1.5 font-sans">
                      <div className="font-medium text-slate-200 flex items-center gap-2">
                        <span>{tier.label}</span>
                        <span className="text-slate-500 font-mono text-[10px]">({tier.total} tasks)</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono tabular-nums text-[11px]">
                        <span className="text-emerald-400">{tier.completed} pass</span>
                        {tier.failed > 0 && <span className="text-rose-400">· {tier.failed} fail</span>}
                        {tier.pending > 0 && <span className="text-amber-400">· {tier.pending} gate</span>}
                      </div>
                    </div>

                    {/* Progress distribution bar */}
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${tier.total > 0 ? (tier.completed / tier.total) * 100 : 0}%` }}
                      />
                      <div
                        className="h-full bg-rose-500"
                        style={{ width: `${tier.total > 0 ? (tier.failed / tier.total) * 100 : 0}%` }}
                      />
                      <div
                        className="h-full bg-amber-500"
                        style={{ width: `${tier.total > 0 ? (tier.pending / tier.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Categorized by Device Breakdown Table */}
          <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-800/60">
            <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
              <span>Device Health Breakdown</span>
              <span className="font-mono text-slate-500">Filter: {selectedRiskFilter.replace('tier_', 'T')}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] font-mono tabular-nums">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800/80">
                    <th className="py-1 px-2 font-sans font-normal">Host</th>
                    <th className="py-1 px-2 font-sans font-normal text-right">Total</th>
                    <th className="py-1 px-2 font-sans font-normal text-right">Passed</th>
                    <th className="py-1 px-2 font-sans font-normal text-right">Failed</th>
                    <th className="py-1 px-2 font-sans font-normal text-right">Reliability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-slate-300">
                  {deviceBreakdown.map(dev => (
                    <tr key={dev.id} className="hover:bg-slate-800/20">
                      <td className="py-1.5 px-2 font-sans text-slate-200">
                        {dev.hostname}
                      </td>
                      <td className="py-1.5 px-2 text-right">{dev.total}</td>
                      <td className="py-1.5 px-2 text-right text-emerald-400">{dev.completed}</td>
                      <td className="py-1.5 px-2 text-right text-rose-400">{dev.failed}</td>
                      <td className="py-1.5 px-2 text-right font-bold text-white">{dev.successRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
