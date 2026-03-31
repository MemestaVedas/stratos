# Security Policy

## Supported Versions

This is an actively developed portfolio repository. Security fixes are applied on the `main` branch.

## Reporting a Vulnerability

Please report security issues privately and include:

- Affected component and file path
- Reproduction steps
- Potential impact
- Suggested remediation (if known)

Do not include secrets in reports.

## Security Baseline

- Never commit `.env` files or credentials.
- Enforce org/tenant scoping in data access.
- Validate external input at API boundaries.
- Keep dependencies up to date.
- Prefer least-privilege credentials for local and cloud environments.
