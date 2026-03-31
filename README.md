# Stratos

Stratos is a multi-product B2B SaaS platform built as a portfolio-grade engineering system for modern backend, frontend, and AI-adjacent workflows.

## Products

- **Meridian**: Multi-tenant AI workflow orchestration.
- **Vektor**: Semantic search and knowledge intelligence.
- **Aurum**: Revenue intelligence with predictive analytics.

## Why This Repository Exists

This repository is intentionally organized to demonstrate strong software engineering practices for the current job market:

- TypeScript + Python multi-service architecture
- Multi-tenant backend design patterns
- Next.js frontend applications
- Queue-based async processing
- Documentation-driven development
- CI-first delivery workflow

## Monorepo Layout

- `meridian/` - workflow engine product
- `vektor/` - semantic search product
- `aurum/` - revenue intelligence product
- `wiki/` - architecture, API, and development docs

## Prerequisites

- Node.js 20+
- Python 3.11+
- Docker Desktop
- npm 10+

## Quick Start

1. Install dependencies per service:
   - Run `npm install` in each Node.js service directory.
   - Run `pip install -r requirements.txt` in Python service directories.
2. Start infrastructure:
   - `docker-compose up -d`
3. Start all services:
   - `./start_all.ps1`

## Engineering Standards

- Open pull requests for all significant changes.
- Keep commits focused and small.
- Update docs whenever behavior changes.
- Prefer explicit types and stable interfaces.
- Add tests for service logic and API contracts.

See `CONTRIBUTING.md` for full details.

## Automation and Quality Gates

- GitHub Actions CI for Node and Python services
- CodeQL security analysis workflow
- Dependabot weekly dependency updates
- Local validation script: `./build_all.ps1`

## Documentation

- Platform wiki: `wiki/README.md`
- Shared architecture: `wiki/shared-architecture/SYSTEM_ARCHITECTURE.md`
- Getting started: `wiki/getting-started/SETUP.md`

## License

MIT License. See `LICENSE`.
