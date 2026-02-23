# AdGuard Home on Hetzner Cloud with Pulumi

Deploy [AdGuard Home](https://adguard.com/adguard-home/overview.html) to Hetzner Cloud using Infrastructure as Code with Pulumi, Tailscale for secure admin access, and Caddy for public DNS-over-HTTPS.

## Overview

This project deploys AdGuard Home (network-wide DNS filter) on Hetzner Cloud with:

- **Hetzner Cloud** server (default: cx23 – 2 vCPUs, 4GB RAM)
- **Tailscale** for secure private admin UI access (web UI not exposed publicly)
- **Caddy** reverse proxy with Let's Encrypt for DNS-over-HTTPS (DoH)
- **Public DoH** at `dns.<domain>/dns-query` for client devices
- **Cloudflare** optional DNS record management
- **GitHub Actions** CI/CD for preview and deployment
- **Renovate** for automated dependency updates and security patches

## Prerequisites

Before getting started, ensure you have:

- [Pulumi CLI](https://www.pulumi.com/docs/get-started/install/) installed
- [Pulumi Cloud account](https://app.pulumi.com/signup) (free tier available)
- [Hetzner Cloud account](https://www.hetzner.com/cloud)
- [Tailscale account](https://tailscale.com/) with HTTPS enabled
- [Node.js 22+](https://nodejs.org/) installed
- Domain for DoH (e.g. `example.com` → DoH at `dns.example.com`)
- Cloudflare account (optional, for automatic A record)

## Cost Estimate

| Resource | Specs | Monthly Cost |
|----------|-------|--------------|
| Hetzner cx23 | 2 vCPUs, 4GB RAM | €3.62 (~$4) |
| **Total** | | **~$4/month** |

*20TB traffic included. Tailscale and Cloudflare free tiers cover the rest.*

## Quick Start

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/miguelmartens/adguard-hetzner.git
cd adguard-hetzner
npm install
```

### 2. Configure Pulumi Stack

Create or select a stack:

```bash
pulumi login
pulumi stack init dev   # or: pulumi stack select dev
```

Set required configuration (secrets stored in Pulumi config, not GitHub):

```bash
# Required - Hetzner (provider auth)
pulumi config set --secret hcloud:token <token>   # From https://console.hetzner.cloud/

# Required - Application
pulumi config set domain example.com              # Base domain (DoH at dns.example.com)
pulumi config set tailnetDnsName ts.net           # Your Tailscale MagicDNS domain (e.g. tailxxxxx.ts.net)
pulumi config set --secret tailscaleAuthKey <key> # From https://login.tailscale.com/admin/settings/keys

# Optional - Cloudflare DNS (creates A record automatically)
pulumi config set cloudflareZoneId <zone-id>
pulumi config set --secret cloudflare:apiToken <token>
```

**Where to get these:**

- **Hetzner Cloud Token**: [Console](https://console.hetzner.cloud/) → Project → Security → API Tokens
- **Tailscale Auth Key**: [Admin Console](https://login.tailscale.com/admin/settings/keys) → Settings → Keys (enable "Reusable")
- **Tailnet DNS Name**: [Admin Console](https://login.tailscale.com/admin/dns) → DNS → Look for `tailxxxxx.ts.net`

**Important**: Enable HTTPS in your [Tailscale admin console](https://login.tailscale.com/admin/dns) (DNS settings → HTTPS Certificates → Enable)

### 3. Deploy

```bash
# Preview changes
pulumi preview

# Deploy infrastructure
pulumi up
```

**Wait 2–3 minutes** after deployment for cloud-init to complete the AdGuard Home installation.

### 4. Post-Deploy

1. **Change admin password** – Access the web UI via `https://<hostname>.<tailnet>.ts.net` (Tailscale) and go to Settings → Profile.

2. **Verify DoH**:
   ```bash
   curl -H "Accept: application/dns-json" "https://dns.example.com/dns-query?name=example.com&type=A"
   ```

3. **Configure devices** – Use `https://dns.example.com/dns-query` as the DoH server on your devices.

### 5. Get Access URLs

```bash
pulumi stack output webUiUrl   # Admin UI (Tailscale only)
pulumi stack output dohUrl     # DoH endpoint for clients
pulumi stack output ipv4Address
```

## Understanding AdGuard Home Architecture

AdGuard Home acts as a network-wide DNS filter, blocking ads and trackers at the DNS level.

### Core Components

| Component | Port | Description |
|-----------|------|-------------|
| **AdGuard Home** | 8080 (internal) | DNS filter, query log, blocklists |
| **Caddy** | 80, 443 | Reverse proxy, Let's Encrypt, DoH endpoint |
| **Tailscale Serve** | - | Exposes admin UI on MagicDNS (private only) |

### How It Works

- **DoH (Public)**: Clients connect to `https://dns.<domain>/dns-query`. Caddy terminates TLS and proxies to AdGuard. Plain DNS (port 53) is disabled.
- **Admin UI (Private)**: Accessible only via Tailscale at `https://<hostname>.<tailnet>.ts.net`. No public exposure.
- **Trusted Proxies**: Caddy and Tailscale subnets configured for correct client IP logging in AdGuard.

### Communication Flow

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

## Deployment Architecture

```
┌─────────────────────────────────────────────────┐
│ GitHub Actions CI/CD                            │
│  ├─ Pull Request → pulumi preview               │
│  └─ Push to main → pulumi up                    │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ Pulumi Config (Secrets)                          │
│  ├─ hcloud:token (Hetzner)                      │
│  ├─ tailscaleAuthKey                             │
│  ├─ domain, tailnetDnsName                       │
│  └─ cloudflare (optional)                        │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ Hetzner Cloud Server (cx23)                     │
│  ├─ Ubuntu 24.04 LTS                            │
│  ├─ Docker (AdGuard Home)                        │
│  ├─ Caddy (DoH reverse proxy)                   │
│  └─ Tailscale daemon                             │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ Tailscale Network (Private)                     │
│  └─ Admin UI: https://server.tailnet.ts.net      │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ Public Internet                                 │
│  └─ DoH: https://dns.example.com/dns-query      │
└─────────────────────────────────────────────────┘
```

## Security

### Why Tailscale?

This deployment uses Tailscale as a zero-trust network layer for the admin UI. Here's the security comparison:

| Concern | Without Tailscale | With Tailscale |
|---------|-------------------|----------------|
| **Admin UI** | Public (port open) | Private (Tailscale only) |
| **SSH access** | Public (port 22) | Public fallback + Tailscale SSH |
| **API keys in transit** | Exposed if HTTP | Protected by Tailscale encryption |
| **Attack surface** | Multiple open ports | DoH only + SSH fallback |

**Key Benefits:**
- ✅ **Zero-trust admin access**: Only authenticated devices on your Tailscale network can reach the web UI
- ✅ **End-to-end encryption**: All admin traffic encrypted via WireGuard
- ✅ **No public admin exposure**: AdGuard admin UI never exposed to the internet
- ✅ **Automatic HTTPS**: Tailscale provides TLS certificates for MagicDNS

### AdGuard Home Security

Per [AdGuard's running securely guide](https://adguard-dns.io/kb/adguard-home/running-securely/). See [`docs/SECURITY_CHECKLIST.md`](docs/SECURITY_CHECKLIST.md) for a full checklist.

- **Plain DNS (port 53)**: Disabled. Clients use DoH only.
- **Rate limiting**: 20 queries/second (configurable in AdGuard UI)
- **Refuse ANY**: Enabled to mitigate amplification attacks
- **Trusted proxies**: Caddy and Tailscale subnets configured for correct client IP logging
- **Auth lockout**: 5 failed attempts, 15-minute block

### Recommendations

- ✅ Always use Tailscale for admin access
- ✅ Rotate Tailscale auth keys periodically
- ✅ Store secrets in Pulumi config with `--secret` (never commit)
- ✅ Change AdGuard admin password on first login
- ✅ Enable Tailscale SSH to avoid managing keys
- ✅ Verify release signatures before upgrading AdGuard

## GitHub Actions Setup

### Configure Repository Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**:

1. **`PULUMI_ACCESS_TOKEN`**
   - Get from: https://app.pulumi.com/account/tokens
   - Permissions: Full access to your organization

2. **`PULUMI_STACK_NAME`**
   - Format: `<stack>` (e.g. `dev`, `prod`)
   - Find with: `pulumi stack ls`

**Note**: Hetzner token is stored in Pulumi config (`hcloud:token`), not in GitHub. This keeps cloud provider credentials in Pulumi's encrypted backend.

### Workflows

- **Pull Request** (`.github/workflows/pull_request.yml`)
  - Triggers: PR to `main` branch
  - Action: `pulumi preview`
  - Comments preview output on PR

- **Push** (`.github/workflows/push.yml`)
  - Triggers: Push to `main` branch
  - Action: `pulumi up`
  - Deploys infrastructure changes

- **Deploy** (`.github/workflows/deploy.yml`)
  - Triggers: Manual (`workflow_dispatch`)
  - Action: Deploy to chosen stack with optional preview

### Destroy Workflow

- **Trigger**: Manual (`workflow_dispatch`)
- **Safety**: Requires typing `DESTROY` to confirm
- **What gets deleted**: Hetzner server, firewall, SSH keys, Cloudflare record (if configured)

**Post-destruction:**
- Manually remove Tailscale device from admin console
- Verify resources removed in Hetzner Cloud console
- Optionally remove stack: `pulumi stack rm <stack-name>`

### Automated Dependency Management

This project uses **Renovate** for automated dependency updates:

- 📦 Automatic PRs for npm packages, GitHub Actions, and Pulumi providers
- 🔒 Security vulnerability alerts with auto-merge for patches
- 📌 GitHub Actions pinned to commit SHAs
- 📊 Dependency Dashboard for update overview
- 🗓️ Scheduled weekly updates (Mondays at 6am UTC)

**Setup:**
1. Install [Renovate GitHub App](https://github.com/apps/renovate)
2. Merge the onboarding PR Renovate creates
3. Check the Dependency Dashboard issue

See [`docs/RENOVATE_SETUP.md`](docs/RENOVATE_SETUP.md) for detailed configuration.

## Configuration Options

### Server Types

```bash
# Default (cheapest)
pulumi config set serverType cx23   # 2 vCPU, 4GB RAM, €3.62/mo

# Alternatives
pulumi config set serverType cpx11  # 2 vCPU, 2GB, ~€4.35/mo
pulumi config set serverType cax21   # 4 vCPU, 8GB, ~€9/mo
```

### Locations

```bash
pulumi config set location fsn1  # Falkenstein, Germany (default)
pulumi config set location nbg1  # Nuremberg, Germany
pulumi config set location hel1  # Helsinki, Finland
pulumi config set location ash   # Ashburn, USA
```

### Configuration Reference

| Key | Required | Description |
|-----|----------|-------------|
| `hcloud:token` | Yes (secret) | Hetzner Cloud API token |
| `domain` | Yes | Base domain (DoH at `dns.<domain>`) |
| `tailnetDnsName` | Yes | Tailscale MagicDNS (e.g. `ts.net`) |
| `tailscaleAuthKey` | Yes (secret) | Tailscale auth key |
| `serverType` | No | Hetzner server type (default: `cx23`) |
| `location` | No | Hetzner location (default: `fsn1`) |
| `cloudflareZoneId` | No | Cloudflare zone ID for A record |
| `cloudflare:apiToken` | No (secret) | Cloudflare API token |

## Useful Commands

### Pulumi

```bash
pulumi preview              # Preview changes
pulumi up                   # Deploy changes
pulumi destroy              # Destroy all resources
pulumi stack output         # Show all outputs
pulumi stack                # Show current stack info
```

### AdGuard Home (SSH into server)

```bash
docker logs adguardhome -f  # Tail AdGuard logs
docker restart adguardhome  # Restart container
```

### Caddy

```bash
journalctl -u caddy -f      # Tail Caddy logs
sudo systemctl restart caddy # Restart Caddy
```

### Tailscale

```bash
tailscale status            # Show Tailscale status
tailscale ip                # Show Tailscale IP
sudo tailscale serve status  # Show HTTPS proxy status
```

## Configuring Devices for DoH

After deployment, configure your devices to use the DoH endpoint:

- **DoH URL**: `https://dns.example.com/dns-query` (from `pulumi stack output dohUrl`)
- **Android**: Settings → Network → Private DNS → Enter hostname `dns.example.com`
- **iOS**: Install DNSCloak or similar, add DoH URL
- **macOS/Windows**: System settings or use browser extensions
- **Router**: If supported, set DoH in DNS settings

See [AdGuard DoH setup guide](https://adguard-dns.io/kb/adguard-home/getting-started/) for platform-specific instructions.

## Manual DNS (without Cloudflare)

If you don't set `cloudflareZoneId`, create the A record manually:

```
dns.example.com  A  <VPS_IPV4>
```

Get the IP from `pulumi stack output ipv4Address`.

## Upgrading

To upgrade AdGuard Home via Pulumi, edit the Docker image tag in `index.ts` (search for `adguard/adguardhome:v`) and run `pulumi up`.

For in-place upgrades without Pulumi:

```bash
# Use a specific version (verify signature per wiki first)
VERSION=v0.107.72
docker pull adguard/adguardhome:$VERSION
docker stop adguardhome && docker rm adguardhome
docker run -d --name adguardhome --restart unless-stopped \
  -v /opt/adguardhome/work:/opt/adguardhome/work \
  -v /opt/adguardhome/conf:/opt/adguardhome/conf \
  -p 127.0.0.1:8080:80 adguard/adguardhome:$VERSION
```

See [Verify Releases](https://github.com/AdguardTeam/AdguardHome/wiki/Verify-Releases) before upgrading.

## Troubleshooting

### DoH Not Resolving

```bash
# Check Caddy logs
journalctl -u caddy -f

# Verify DNS A record points to server
pulumi stack output ipv4Address
```

### Web UI Unreachable

```bash
# Check Tailscale status on server
tailscale status

# Ensure your device is on the same Tailnet
# Verify HTTPS enabled in Tailscale admin console
```

### Pulumi Auth Error

```bash
# Re-set Hetzner token
pulumi config set --secret hcloud:token <token>
pulumi up
```

### AdGuard Container Exits

```bash
# Check logs
docker logs adguardhome

# Verify permissions
ls -la /opt/adguardhome/work/
```

### SSL Certificate Issues

- Ensure port 80 is open for ACME HTTP-01
- Verify `dns.<domain>` resolves to server IP before deploy
- Check Caddy logs: `journalctl -u caddy -f`

### SSH Access

```bash
# Via Tailscale (preferred)
ssh root@<hostname>.<tailnet>.ts.net

# Via public IP (fallback, use generated key)
ssh -i <(pulumi stack output privateKey --show-secrets) root@$(pulumi stack output ipv4Address)
```

## Cleanup

To destroy all resources:

```bash
pulumi destroy
```

This will:
- Delete the Hetzner server
- Remove firewall rules
- Delete SSH keys
- Remove Cloudflare A record (if configured)
- Remove Tailscale connection (manually remove from admin console if needed)

## Documentation

- [`docs/SECURITY_CHECKLIST.md`](docs/SECURITY_CHECKLIST.md) - Comprehensive security checklist
- [`docs/RENOVATE_SETUP.md`](docs/RENOVATE_SETUP.md) - Renovate configuration guide

## Resources

- [AdGuard Home Getting Started](https://adguard-dns.io/kb/adguard-home/getting-started/)
- [AdGuard Running Securely](https://adguard-dns.io/kb/adguard-home/running-securely/)
- [AdGuard Home GitHub](https://github.com/AdguardTeam/AdguardHome)
- [AdGuard VPS Deployment](https://github.com/AdguardTeam/AdguardHome/wiki/VPS)
- [AdGuard Configuration](https://github.com/AdguardTeam/AdguardHome/wiki/Configuration)
- [AdGuard Verify Releases](https://github.com/AdguardTeam/AdguardHome/wiki/Verify-Releases)
- [Pulumi Hetzner Provider](https://www.pulumi.com/registry/packages/hcloud/)
- [Tailscale Documentation](https://tailscale.com/kb/)
- [Hetzner Cloud Docs](https://docs.hetzner.com/cloud/)
- [Renovate Documentation](https://docs.renovatebot.com/)

## Support

- AdGuard Home Issues: https://github.com/AdguardTeam/AdguardHome/issues
- Pulumi Community Slack: https://slack.pulumi.com

## License

This infrastructure code is provided as-is. AdGuard Home is licensed under [GPL v3](https://github.com/AdguardTeam/AdguardHome/blob/master/LICENSE.txt).

## Acknowledgments

Based on:
- [AdGuard Home Running Securely](https://adguard-dns.io/kb/adguard-home/running-securely/)
- [Pulumi Hetzner Provider](https://www.pulumi.com/registry/packages/hcloud/)
- [Pulumi GitHub Actions](https://www.pulumi.com/docs/iac/guides/continuous-delivery/github-actions/)
