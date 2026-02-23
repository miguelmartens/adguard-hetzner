# Renovate Setup Guide

Automated dependency management for AdGuard Home on Hetzner.

## Quick Start

1. Install [Renovate GitHub App](https://github.com/apps/renovate)
2. Select this repository
3. Merge the onboarding PR Renovate creates
4. Check the Dependency Dashboard issue for available updates

## Configuration

The `renovate.json` in the repository root configures:

| Feature | Setting |
|---------|---------|
| Schedule | Mondays before 6am UTC |
| GitHub Actions | Pinned to commit SHAs |
| npm minor/patch | Grouped in single PR |
| npm major | Separate PRs |
| Security patches | Auto-merge when CI passes |
| Lock file | Weekly maintenance |

## Key Behaviors

- **Pulumi packages** – Grouped, no auto-merge
- **TypeScript & types** – Grouped
- **Security updates** – High priority, auto-merge
- **Stability** – 3-day wait before suggesting new versions

## Resources

- [Renovate Docs](https://docs.renovatebot.com/)
- [Config Validator](https://app.renovatebot.com/config-validator)
