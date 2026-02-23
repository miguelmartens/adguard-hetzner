# AdGuard Home on Hetzner VPS

Provision a secure AdGuard Home VPS on Hetzner using Pulumi, with:

- **Tailscale-only web UI** – Admin interface accessible only via Tailscale MagicDNS
- **Public DoH** – DNS-over-HTTPS at `dns.<domain>/dns-query` with Let's Encrypt
- **Caddy** – Reverse proxy with automatic TLS
- **Cloudflare** – Optional DNS record management
- **GitHub Actions** – Automated deployments

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │           Hetzner VPS                │
                    │  ┌─────────┐  ┌──────────────────┐   │
DoH Clients ────────►│  │ Caddy  │─►│ AdGuard Home     │   │
(Public)             │  │ :443   │  │ :8080 (HTTP)     │   │
                    │  └─────────┘  └────────▲─────────┘   │
                    │                       │             │
Admin (Tailscale) ──┼───────────────────────┼─────────────┤
                    │  ┌────────────────────┘             │
                    │  │ Tailscale Serve                   │
                    └──┴───────────────────────────────────┘
```

## Prerequisites

- [Pulumi CLI](https://www.pulumi.com/docs/install/)
- [Node.js 22+](https://nodejs.org/)
- Hetzner Cloud account
- Tailscale account (for auth key)
- Domain with DNS at Cloudflare (optional, for automatic A record)

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Pulumi

Create or select a stack:

```bash
pulumi stack init dev   # or: pulumi stack select dev
```

Set required configuration:

```bash
# Required
pulumi config set domain example.com              # Base domain (DoH at dns.example.com)
pulumi config set tailnetDnsName ts.net            # Your Tailscale MagicDNS domain
pulumi config set --secret tailscaleAuthKey <key>  # From https://login.tailscale.com/admin/settings/keys

# Optional - Cloudflare DNS (creates A record automatically)
pulumi config set cloudflareZoneId <zone-id>           # From Cloudflare dashboard
pulumi config set --secret cloudflare:apiToken <token> # Provider auth (creates dns.<domain> A record)
```

### 3. Deploy

```bash
pulumi up
```

### 4. Post-deploy

1. **Change admin password** – Access the web UI via `https://<hostname>.<tailnet>.ts.net` (Tailscale) and go to Settings → Profile.

2. **Verify DoH**:
   ```bash
   curl -H "Accept: application/dns-json" "https://dns.example.com/dns-query?name=example.com&type=A"
   ```

3. **Configure devices** – Use `https://dns.example.com/dns-query` as the DoH server.

## Configuration Reference

| Key | Required | Description |
|-----|----------|-------------|
| `domain` | Yes | Base domain (e.g. `example.com`). DoH hostname will be `dns.<domain>`. |
| `tailnetDnsName` | Yes | Tailscale MagicDNS domain (e.g. `ts.net`). |
| `tailscaleAuthKey` | Yes (secret) | Tailscale auth key for unattended join. |
| `serverType` | No | Hetzner server type (default: `cx23`). |
| `location` | No | Hetzner location (default: `fsn1`). |
| `cloudflareZoneId` | No | Cloudflare zone ID for automatic A record. |
| `cloudflare:apiToken` | No (secret) | Cloudflare API token for DNS (provider auth). |

## GitHub Actions

### Workflows

| Workflow | Trigger | Description |
|----------|---------|-------------|
| **push.yml** | Push to `main` | Deploy to stack from `PULUMI_STACK_NAME` secret |
| **deploy.yml** | Manual (`workflow_dispatch`) | Deploy to chosen stack with optional preview |
| **pull_request.yml** | Pull requests to `main` | Preview changes and comment on PR |
| **destroy.yml** | Manual (`workflow_dispatch`) | Destroy stack (requires typing `DESTROY` to confirm) |

### Required secrets

In GitHub: **Settings → Secrets and variables → Actions**:

| Secret | Description |
|--------|-------------|
| `PULUMI_ACCESS_TOKEN` | From [Pulumi Console](https://app.pulumi.com/account/tokens) |
| `PULUMI_STACK_NAME` | Stack to deploy on push (e.g. `prod`) |
| `HCLOUD_TOKEN` | Hetzner Cloud API token (for Pulumi provider) |

Pulumi config (domain, tailscaleAuthKey, etc.) must be set per stack via `pulumi config set` before the first deploy. Secrets like `tailscaleAuthKey` are stored in Pulumi config with `--secret`.

## Renovate

This project uses **Renovate** for automated dependency updates:

- Automatic PRs for npm packages and GitHub Actions
- Security vulnerability alerts with auto-merge for patches
- GitHub Actions pinned to commit SHAs
- Dependency Dashboard for update overview
- Scheduled weekly updates (Mondays at 6am UTC)

**Setup:** Install [Renovate GitHub App](https://github.com/apps/renovate), then merge the onboarding PR it creates. See [`docs/RENOVATE_SETUP.md`](docs/RENOVATE_SETUP.md) for details.

## Cost

Default `cx23` (2 vCPU, 4GB RAM) is sufficient for AdGuard Home and costs ~€3.62/month. Override `serverType` for different tiers:

| Type | Specs | ~Price | Use case |
|------|-------|--------|----------|
| `cx23` | 2 vCPU, 4GB | ~€3.62/mo | Default, cheapest |
| `cpx11` | 2 vCPU, 2GB | ~€4.35/mo | Alternative |
| `cax21` | 4 vCPU, 8GB | ~€9/mo | Higher traffic or headroom |

Tailscale and Cloudflare free tiers cover the rest. No additional infra costs.

## Security

Per [AdGuard's running securely guide](https://adguard-dns.io/kb/adguard-home/running-securely/). See [`docs/SECURITY_CHECKLIST.md`](docs/SECURITY_CHECKLIST.md) for a full security checklist.

- **Plain DNS (port 53)**: Disabled. Clients use DoH only.
- **Rate limiting**: 20 queries/second (configurable in AdGuard UI).
- **Refuse ANY**: Enabled to mitigate amplification attacks.
- **Trusted proxies**: Caddy and Tailscale subnets configured for correct client IP logging.
- **Auth lockout**: 5 failed attempts, 15-minute block.

## AdGuard Home Documentation

Official AdGuard Home resources:

| Resource | Description |
|----------|-------------|
| [Getting Started (KB)](https://adguard-dns.io/kb/adguard-home/getting-started/) | AdGuard KB – initial setup |
| [Getting Started (Wiki)](https://github.com/AdguardTeam/AdguardHome/wiki/Getting-Started) | GitHub Wiki – getting started |
| [Running Securely](https://adguard-dns.io/kb/adguard-home/running-securely/) | AdGuard KB – security best practices |
| [VPS Deployment](https://github.com/AdguardTeam/AdguardHome/wiki/VPS) | GitHub Wiki – VPS setup |
| [Configuration](https://github.com/AdguardTeam/AdguardHome/wiki/Configuration) | GitHub Wiki – configuration options |
| [Verify Releases](https://github.com/AdguardTeam/AdguardHome/wiki/Verify-Releases) | GitHub Wiki – verifying release signatures |

## Manual DNS (without Cloudflare)

If you don't set `cloudflareZoneId`, create the A record manually:

```
dns.example.com  A  <VPS_IPV4>
```

Get the IP from `pulumi stack output ipv4Address`.

## Destroy

```bash
pulumi destroy
```
