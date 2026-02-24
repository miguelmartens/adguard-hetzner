import * as bcrypt from "bcryptjs";
import * as pulumi from "@pulumi/pulumi";
import * as hcloud from "@pulumi/hcloud";
import * as cloudflare from "@pulumi/cloudflare";
import * as random from "@pulumi/random";
import * as tls from "@pulumi/tls";

const config = new pulumi.Config();

// Hetzner (cx23 ~€3.62/mo; cpx11 ~€4.35/mo; cax21 ~€9/mo)
const serverType = config.get("serverType") ?? "cx23";
const location = config.get("location") ?? "fsn1";
const ipv6Only = config.getBoolean("ipv6Only") ?? false;

// Domain: base domain only (e.g. example.com). The dns. prefix is added automatically — DoH at dns.<domain>
const domain = config.require("domain");
const dohHostname = `dns.${domain}`;

// Tailscale
const tailscaleAuthKey = config.requireSecret("tailscaleAuthKey");
const tailnetDnsName = config.require("tailnetDnsName");

// Cloudflare (optional - for DNS record management)
// Set cloudflare:apiToken in Pulumi config for provider auth
const cloudflareZoneId = config.get("cloudflareZoneId");

// SSH key for server access
const sshKey = new tls.PrivateKey("adguard-ssh-key", {
  algorithm: "ED25519",
});

const hcloudSshKey = new hcloud.SshKey("adguard-sshkey", {
  publicKey: sshKey.publicKeyOpenssh,
});

// Firewall: SSH, HTTP (ACME), HTTPS (Caddy/DoH). No port 53 (plain DNS disabled)
const firewallRules: hcloud.types.input.FirewallRule[] = [
  {
    direction: "out",
    protocol: "tcp",
    port: "any",
    destinationIps: ["0.0.0.0/0", "::/0"],
    description: "Allow all outbound TCP",
  },
  {
    direction: "out",
    protocol: "udp",
    port: "any",
    destinationIps: ["0.0.0.0/0", "::/0"],
    description: "Allow all outbound UDP",
  },
  {
    direction: "out",
    protocol: "icmp",
    destinationIps: ["0.0.0.0/0", "::/0"],
    description: "Allow all outbound ICMP",
  },
  {
    direction: "in",
    protocol: "tcp",
    port: "22",
    sourceIps: ["0.0.0.0/0", "::/0"],
    description: "SSH access",
  },
  {
    direction: "in",
    protocol: "tcp",
    port: "80",
    sourceIps: ["0.0.0.0/0", "::/0"],
    description: "HTTP (ACME redirect)",
  },
  {
    direction: "in",
    protocol: "tcp",
    port: "443",
    sourceIps: ["0.0.0.0/0", "::/0"],
    description: "HTTPS (Caddy/DoH)",
  },
];

const firewall = new hcloud.Firewall("adguard-firewall", {
  rules: firewallRules,
});

// Generate random admin password (exported as secret for first login)
const adminPassword = new random.RandomPassword("adguard-admin-password", {
  length: 24,
  special: true,
  overrideSpecial: "!@#$%&*",
});
const passwordHash = adminPassword.result.apply((p) => bcrypt.hashSync(p, 10));

// AdGuard Home bootstrap config (security-hardened per https://adguard-dns.io/kb/adguard-home/running-securely/)
// Password hash is injected at deploy time - no plain text in repo
//
// Default configuration (see README "Default AdGuard Home Configuration"):
// - DNS: Quad9 upstream, Cloudflare/AdGuard/Mullvad fallback, DNSSEC enabled
// - Security: rate limit 20/s, refuse ANY, auth lockout 5 attempts
// - Blocklists: 9 curated lists (ads, malware, YouTube, etc.)
// - Plain DNS localhost only (required when no encrypted port; Caddy handles DoH)
// - port_https: 0 by design (Caddy terminates TLS for DoH; AdGuard receives HTTP)
const adguardBootstrapConfigTemplate = (pwdHash: string) => `schema_version: 33
http:
  address: 0.0.0.0:80
users:
  - name: admin
    password: ${pwdHash}
auth_attempts: 5
block_auth_min: 15
language: en
clients:
  persistent: []
  runtime_sources:
    hosts: true
    dhcp: true
    rdns: true
    arp: true
    whois: true
web_session_ttl: 720
dns:
  bind_hosts:
    - 127.0.0.1
  port: 53
  statistics_interval: 90
  querylog_enabled: true
  querylog_file_enabled: true
  querylog_interval: 168h
  querylog_size_memory: 1000
  anonymize_client_ip: false
  protection_enabled: true
  blocking_mode: default
  ratelimit: 20
  ratelimit_whitelist: []
  refuse_any: true
  upstream_dns:
    - https://dns.quad9.net/dns-query
  fallback_dns:
    - https://dns.cloudflare.com/dns-query
    - https://unfiltered.adguard-dns.com/dns-query
    - https://dns.mullvad.net/dns-query
  upstream_mode: parallel
  bootstrap_dns:
    - 1.1.1.1
    - 2606:4700:4700::1111
    - 9.9.9.9
    - 2620:fe::fe
  allowed_clients: []
  disallowed_clients: []
  edns_client_subnet:
    enabled: false
    use_custom: false
    custom_ip: ""
  serve_plain_dns: true
  trusted_proxies:
    - 127.0.0.0/8
    - ::1/128
    - 10.0.0.0/8
    - 172.16.0.0/12
    - 192.168.0.0/16
    - 100.64.0.0/10
  cache_size: 4194304
  enable_dnssec: true
filtering:
  protection_enabled: true
  filtering_enabled: true
  parental_enabled: false
  safebrowsing_enabled: true
  filters_update_interval: 24
tls:
  enabled: false
  allow_unencrypted_doh: true
  port_https: 0
  port_dns_over_tls: 0
  port_dns_over_quic: 0
  port_dnscrypt: 0
filters:
  - enabled: true
    url: https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt
    name: AdGuard DNS filter
    id: 1
  - enabled: true
    url: https://adaway.org/hosts.txt
    name: AdAway Default Blocklist
    id: 2
  - enabled: true
    url: https://adguardteam.github.io/HostlistsRegistry/assets/filter_12.txt
    name: Dandelion Sprout's Anti-Malware List
    id: 3
  - enabled: true
    url: https://adguardteam.github.io/HostlistsRegistry/assets/filter_44.txt
    name: HaGeZi's Threat Intelligence Feeds
    id: 4
  - enabled: true
    url: https://adguardteam.github.io/HostlistsRegistry/assets/filter_51.txt
    name: HaGeZi's Pro++ Blocklist
    id: 5
  - enabled: true
    url: https://raw.githubusercontent.com/jerryn70/GoodbyeAds/master/Formats/GoodbyeAds-YouTube-AdBlock-Filter.txt
    name: GoodbyeAds YouTube Adblock
    id: 6
  - enabled: true
    url: https://adguardteam.github.io/HostlistsRegistry/assets/filter_33.txt
    name: Steven Black's List
    id: 7
  - enabled: true
    url: https://adguardteam.github.io/HostlistsRegistry/assets/filter_11.txt
    name: Malicious URL Blocklist (URLHaus)
    id: 8
  - enabled: true
    url: https://adguardteam.github.io/HostlistsRegistry/assets/filter_1.txt
    name: AdGuard DNS filter (HostlistsRegistry)
    id: 9
`;

const userData = pulumi.all([tailscaleAuthKey, dohHostname, passwordHash]).apply(([tsAuthKey, dohHost, pwdHash]) => {
  const adguardBootstrapConfig = adguardBootstrapConfigTemplate(pwdHash);
  return `#!/bin/bash
set -e

export DEBIAN_FRONTEND=noninteractive

# System updates and cleanup
apt-get update
apt-get upgrade -y
apt-get autoremove -y

# Install unattended-upgrades and fail2ban for automatic security
apt-get install -y unattended-upgrades apt-listchanges fail2ban

# Unattended-upgrades: managementless - security + updates, no prompts, auto-reboot
CODENAME=\$(lsb_release -cs 2>/dev/null || echo "trixie")
cat > /etc/apt/apt.conf.d/20auto-upgrades << 'APTEOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APTEOF

# Never prompt on config file changes: keep defaults for unmodified, keep ours for modified
cat > /etc/apt/apt.conf.d/80dpkg-force-confdef << 'DPKGEOF'
Dpkg::Options {
   "--force-confdef";
   "--force-confold";
}
DPKGEOF

# apt-listchanges: frontend=none prevents any prompts (managementless)
cat > /etc/apt/listchanges.conf << 'LISTEOF'
[apt]
frontend=none
LISTEOF

cat > /etc/apt/apt.conf.d/50unattended-upgrades-custom << APTUNATTENDED
Unattended-Upgrade::Allowed-Origins {
    "origin=Debian,codename=\$CODENAME,label=Debian-Security";
    "origin=Debian,codename=\$CODENAME-updates,label=Debian";
};
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-WithUsers "true";
Unattended-Upgrade::Automatic-Reboot-Time "03:00";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::SyslogEnable "true";
APTUNATTENDED

systemctl enable unattended-upgrades
systemctl start unattended-upgrades

# SSH hardening (key-based auth only, reduce attack surface)
mkdir -p /etc/ssh/sshd_config.d
cat > /etc/ssh/sshd_config.d/99-hardening.conf << 'SSHEOF'
PermitRootLogin prohibit-password
PasswordAuthentication no
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
X11Forwarding no
SSHEOF
systemctl restart ssh

# fail2ban: protect SSH (conservative: 5 retries, 1h ban)
cat > /etc/fail2ban/jail.d/sshd.local << 'FAIL2BANEOF'
[sshd]
enabled = true
maxretry = 5
bantime = 1h
findtime = 10m
FAIL2BANEOF
systemctl enable fail2ban
systemctl start fail2ban

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# Docker daemon security: log limits, live-restore
mkdir -p /etc/docker
cat > /etc/docker/daemon.json << 'DOCKEREOF'
{
  "log-driver": "json-file",
  "log-opts": {"max-size": "10m", "max-file": "3"},
  "live-restore": true
}
DOCKEREOF
systemctl restart docker

# Install Caddy
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy
systemctl enable caddy

# Create AdGuard Home directories and bootstrap config
mkdir -p /opt/adguardhome/work /opt/adguardhome/conf
cat > /opt/adguardhome/conf/AdGuardHome.yaml << 'AGHEOF'
${adguardBootstrapConfig}
AGHEOF
chmod 644 /opt/adguardhome/conf/AdGuardHome.yaml

# Run AdGuard Home via Docker (HTTP on 8080 only; plain DNS disabled)
# Security: no-new-privileges prevents privilege escalation inside container
docker run -d \\
  --name adguardhome \\
  --restart unless-stopped \\
  --security-opt=no-new-privileges:true \\
  -v /opt/adguardhome/work:/opt/adguardhome/work \\
  -v /opt/adguardhome/conf:/opt/adguardhome/conf \\
  -p 127.0.0.1:8080:80 \\
  adguard/adguardhome:v0.107.72

# Wait for AdGuard to be ready
sleep 10

# Caddyfile for DoH reverse proxy (Let's Encrypt via HTTP-01)
cat > /etc/caddy/Caddyfile << 'CADDYEOF'
${dohHost} {
    reverse_proxy 127.0.0.1:8080
    encode gzip
}
CADDYEOF

systemctl restart caddy

# Install and configure Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up --authkey="${tsAuthKey}" --ssh --accept-dns=false || echo "WARNING: Tailscale setup failed. Run 'sudo tailscale up' manually."

# Tailscale Serve: expose AdGuard web UI on MagicDNS only (Tailscale-only access)
sleep 5
tailscale serve --bg 8080 || echo "WARNING: tailscale serve failed. Enable HTTPS in Tailscale admin console."

echo "AdGuard Home setup complete!"
echo "Web UI (Tailscale only): https://\$(hostname).${tailnetDnsName}"
echo "DoH endpoint: https://${dohHost}/dns-query"
`;
});

const server = new hcloud.Server("adguard-server", {
  serverType: serverType,
  location: location,
  image: config.get("image") ?? "debian-13",
  sshKeys: [hcloudSshKey.id],
  firewallIds: [firewall.id.apply((id: string) => Number(id))],
  userData: userData,
  labels: {
    purpose: "adguard-home",
  },
  ...(ipv6Only && {
    publicNets: [{ ipv4Enabled: false, ipv6Enabled: true }],
  }),
});

// Cloudflare DNS record (optional - only if cloudflareZoneId is set)
let dnsRecord: cloudflare.DnsRecord | undefined;
if (cloudflareZoneId) {
  dnsRecord = new cloudflare.DnsRecord("adguard-dns-record", {
    zoneId: cloudflareZoneId,
    name: "dns",
    type: ipv6Only ? "AAAA" : "A",
    content: ipv6Only ? server.ipv6Address : server.ipv4Address,
    ttl: 300,
    proxied: false, // DNS-over-HTTPS requires direct connection; set true for DDoS proxy if desired
    comment: "Managed by Pulumi (adguard-hetzner)",
  });
}

// Exports
export const ipv4Address = server.ipv4Address;
export const ipv6Address = server.ipv6Address;
export const ipv6OnlyMode = ipv6Only;
export const privateKey = sshKey.privateKeyOpenssh;
export const tailscaleHostname = server.name;
export const webUiUrl = pulumi.interpolate`https://${server.name}.${tailnetDnsName}`;
export const dohUrl = pulumi.interpolate`https://${dohHostname}/dns-query`;
export const adguardAdminPassword = pulumi.secret(adminPassword.result);
