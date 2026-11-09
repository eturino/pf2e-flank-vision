# Dependency State

Last reviewed: 2026-11-09

State file for the `upgrade-deps` skill (rules: `~/.agents/custom-skills/upgrade-deps/SKILL.md`).
Full per-pass detail lives in `git log -p DEPENDENCIES.md pnpm-lock.yaml`.

## House rules

- **Package manager:** pnpm 11.5.1, pinned in `mise.toml` and `packageManager`. **Runtime:** Node 24 (`mise.toml`, `engines`, CI `node-version: 24`). No direct `@types/node`.
- **Gate:** `pnpm-workspace.yaml` `minimumReleaseAge: 7200` (minutes, 5 days). `pnpm audit --fix update` adds `minimumReleaseAgeExclude` entries for patched versions inside the gate: that is a gate bypass, so revert it.
- **Green gate:** `pnpm typecheck && pnpm test && pnpm build`, then `git diff -- dist` must be empty or the rebuilt `dist/flank-vision.js` is committed with the bump (CI fails on a stale `dist/`). The media server loads `dist/` straight from git.
- **Foundry types follow the Foundry the module targets.** `@dfreds/foundry-types` is versioned to Foundry builds (`14.369.1` = Foundry 14 build 369). Never past the Foundry major in `module.json` `compatibility` (14), and never past the build the live server runs (`felddy/foundryvtt` tag in `foundry-vtt-data/docker-compose.yml`, 14.369 on 2026-10-28). Hence the `~` range: a new Foundry build needs the server upgraded first.
- **pnpm keeps locked transitive versions** even when a newer in-range one clears the gate: `pnpm update --depth Infinity <pkg>` reported "Already up to date" for `vite` 8.2.1 while 8.3.5 qualified. A temporary `overrides` entry, an install, then removing the override moves it.
- **Deploy:** nothing deploys on push or merge. A release is a `vX.Y.Z` tag (`README.md`, `.github/workflows/release.yml`).

## Why these packages are here

### `@dfreds/foundry-types`

The Foundry client and PF2e type definitions; see the House rule. It pins `handlebars` to exactly 4.7.9, which carries three advisories, hence the override below.

### Smaller additions

| Package | Range | Why |
| ------- | ----- | --- |
| `@dfreds/foundry-types` | `~14.369.1` | Foundry/PF2e types; see above. |
| `esbuild` | `^0.28.2` | Bundles `src/main.ts` into `dist/flank-vision.js`. |
| `typescript` | `^7.0.2` | `tsc --noEmit` typecheck only; esbuild does the emit. |
| `vitest` | `^5.1.0` | Unit tests (`pnpm test`), no config file. |

## Major Upgrades Blocked

None.

## Open security advisories

None. Re-checked 2026-11-09 (`pnpm audit`: no known vulnerabilities).

## Active supply-chain exceptions

None.

## Last upgrade pass (2026-11-09)

Base `c74f744` (`main`), gate 5 days, PR [#4](https://github.com/eturino/pf2e-flank-vision/pull/4).

**Upgraded**

| Package | From | To | Notes |
| ------- | ---- | -- | ----- |
| `vitest` | 5.0.5 | 5.1.0 | |

**Majors landed:** none.

**Skipped this round:** none.

**Nested refresh:** `pnpm update` no-op past `vitest`. **Security:** `pm audit-fix` exit 0, audit clean, no `minimumReleaseAgeExclude` entry added.

**Action pins:** the workflows still pin by tag (`@v6`, `@v4`, `@v2`), not by commit SHA, so step 8 had nothing to repin.

**Still outdated after this pass:** empty.

**LLM models:** none; the module calls no model.

**Tested:** `pnpm typecheck`, `pnpm test` (36/36 in 4 files) and `pnpm build` all exit 0; `git diff -- dist` empty after the build.

## Upgrade history

- **2026-11-09**: minor+patches (`vitest` 5.1)
- **2026-11-06**: lockfile refresh only (transitive, via `vite`)
- **2026-10-28**: first pass: minor+patches + `vitest` v5 + `typescript` v7; 19 advisories cleared (`handlebars` override)

## Overrides

| Package | Pinned to | Why | Remove when |
| ------- | --------- | --- | ----------- |
| `handlebars` | 4.7.10 | `@dfreds/foundry-types` pins 4.7.9 exactly, which carries GHSA-8r5x-fm3f-whwj and GHSA-p8wg-vrv2-v86f (critical) and GHSA-xw65-4hp5-5hc7. Types only, never bundled. | A `@dfreds/foundry-types` release depends on `handlebars` >= 4.7.10. |
