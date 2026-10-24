# AI Bridge — Universal AI-to-Computer Control Platform

AI Bridge is a production-oriented, security-first control plane and Model Context Protocol (MCP) server that empowers authorized AI assistants (Claude, Gemini, ChatGPT, Codex) to safely monitor, diagnose, and execute controlled operations across enrolled Linux servers and Windows workstations.

> [!IMPORTANT]
> **Confirmed User Decisions & Strategic Alignments**:
> - **AI Ecosystem Focus**: Universal MCP standard with pre-configured templates and live validation for Anthropic Claude (Desktop & Code), Google Gemini (Studio & CLI), and OpenAI ChatGPT / Codex.
> - **Target Devices**: Full cross-platform support with dedicated Linux agent (systemd, Docker, journald) and Windows agent (Service daemon + isolated desktop helper).
> - **Autonomy & Risk Model**: Strict four-tier risk classification with an interactive real-time approval queue for Tier 3/4 sensitive and high-risk operations (destructive changes, service restarts, production deployments), with automated backups before modification.

---

### 1. Overview & Core Concept

- **What It Does**: AI Bridge bridges the gap between AI reasoning agents and real-world infrastructure without giving AI unrestricted root access or arbitrary shell execution. It provides typed, schema-validated MCP tools for workspace file manipulation, system telemetry, service and Docker container management, Git workflows, and task execution, backed by a central management dashboard and risk-enforcement policy engine.
- **Target Audience**: DevOps engineers, system administrators, AI engineers, and developers seeking safe, auditable AI access to their development boxes, staging clusters, and remote workstations.
- **Key Value**: Prevents path traversal, command injection, and privilege escalation while maintaining high developer velocity and comprehensive auditability.

---

### 2. User Experience & Visual Design

#### Key User Flows
1. **Device Enrollment & Heartbeat**: Users generate an enrollment command or token from the dashboard, launch the agent on a Linux or Windows machine, and observe immediate mutual handshake, TLS verification, and live telemetry updates.
2. **AI-Assisted Operations & Approval Queue**: An AI assistant connected via stdio or streamable HTTP invokes a tool. Read-only (Tier 1) and safe local workspace operations (Tier 2) execute immediately; Tier 3 and 4 actions (e.g., service restart, file deletion, deployment) pause and appear in the dashboard approval queue with visual parameter diffs and a one-click approve/deny workflow.
3. **Emergency Stop & Revocation**: Operators can trigger an instantaneous global or per-device Emergency Stop to terminate running tasks and revoke device credentials in real time.
4. **Interactive MCP Console & Client Config**: The dashboard includes interactive tool testing, raw MCP inspection, and copy-ready client configuration snippets (`claude_desktop_config.json`, Gemini settings, OpenAI client connectors).

#### Visual Identity & Design System (SaaS & Developer Console Guidelines)
- **Aesthetic Direction**: High-density, utilitarian developer console with dark slate foundations, subtle hairline dividers, and tabular alignment. Zero "AI slop" (no decorative floating pills, no neon gradients, no simulated telemetry tickers).
- **Color Palette**:
  - Canvas: Dark Neutral Slate (`#0B0F17` / `#0F172A`)
  - Structural Surfaces: Hairline bordered containers (`#1E293B`, `border-slate-800`)
  - Accent & Semantic: High-intent Indigo/Blue (`#3B82F6`) for primary actions, Emerald (`#10B981`) for verified/online status, Amber (`#F59E0B`) for pending approvals, and Crimson (`#EF4444`) for errors and Emergency Stop.
- **Typography & Hierarchy**:
  - Display & Headings: `Plus Jakarta Sans` / `Outfit`
  - Body & Form Controls: `DM Sans` / `Public Sans`
  - Code & Metrics: Monospace with tabular numerals (`font-mono tabular-nums`, `JetBrains Mono`)
- **Spatial Composition**:
  - 260px collapsible command sidebar + top breadcrumb bar + full 1440px multi-column viewport.
  - Interactive tabs: Devices, Task Queue, Approval Center, Audit Logs, MCP Client Connectors, and Tool Sandbox.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Modular Monolithic Architecture with Dual Transport (Stdio & HTTP)**
  - *Chosen Approach*: Deliver both a standalone stdio FastMCP server (for local Claude Desktop / Gemini CLI) and a streamable FastAPI/Express control plane for remote agents and multi-device coordination.
  - *Why*: Stdio provides zero-network attack surface for local setups, while the control plane accommodates distributed servers behind firewalls via outbound agent polling/WebSockets.
- **Decision 2: Risk Tiering with Server-Side Policy Gates**
  - *Chosen Approach*: Server-side enforcement of Tiers 1 to 4. AI tools cannot override policies, bypass parameter schemas, or self-approve.
  - *Why*: Eliminates prompt-injection vulnerabilities and accidental destructive system actions.
- **Decision 3: Dedicated Full-Stack Implementation within React + Express**
  - *Chosen Approach*: Complete Python monorepo packages paired with an Express + React management dashboard featuring real-time state synchronization, embedded mock agent simulator for instant browser evaluation, and downloadable full-source archive.
  - *Why*: Enables immediate zero-configuration verification in AI Studio while supplying production-ready Python files and deployment packages.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                       AI ASSISTANT INTERFACE                           │
│   (Claude Desktop / Claude Code / Gemini CLI / OpenAI ChatGPT Codex)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Model Context Protocol (stdio / SSE)
┌───────────────────────────────────▼────────────────────────────────────┐
│                       AI BRIDGE MCP SERVER                             │
│  - System Info & Metrics   - Workspace File Confinement (chroot style) │
│  - Diagnostics & Processes - Git Status, Diff, Backup & Test Tools     │
│  - Task Queue & Cancellation - Docker Container Inspector             │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
         Outbound Heartbeat & Tasks       Risk Enforcement & Audits
                    │                                │
┌───────────────────▼───────────┐      ┌─────────────▼───────────────────┐
│        REMOTE AGENTS          │      │     CONTROL PLANE & API         │
│  - Linux Agent (systemd)      │      │  - Device Registry & Auth       │
│  - Windows Agent (Service)    │◄────►│  - Approval Queue & Policies    │
│  - Interactive Desktop Helper │      │  - Tamper-Evident Audit Logs    │
└───────────────────────────────┘      │  - Emergency Stop Controller    │
                                       └─────────────┬───────────────────┘
                                                     │
                                       ┌─────────────▼───────────────────┐
                                       │        WEB DASHBOARD            │
                                       │  - Device Telemetry & Fleet     │
                                       │  - Approval Diff Reviewer       │
                                       │  - Live Task & Log Terminal     │
                                       │  - 1-Click Client Config Export │
                                       └─────────────────────────────────┘
```

#### Monorepo Structure & Deliverables:
- `pyproject.toml` & `docker-compose.yml`: Top-level configuration, pinned dependencies, linting, and containerization.
- `packages/shared-contracts`: Pydantic & JSON schema models for tasks, devices, approvals, and tool calls.
- `packages/policy-engine`: Risk tier definitions, workspace sandboxing, parameter validation, and rate limits.
- `packages/audit`: Structured JSON logging with automatic secret redaction.
- `services/mcp-server`: FastMCP server exposing all 25+ prompt-specified tools across Files, Diagnostics, Git, Execution, and Desktop modules.
- `services/task-orchestrator`: Asynchronous task execution engine with timeout guarantees and cooperative cancellation.
- `agents/linux`: systemd service, cgroup resource monitoring, Docker socket reader, and workspace executor.
- `agents/windows`: Windows Service definition, CIM/WMI non-arbitrary diagnostics, and isolated session desktop automation helper.
- `apps/control-api`: FastAPI / Express backend managing device tokens, task state, approvals, and audit records.
- `apps/dashboard`: Production React application with fleet overview, approval modal, client config generator, and interactive test runner.
- `docs/`: Comprehensive technical documentation (`threat-model.md`, `installation-linux.md`, `installation-windows.md`, `mcp-clients.md`, etc.).
- `tests/`: Unit, integration, security (path traversal, command injection, symlink bypass), and approval tests.
