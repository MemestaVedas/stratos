# Stratos Development Workflow

This guide defines the minimum quality bar for day-to-day development.

## Branch Strategy

- Branch from `master` for each scoped change.
- Use short-lived branches named by intent:
  - `feat/<scope>-<topic>`
  - `fix/<scope>-<topic>`
  - `docs/<scope>-<topic>`
  - `chore/<scope>-<topic>`

## Commit Cadence

Commit regularly with focused scope:

- Commit after each meaningful milestone.
- Avoid mixing docs, refactors, and feature logic in one commit.
- Keep commit messages in Conventional Commit format.

Examples:

- `feat(meridian): add workflow replay endpoint`
- `fix(vektor): enforce workspace filter in search route`
- `docs(setup): add CI and validation workflow`
- `chore(repo): add typecheck scripts for all TS packages`

## Pull Request Rules

- Open a PR for every branch.
- Keep PRs reviewable in under 30 minutes.
- Include summary, risk notes, and verification steps.
- Merge only after CI passes.

## Local Validation Checklist

From repository root:

```powershell
./build_all.ps1
```

This script validates:

- Node dependency install
- `lint` when available
- `typecheck` when available
- `test` when available
- `build` when available
- Python dependency install and syntax checks

## Documentation Requirements

Update docs in the same branch whenever behavior changes:

- API changes: update product API docs in `wiki/<product>/API.md`
- Architecture changes: update `wiki/shared-architecture/`
- Setup changes: update `wiki/getting-started/SETUP.md`

## Release Hygiene

- Tag stable milestones.
- Keep changelog notes in PR descriptions.
- Track unresolved risks in issues, not in memory.
