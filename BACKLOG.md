# Backlog

Actionable list of what is pending, most-likely-next first. Done items are
deleted, not archived - `git log` is the history.

## Toolchain upkeep (queued 2026-09-17 for 2026-09-18)

Three decisions queued together because they share the same supply-chain surface.
Cross-repo context and the full list of repos: `~/Obsidian/eturino-notes/10-Daily/2026/09-September/2026-09-18-Friday.md`.

- **vitest 4.0.18 -> 5.** A major, so read the migration notes before touching
  it.
- **`.snyk` policy file: decide whether to add one.** Today a scan re-reports the
  same accepted findings every time, so the acceptance lives in someone's memory
  rather than in the repo. A `.snyk` with `exclude` globs or reasoned `ignore`
  entries makes it explicit. For reference, appian-webapp's only excludes mocks
  and spec files, which would silence none of the findings we actually see.
- **CI-side release-age check: decide whether we need it at all, then build it or
  skip it.** The gate is enforced locally only, so CI would be the second line of defence.
  appian-webapp enforces the gate twice: `min-release-age` in `.npmrc` for local
  installs, plus `bin/check-lockfile-age.js` run by
  `.github/workflows/lockfile-age-checker.yml` and configured in
  `.lockfile-age.json`. The gap it closes is a lockfile entry added around the
  local gate, which still builds today.
