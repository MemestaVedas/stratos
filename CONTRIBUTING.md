# Contributing to Stratos

Thanks for contributing. This repository is built as a production-style portfolio project, so code quality and documentation quality are equally important.

## Development Workflow

1. Create a branch from `main`.
2. Keep changes small and focused.
3. Run checks locally before pushing.
4. Open a pull request with a clear summary.
5. Merge only after CI passes.

## Branch Naming

Use one of these patterns:

- `feat/<scope>-<short-topic>`
- `fix/<scope>-<short-topic>`
- `docs/<scope>-<short-topic>`
- `chore/<scope>-<short-topic>`

Examples:

- `feat/meridian-retry-policy`
- `docs/wiki-onboarding`

## Commit Format

Use Conventional Commits:

- `feat: add workflow retry backoff`
- `fix: enforce org scoping in account route`
- `docs: add architecture decision record template`
- `chore: add python CI pipeline`

## Pull Request Checklist

- [ ] Scope is small and cohesive
- [ ] Code follows existing patterns
- [ ] Tests added or updated when needed
- [ ] Docs updated for behavior changes
- [ ] No secrets or credentials committed
- [ ] CI is green

## Local Quality Gates

For Node.js services:

- `npm run build`
- `npm run lint --if-present`
- `npm run test --if-present -- --passWithNoTests`

For Python services:

- `pip install -r requirements.txt`
- `python -m py_compile main.py`

## Documentation Rules

Update docs when you:

- Add or change API endpoints
- Modify architecture or service boundaries
- Change setup steps
- Add operational requirements

## Security Reporting

Please do not open public issues for sensitive vulnerabilities. Follow `SECURITY.md`.
