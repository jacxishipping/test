# Roadmap

## Milestone 1 — local MCP starter
- [x] Stdio MCP server
- [x] Workspace-confined text reads/listing
- [x] Fixed read-only diagnostics
- [x] Unit tests

## Milestone 2 — remote device agent
- [ ] Device enrollment and revocation
- [ ] Outbound mTLS connection; no inbound shell port
- [ ] Short-lived credentials and rotation
- [ ] Device-scoped tool policy and task queue
- [ ] Signed agent updates

## Milestone 3 — controlled autonomous tasks
- [ ] Declarative task definitions with strict schemas
- [ ] Risk tiers, quotas, timeouts and cancellation
- [ ] Human approval for destructive or privileged actions
- [ ] Audit log with actor, target, tool, arguments and result
- [ ] Rollback or backup strategy for writes

## Milestone 4 — Windows agent
- [ ] Windows service running as a dedicated low-privilege account
- [ ] Fixed diagnostics using PowerShell APIs without arbitrary script execution
- [ ] Separate interactive desktop helper (never run desktop automation as SYSTEM by default)
- [ ] Code signing and secure update channel

## Milestone 5 — public product
- [ ] Multi-tenant authorization and tenant isolation
- [ ] OAuth/OIDC login, rate limiting, abuse monitoring
- [ ] Admin dashboard, device list, audit search, revoke controls
- [ ] Threat model, dependency scanning, penetration testing
