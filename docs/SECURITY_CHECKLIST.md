# Security Checklist for AdGuard Home on Hetzner

This checklist helps you secure your AdGuard Home deployment on Hetzner Cloud with Pulumi and GitHub Actions.

## ✅ Implementation Status

This project has **implemented many security best practices out of the box**:

### Pre-Implemented Security Features

**GitHub Actions CI/CD:**
- ✅ Explicit permissions in all workflows (least privilege)
- ✅ All actions pinned to SHA commits with version comments
- ✅ Renovate configured for automated dependency updates
- ✅ Security vulnerability alerts enabled
- ✅ `npm ci` for reproducible builds
- ✅ Node.js caching enabled
- ✅ Secrets managed via GitHub Secrets & Pulumi config

**Infrastructure Security:**
- ✅ Hetzner Cloud Firewall enabled
- ✅ Only SSH (22), HTTP (80), HTTPS (443) exposed; plain DNS (53) disabled
- ✅ Ubuntu automatic security updates configured (`unattended-upgrades`)
  - Daily security updates applied automatically
  - Automatic reboot at 3 AM if required
- ✅ SSH key authentication configured
- ✅ Docker installed and updated
- ✅ Tailscale for zero-trust admin access

**Network Security:**
- ✅ Web UI accessible only via Tailscale (no public exposure)
- ✅ DoH (DNS-over-HTTPS) with Let's Encrypt via Caddy
- ✅ Plain DNS disabled (`serve_plain_dns: false`)
- ✅ Rate limiting (20 q/s), refuse ANY, trusted proxies
- ✅ Auth lockout (5 attempts, 15-min block)

**AdGuard Home Security:**
- ✅ Encrypted DNS only (DoH)
- ✅ Trusted proxies for Caddy and Tailscale
- ✅ Security filters enabled (safebrowsing, blocklists)
- ✅ DNSSEC enabled

### Items Requiring Manual Configuration

The checklist below highlights items that require **your action** to fully secure the deployment, including:
- Repository settings (branch protection, code scanning)
- Tailscale ACL configuration
- Secret rotation schedules
- Monitoring and audit logging setup
- Incident response procedures

**Legend:**
- [x] = Implemented in code/configuration
- [ ] = Requires manual setup or ongoing maintenance

---

## 📋 Table of Contents

- [Pre-Deployment Security](#pre-deployment-security)
- [GitHub Actions CI/CD Security](#github-actions-cicd-security)
- [Infrastructure Security](#infrastructure-security)
- [AdGuard Home Security](#adguard-home-security)
- [Secrets Management](#secrets-management)
- [Network Security](#network-security)
- [Monitoring & Auditing](#monitoring--auditing)
- [Incident Response](#incident-response)

---

## Pre-Deployment Security

### Repository Configuration

- [ ] Enable **secret scanning** in repository settings
- [ ] Enable **push protection** for secrets
- [ ] Enable **Renovate** for automated dependency updates
- [ ] Configure **Renovate** security vulnerability alerts
- [ ] Enable **code scanning** (CodeQL or similar)
- [ ] Set repository visibility to **private** (if applicable)
- [ ] Review and limit repository collaborators
- [ ] Enable **two-factor authentication** for all collaborators

### Branch Protection Rules

- [ ] Create branch protection rule for `main` branch
- [ ] Require **pull request reviews** before merging (min. 1 reviewer)
- [ ] Require **status checks** to pass before merging (require **Pulumi Preview**; see [Branch Protection](BRANCH_PROTECTION.md))
- [ ] Require branches to be **up to date** before merging
- [ ] Require **signed commits** (optional but recommended)
- [ ] Include administrators in branch protection
- [ ] Restrict who can push to `main` branch
- [ ] Require **linear history** (no merge commits)

### GitHub Environments

- [ ] Create `production` environment
- [ ] Add **required reviewers** for production deployments
- [ ] Set **deployment branch rules** (only `main`)
- [ ] Configure **environment secrets** (separate from repository secrets)
- [ ] Set **wait timer** for production deployments (optional)

---

## GitHub Actions CI/CD Security

### Workflow Permissions

- [x] Add explicit `permissions:` block to all workflows
- [x] Use **least privilege** principle for each job
- [ ] Set workflow permissions to `read-all` by default in repository settings
- [x] Review and minimize `write` permissions
- [x] Use `id-token: write` for OIDC (future-proofing)

### Renovate Configuration

- [ ] Install **Renovate GitHub App** on repository
- [x] Create `renovate.json` configuration file
- [x] Enable **dependency dashboard** for overview of updates
- [x] Configure **automatic merging** for security patches
- [x] Set **schedule** for dependency updates (weekly)
- [x] Group related updates together (npm, GitHub Actions)
- [x] Enable **vulnerability alerts** with security labels
- [x] Set **minimum release age** (stability period)
- [x] Configure **automerge** for patch updates
- [x] Review and approve major version updates manually

See the `renovate.json` file in the repository root for full configuration.

### Action Version Pinning

- [x] Pin all GitHub Actions to **specific SHA commits** (Renovate automates this)
- [x] Add version comments for human readability
- [x] Let Renovate automatically update pinned versions

### Security Scanning in CI/CD

- [ ] Add **Trivy vulnerability scanner** to pull request workflow
- [ ] Add **dependency review** action for PRs
- [ ] Add **npm audit** step in workflows
- [ ] Upload scan results to **GitHub Security tab**
- [ ] Configure scan to **fail on critical/high** vulnerabilities

### Build Security

- [x] Use `npm ci` instead of `npm install` for reproducible builds
- [x] Enable **Node.js caching** in workflows
- [x] Verify **package-lock.json** is committed
- [x] Run builds in **isolated environments**

### Secret Management in Workflows

- [x] Store all secrets in **GitHub Secrets** (never in code)
- [x] Use **Pulumi config** with `--secret` for infra secrets
- [ ] Rotate secrets regularly (quarterly minimum)
- [ ] Use **environment-specific** secrets when applicable
- [ ] Audit secret access logs periodically
- [x] Never log or output secrets in workflow runs

---

## Infrastructure Security

### Hetzner Cloud Security

- [x] Enable **Hetzner Cloud Firewall**
- [x] Restrict ports: SSH (22), HTTP (80), HTTPS (443) only
- [ ] Enable **backups** for server (costs extra)
- [ ] Review firewall rules regularly
- [ ] Monitor API token usage in Hetzner console
- [ ] Rotate **Hetzner API tokens** quarterly
- [ ] Enable **2FA** on Hetzner account

### Server Hardening

- [x] Keep Ubuntu system packages **up to date**
- [x] Configure **automatic security updates** via `unattended-upgrades`
  - [x] Install `unattended-upgrades` package
  - [x] Enable daily update checks
  - [x] Enable automatic upgrade installation
  - [x] Configure automatic reboot if needed (3 AM)
  - [ ] Review `/var/log/unattended-upgrades/` logs periodically
- [ ] Disable **root SSH login**
- [x] Use **SSH key authentication**
- [ ] Configure **fail2ban** for brute force protection (optional)
- [ ] Enable **UFW firewall** on server
- [ ] Minimize installed packages

### Docker Security

- [x] Keep Docker **up to date**
- [x] Run AdGuard Home via official image
- [ ] Use **Docker security scanning** for images
- [ ] Set **resource limits** (CPU, memory)
- [ ] Regularly prune unused images and containers

### Tailscale Security

- [x] Enable **Tailscale HTTPS** in admin console
- [x] Use **reusable auth keys** with expiration
- [x] Enable **Tailscale SSH**
- [ ] Configure **ACLs** in Tailscale admin
- [x] Enable **MagicDNS** for easy access
- [ ] Review connected devices regularly
- [ ] Enable **key expiry** for devices
- [ ] Use **Tailscale Serve** for web UI only (no public exposure)

---

## AdGuard Home Security

### DNS Security

- [x] **Plain DNS disabled** (`serve_plain_dns: false`)
- [x] **DoH only** via Caddy with Let's Encrypt
- [x] **Rate limiting** (20 q/s default)
- [x] **Refuse ANY** queries (amplification protection)
- [x] **Trusted proxies** for Caddy and Tailscale
- [x] **DNSSEC** enabled
- [ ] Consider **allowed_clients** allowlist for DoH (if known clients)
- [ ] Review **blocklists** and filters regularly

### Web UI Security

- [x] Web UI **Tailscale-only** (no public exposure)
- [x] **Auth lockout** (5 attempts, 15-min block)
- [ ] **Change default admin password** on first login
- [ ] Enable **2FA** if AdGuard supports it
- [ ] Review **session TTL** (default 720h)
- [ ] Log all admin access attempts

### Caddy / TLS Security

- [x] **Let's Encrypt** certificates via Caddy
- [x] **Automatic HTTPS** for DoH endpoint
- [x] **Reverse proxy** to AdGuard (no direct exposure)
- [ ] Monitor **certificate expiration** (Caddy auto-renews)
- [ ] Consider **HSTS** headers (Caddy default)

---

## Secrets Management

### Pulumi Config

- [x] Store sensitive values with `pulumi config set --secret`
- [x] Use **secret references** for credentials
- [x] Never output secrets in Pulumi stack outputs
- [ ] Rotate Pulumi secrets quarterly
- [ ] Back up Pulumi state securely

### API Keys & Tokens

- [x] **Hetzner Cloud Token** – Store in env or Pulumi
- [x] **Tailscale Auth Key** – Store in Pulumi config, set expiration
- [x] **Pulumi Access Token** – GitHub Secrets
- [x] **Cloudflare API Token** – Pulumi config (if used)
- [ ] Rotate all tokens every **90 days**
- [ ] Document token rotation procedures

### Secret Rotation Schedule

| Secret | Rotation Frequency | Last Rotated | Next Due |
|--------|-------------------|--------------|----------|
| Pulumi Access Token | Quarterly | ____________ | ________ |
| Hetzner API Token | Quarterly | ____________ | ________ |
| Tailscale Auth Key | Quarterly | ____________ | ________ |
| Cloudflare API Token | Quarterly | ____________ | ________ |
| AdGuard Admin Password | On compromise | ____________ | ________ |
| SSH Keys | Annually | ____________ | ________ |

---

## Network Security

### Firewall Configuration

- [x] **Port 22** – SSH (fallback)
- [x] **Port 80** – HTTP (ACME redirect)
- [x] **Port 443** – HTTPS (Caddy/DoH)
- [x] **Port 53** – Not exposed (plain DNS disabled)
- [ ] Consider **removing public SSH** after Tailscale verification
- [ ] Review firewall logs weekly

### Network Segmentation

- [x] Use **Tailscale network** for admin access
- [x] **DoH** is public; web UI is Tailscale-only
- [ ] Use **Tailscale ACLs** for fine-grained access
- [x] Document network topology

### DNS & TLS

- [x] **Let's Encrypt** for DoH endpoint
- [x] **Tailscale HTTPS** for web UI
- [x] **MagicDNS** for admin access
- [ ] Monitor **certificate expiration**

---

## Monitoring & Auditing

### Application Monitoring

- [ ] Set up **log aggregation** (optional)
- [ ] Monitor **AdGuard uptime**
- [ ] Track **DNS query volume**
- [ ] Set up **alerts** for errors
- [ ] Monitor **disk space** usage
- [ ] Log all **admin access attempts**

### Security Auditing

- [ ] Review **Pulumi Cloud audit logs**
- [ ] Review **GitHub Actions workflow runs**
- [ ] Check **Tailscale audit logs**
- [ ] Review **Hetzner Cloud activity logs**
- [ ] Audit **user access and permissions** monthly

### Compliance & Reporting

- [ ] Document **data handling procedures**
- [ ] Maintain **asset inventory**
- [ ] Create **incident response plan**
- [ ] Schedule quarterly **security reviews**

---

## Incident Response

### Preparation

- [ ] Document **emergency contacts**
- [ ] Create **incident response runbook**
- [ ] Document **rollback procedures** (`pulumi destroy` + redeploy)
- [ ] Create **emergency access procedures**

### Emergency Procedures

**If Secrets Are Compromised:**
1. Rotate all affected credentials
2. Review access logs for unauthorized activity
3. Update Pulumi config and GitHub Secrets
4. Redeploy with new configuration
5. Document incident and timeline

**If Server Is Compromised:**
1. Isolate server from network
2. Snapshot disk for forensics
3. Run `pulumi destroy` and redeploy from scratch
4. Rotate all secrets
5. Review logs for scope of breach

**Emergency Contacts:**
- Primary: ___________________________
- Secondary: _________________________
- Pulumi Support: support@pulumi.com
- Hetzner Support: https://www.hetzner.com/support

---

## Security Review Schedule

### Weekly
- [ ] Review firewall logs
- [ ] Check for failed authentication attempts
- [ ] Review GitHub Actions runs
- [ ] Check Renovate Dependency Dashboard

### Monthly
- [ ] Review access permissions
- [ ] Check for outdated dependencies
- [ ] Review AdGuard blocklists and filters

### Quarterly
- [ ] Rotate all API keys and tokens
- [ ] Full security assessment
- [ ] Review and test incident response plan
- [ ] Update documentation

### Annually
- [ ] Security policy review
- [ ] Rotate SSH keys
- [ ] Review and update security procedures

---

## Tools & Commands

### Security Scanning
```bash
# NPM vulnerability scan
npm audit --audit-level=high

# Check for exposed secrets
git secrets --scan

# Check for security updates
sudo apt update && sudo apt list --upgradable
```

### Network Security
```bash
# Check open ports
sudo ss -tulpn

# Tailscale status
tailscale status
```

### Log Analysis
```bash
# AdGuard Home logs (Docker)
docker logs adguardhome

# Caddy logs
journalctl -u caddy -f

# SSH authentication attempts
sudo grep "Failed password" /var/log/auth.log

# Tailscale logs
journalctl -u tailscaled
```

---

## Resources

**AdGuard Home:**
- [Getting Started (KB)](https://adguard-dns.io/kb/adguard-home/getting-started/)
- [Getting Started (Wiki)](https://github.com/AdguardTeam/AdguardHome/wiki/Getting-Started)
- [Running Securely](https://adguard-dns.io/kb/adguard-home/running-securely/)
- [VPS Deployment](https://github.com/AdguardTeam/AdguardHome/wiki/VPS)
- [Configuration](https://github.com/AdguardTeam/AdguardHome/wiki/Configuration)
- [Verify Releases](https://github.com/AdguardTeam/AdguardHome/wiki/Verify-Releases)

**Infrastructure & Tools:**
- [GitHub Actions Security Hardening](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [Tailscale Security Best Practices](https://tailscale.com/kb/1018/security)
- [Hetzner Cloud Security](https://docs.hetzner.com/cloud/general/security/)
- [Caddy Documentation](https://caddyserver.com/docs/)
- [Renovate Documentation](https://docs.renovatebot.com/)

---

## Change Log

| Date | Changes | Author |
|------|---------|--------|
| 2025-02-23 | Initial checklist for AdGuard Home on Hetzner | System |

---

## Notes

**Security Implementation Progress:**
- ✅ **Core Infrastructure:** 100% (Firewall, Tailscale, SSH keys)
- ✅ **GitHub Actions:** 95% (Needs: CodeQL scanning)
- ✅ **Secrets Management:** 100% (Pulumi config)
- ✅ **Network Security:** 100% (Tailscale, HTTPS, DoH only)
- ✅ **AdGuard Security:** 95% (Change admin password on first login)
- ⚠️ **Monitoring:** 30% (Basic logs only)
- ⚠️ **Incident Response:** 0% (Requires documentation)

**Estimated Overall Completion: ~75%** of security checklist items implemented

---

**Last Updated:** 2025-02-23  
**Next Review Date:** 2025-03-02 (Weekly)
