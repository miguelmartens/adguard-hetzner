# AdGuard Home on Hetzner Cloud with Pulumi

Deploy [AdGuard Home](https://adguard.com/adguard-home/overview.html) to Hetzner Cloud using Infrastructure as Code with Pulumi, Tailscale for secure admin access, and Caddy for public DNS-over-HTTPS.

## Overview

This project deploys AdGuard Home (network-wide DNS filter) on Hetzner Cloud with:

- **Hetzner Cloud** server (default: cx23 – 2 vCPUs, 4GB RAM)
- **Debian 13** (Trixie) – sovereign, EU-aligned base OS; managementless unattended-upgrades, SSH hardening, fail2ban
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
- Domain for DoH (base domain only; `dns.` prefix added automatically, e.g. `example.com` → DoH at `dns.example.com`)
- Cloudflare account (optional, for automatic A record)

## Cost Estimate

| Resource | Specs | Monthly Cost |
|----------|-------|--------------|
| Hetzner cx23 | 2 vCPUs, 4GB RAM | €3.62 (~$4) |
| **Total** | | **~$4/month** |

*20TB traffic included. Tailscale and Cloudflare free tiers cover the rest.*

## EU Digital Sovereignty

This stack is designed with **EU digital sovereignty** and data protection in mind:

| Component | Sovereignty / EU alignment |
|-----------|----------------------------|
| **Debian 13** | Community-driven, no corporate owner. Widely used in EU public sector. Independent, transparent development. |
| **Hetzner Cloud** | German company, EU data centers (Falkenstein, Nuremberg, Helsinki). GDPR-compliant. [European Cloud](https://www.hetzner.com/cloud) offering. |
| **AdGuard Home** | Open-source DNS filter. Self-hosted; your DNS data stays on your server. |
| **Caddy** | Open-source web server. Apache 2.0 license. |
| **Tailscale** | Admin access only; no DNS data flows through Tailscale for DoH. |

**Data residency**: Choose Hetzner locations `fsn1` (Falkenstein, Germany), `nbg1` (Nuremberg, Germany), or `hel1` (Helsinki, Finland) to keep data within the EU/EEA.

**Why Debian?** Debian is a fully community-driven project with no commercial backing. It aligns with EU goals for digital sovereignty: independence from non-EU vendors, transparency, and long-term support without vendor lock-in.

## Quick Start

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/miguelmartens/adguard-hetzner.git
cd adguard-hetzner
npm install
```

### 2. Configure Pulumi ESC (Secrets Management)

Create a new ESC environment for secrets:

```bash
pulumi env init <your-org>/adguard-secrets
```

Edit the environment and add your secrets:

```yaml
values:
  tailscaleAuthKey:
    fn::secret: "tskey-auth-xxxxx"
  tailnetDnsName: "tailxxxxx.ts.net"
  domain: "example.com"   # Base domain only; DoH hostname is dns.<domain> (e.g. dns.example.com)
  hcloudToken:
    fn::secret: "your-hetzner-api-token"
  pulumiConfig:
    adguard-hetzner:tailscaleAuthKey: ${tailscaleAuthKey}
    adguard-hetzner:tailnetDnsName: ${tailnetDnsName}
    adguard-hetzner:domain: ${domain}
    hcloud:token: ${hcloudToken}
```

**Optional – Cloudflare DNS** (add to ESC if you want automatic A record). The created A record includes the comment `Managed by Pulumi (adguard-hetzner)` for identification:

```yaml
values:
  cloudflareZoneId: "<zone-id>"
  cloudflareApiToken:
    fn::secret: "your-cloudflare-api-token"
  pulumiConfig:
    adguard-hetzner:cloudflareZoneId: ${cloudflareZoneId}
    cloudflare:apiToken: ${cloudflareApiToken}
```

**Where to get these:**

- **Hetzner Cloud Token**: [Console](https://console.hetzner.cloud/) → Project → Security → API Tokens
- **Tailscale Auth Key**: [Admin Console](https://login.tailscale.com/admin/settings/keys) → Settings → Keys (enable "Reusable")
- **Tailnet DNS Name**: [Admin Console](https://login.tailscale.com/admin/dns) → DNS → Look for `tailxxxxx.ts.net`
- **Domain**: Your base domain only (e.g. `example.com`). The `dns.` prefix is added automatically — DoH will be at `dns.<domain>` (e.g. `dns.example.com`).
- **Cloudflare Zone ID** (optional): [Dashboard](https://dash.cloudflare.com/) → Select domain → Overview → Zone ID (right sidebar)
- **Cloudflare API Token** (optional): [Dashboard](https://dash.cloudflare.com/profile/api-tokens) → Create Token → Edit zone DNS template

**Important**: Enable HTTPS in your [Tailscale admin console](https://login.tailscale.com/admin/dns) (DNS settings → HTTPS Certificates → Enable)

### 3. Link ESC Environment

Create or update `Pulumi.dev.yaml`:

```yaml
environment:
  - <your-org>/adguard-secrets
config:
  adguard-hetzner:serverType: cx23
  adguard-hetzner:location: fsn1
  adguard-hetzner:ipv6Only: false   # Set true for IPv6-only (cheaper, AAAA record)
```

### 4. Initialize Pulumi Stack

```bash
# Login to Pulumi Cloud
pulumi login

# Create a new stack (or select existing)
pulumi stack init dev

# Optional: Configure custom settings (or use Pulumi.dev.yaml)
pulumi config set serverType cx23   # Default: cx23 (2 vCPU, 4GB)
pulumi config set location fsn1     # Default: fsn1 (Falkenstein, Germany)
pulumi config set ipv6Only false    # Set true for IPv6-only (cheaper, AAAA record)
```

*If not using ESC*, set config manually:

```bash
pulumi config set --secret hcloud:token <token>
pulumi config set domain example.com   # Base domain; DoH = dns.example.com
pulumi config set tailnetDnsName tailxxxxx.ts.net
pulumi config set --secret tailscaleAuthKey <key>
```

### 5. Deploy

```bash
# Preview changes
pulumi preview

# Deploy infrastructure
pulumi up
```

**Wait 2–3 minutes** after deployment for cloud-init to complete the AdGuard Home installation.

### 6. Get Access URL and Admin Password

```bash
# Admin UI (Tailscale only) – open in browser
pulumi stack output webUiUrl

# Initial admin password (change on first login)
pulumi stack output adguardAdminPassword --show-secrets

# DoH endpoint for clients
pulumi stack output dohUrl

# Server IP (use ipv6Address when ipv6Only is true)
pulumi stack output ipv4Address
pulumi stack output ipv6Address
```

Copy the web UI URL and admin password. Log in and change the password immediately.

### 7. Post-Deploy

1. **Change admin password** – Access the web UI via `https://<hostname>.<tailnet>.ts.net` (Tailscale) and go to Settings → Profile.
2. **Security updates** – Managementless: unattended-upgrades runs daily (security + stable updates). No prompts; reboots at 03:00 when needed.

3. **Verify DoH**:
   ```bash
   curl -H "Accept: application/dns-json" "https://dns.example.com/dns-query?name=example.com&type=A"
   ```

4. **Configure devices** – Use `https://dns.example.com/dns-query` as the DoH server on your devices.

### 8. Verify Installation

```bash
# Check stack outputs
pulumi stack output

# Test DoH from your machine
curl -H "Accept: application/dns-json" "$(pulumi stack output dohUrl)?name=example.com&type=A"
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

### Default Configuration

This deployment pre-configures AdGuard Home with security-hardened settings and curated blocklists. All settings are defined in `index.ts` and applied at deploy time.

**DNS Settings:**
- **Upstream**: Quad9 (DoH)
- **Fallback**: Cloudflare, AdGuard (unfiltered), Mullvad
- **Bootstrap**: Cloudflare (1.1.1.1), Quad9 (9.9.9.9)
- **Rate limit**: 20 queries/second
- **DNSSEC**: Enabled
- **Parallel requests**: Enabled (upstream_mode: parallel)
- **Plain DNS (port 53)**: Localhost only

**Security:**
- Auth lockout: 5 failed attempts, 15-minute block
- Safe Browsing (AdGuard browsing security): Enabled
- Trusted proxies: Caddy, Tailscale, private ranges
- Refuse ANY queries (mitigates amplification)
- Client access: allow all by default (see [Client Access Control](#client-access-control) to restrict)

**Blocklists (9 enabled):**

| # | Blocklist | Purpose |
|---|-----------|---------|
| 1 | AdGuard DNS filter | General ads & trackers |
| 2 | AdAway Default Blocklist | Mobile ads |
| 3 | Dandelion Sprout's Anti-Malware | Malware domains |
| 4 | HaGeZi's Threat Intelligence | Threat intel feeds |
| 5 | HaGeZi's Pro++ Blocklist | Aggressive blocking |
| 6 | GoodbyeAds YouTube Adblock | YouTube ads |
| 7 | Steven Black's List | Unified hosts |
| 8 | Malicious URL Blocklist (URLHaus) | Malware URLs |
| 9 | AdGuard DNS filter (HostlistsRegistry) | Additional coverage |

You can add, remove, or customize blocklists after deployment via the AdGuard web UI (Filters → DNS blocklists). Changes persist in `/opt/adguardhome/work/`.

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

### Host Security (Debian & Docker)

The deployment applies security best practices to the Debian host and Docker:

| Layer | Measure | Description |
|-------|---------|-------------|
| **Unattended-upgrades** | Managementless updates | Security + stable updates (Debian-Security, trixie-updates). No prompts: `Dpkg::Options --force-confdef/--force-confold` for config files, `apt-listchanges frontend=none`. Auto-reboot at 03:00 when needed. Removes unused deps and old kernels. |
| **SSH hardening** | `sshd_config.d/99-hardening.conf` | Key-based auth only (`PasswordAuthentication no`), `PermitRootLogin prohibit-password`, `MaxAuthTries 3`, `ClientAliveInterval 300`. |
| **fail2ban** | SSH jail | 5 retries → 1h ban. Protects against brute-force on port 22. |
| **Docker daemon** | `daemon.json` | Log rotation (10MB × 3 files), `live-restore` so containers survive daemon restarts. |
| **AdGuard container** | `--security-opt=no-new-privileges` | Prevents privilege escalation inside the container. |

**Managementless design**: The host requires no manual intervention for updates. Config file conflicts are resolved automatically (keep defaults for unmodified files, keep yours for modified). Reboots occur at 03:00 when required. Ensure SSH key access works before relying on Tailscale—if Tailscale fails, you need key-based SSH to recover.

### AdGuard Home Security

Per [AdGuard's running securely guide](https://adguard-dns.io/kb/adguard-home/running-securely/). See [`docs/SECURITY_CHECKLIST.md`](docs/SECURITY_CHECKLIST.md) for a full checklist.

- **Plain DNS (port 53)**: Disabled. Clients use DoH only.
- **Rate limiting**: 20 queries/second (configurable in AdGuard UI)
- **Refuse ANY**: Enabled to mitigate amplification attacks
- **Trusted proxies**: Caddy and Tailscale subnets configured for correct client IP logging
- **Auth lockout**: 5 failed attempts, 15-minute block

### Client Access Control

By default, any client that can reach the DoH endpoint can use your DNS server (`allowed_clients: []` = allow all). For a private or family setup, restrict access:

| Setting | Purpose |
|---------|---------|
| **allowed_clients** | If non-empty, only these clients can use DNS. Others are rejected. |
| **disallowed_clients** | Block specific clients (ignored when `allowed_clients` is set). |
| **Persistent Clients** | Named clients with per-client settings (blocklists, safe search, etc.). |

**Configure at deploy time** in `index.ts` (bootstrap config):

```yaml
dns:
  allowed_clients:
    - 192.168.1.0/24      # Home LAN
    - 100.64.0.0/10       # Tailscale
    - 10.0.0.0/8          # Private
```

**Configure after deployment** via AdGuard web UI: **Settings → Client settings** → add clients by IP, CIDR, or ClientID.

**Note:** With DoH behind Caddy, AdGuard sees client IPs from `X-Forwarded-For` / `X-Real-IP` (trusted proxies). Ensure your clients' IP ranges are in `trusted_proxies` for correct identification.

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
  - Triggers: PR to `main`, merge queue
  - Action: `pulumi preview`
  - Comments preview output on PR
  - **Required before merge**: Configure branch protection to require this check (see [Branch Protection](docs/BRANCH_PROTECTION.md))

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

### IPv6-only

Use IPv6-only to save on Hetzner's IPv4 cost (no separate IPv4 address). Cloudflare will get an AAAA record instead of A. DoH and SSH require IPv6 connectivity.

```bash
pulumi config set ipv6Only true
```

### Configuration Reference

| Key | Required | Description |
|-----|----------|-------------|
| `hcloud:token` | Yes (secret) | Hetzner Cloud API token |
| `domain` | Yes | Base domain only (e.g. `example.com`). The `dns.` prefix is added automatically — DoH at `dns.<domain>`. |
| `tailnetDnsName` | Yes | Tailscale MagicDNS (e.g. `ts.net`) |
| `tailscaleAuthKey` | Yes (secret) | Tailscale auth key |
| `serverType` | No | Hetzner server type (default: `cx23`) |
| `location` | No | Hetzner location (default: `fsn1`) |
| `image` | No | Hetzner server image (default: `debian-13`). Use `debian-12` if Debian 13 is not yet available in your region. |
| `ipv6Only` | No | Use IPv6-only (no IPv4). Creates AAAA record instead of A. Default: `false` |
| `cloudflareZoneId` | No | Cloudflare zone ID for A/AAAA record |
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

### Security (unattended-upgrades, fail2ban)

```bash
# Unattended-upgrades: last run, pending updates
grep -E "^(Start|End):" /var/log/unattended-upgrades/unattended-upgrades.log | tail -4

# fail2ban: SSH jail status
sudo fail2ban-client status sshd

# Pending security updates
apt list --upgradable 2>/dev/null | grep -i security
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

If you don't set `cloudflareZoneId`, create the record manually:

```
# IPv4 (default)
dns.example.com  A  <VPS_IPV4>

# IPv6-only (when ipv6Only is true)
dns.example.com  AAAA  <VPS_IPV6>
```

Get the IP from `pulumi stack output ipv4Address` or `pulumi stack output ipv6Address`.

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

# Verify DNS record points to server (A or AAAA when ipv6Only)
pulumi stack output ipv4Address
pulumi stack output ipv6Address
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

### AdGuard "HTTPS port" Empty

This is intentional. Caddy terminates TLS and proxies DoH to AdGuard over HTTP. AdGuard's `port_https: 0` and `allow_unencrypted_doh: true` allow this. Do not enable AdGuard's HTTPS—it would conflict with Caddy.

### SSL Certificate Issues

**General checks:**
- Ensure port 80 is open for ACME HTTP-01
- Verify `dns.<domain>` resolves to server IP before deploy
- Check Caddy logs: `journalctl -u caddy -f`

**Let's Encrypt rate limit (HTTP 429):**

If DoH fails with certificate errors and Caddy logs show:
```
HTTP 429 urn:ietf:params:acme:error:rateLimited - too many certificates (5) 
already issued for this exact set of identifiers in the last 168h0m0s
```

Let's Encrypt limits **5 certificates per exact domain set per 7 days**. This happens when:
- The server was recreated (`pulumi destroy` + `pulumi up`) and Caddy lost its ACME state (stored in `/var/lib/caddy`)
- Caddy repeatedly tried to obtain a new certificate instead of reusing an existing one

**What to do:**
1. **Wait** – The limit resets after the time shown in the error (e.g. `retry after 2026-02-25 18:42:27 UTC`). Caddy retries automatically; no action needed.
2. **Verify** – `journalctl -u caddy -f` to confirm retries continue.
3. **Avoid** – After `pulumi destroy`, wait before redeploying, or back up `/var/lib/caddy` before destroy and restore it on the new server to reuse the certificate.

**ACME state lost:** If `/var/lib/caddy/.local/share/caddy/acme/` is missing or empty, Caddy will always request a new certificate. Server recreation (e.g. `pulumi destroy`), disk replacement, or OS reinstall clears this. See [Let's Encrypt rate limits](https://letsencrypt.org/docs/rate-limits/#new-certificates-per-exact-set-of-identifiers).

### SSH Access

```bash
# Via Tailscale (preferred)
ssh root@<hostname>.<tailnet>.ts.net

# Via public IP (fallback, use generated key)
# IPv4:
ssh -i <(pulumi stack output privateKey --show-secrets) root@$(pulumi stack output ipv4Address)
# IPv6-only:
ssh -i <(pulumi stack output privateKey --show-secrets) root@[$(pulumi stack output ipv6Address)]
```

## Cleanup

To destroy all resources:

```bash
pulumi destroy
```

**Note:** Destroying recreates the server and clears Caddy's ACME state (`/var/lib/caddy`). If you redeploy immediately, Caddy will request a new Let's Encrypt certificate. Repeated destroy/redeploy cycles can hit [Let's Encrypt rate limits](https://letsencrypt.org/docs/rate-limits/) (5 certs per domain per 7 days). See [SSL Certificate Issues](#ssl-certificate-issues) if DoH fails after redeploy.

This will:
- Delete the Hetzner server
- Remove firewall rules
- Delete SSH keys
- Remove Cloudflare A/AAAA record (if configured)
- Remove Tailscale connection (manually remove from admin console if needed)

## Documentation

- [`docs/BRANCH_PROTECTION.md`](docs/BRANCH_PROTECTION.md) - Require Pulumi preview to pass before merge
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
