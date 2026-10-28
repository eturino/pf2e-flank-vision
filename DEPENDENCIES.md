# Dependency State

Last reviewed: 2026-10-28

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
| `vitest` | `^5.0.5` | Unit tests (`pnpm test`), no config file. |

## Major Upgrades Blocked

None.

## Open security advisories

None. Re-checked 2026-10-28 (`pnpm audit`: no known vulnerabilities).

## Active supply-chain exceptions

None.

## Last upgrade pass (2026-10-28)

Base `5ad1f8f` (`main`), gate 5 days, PR [#2](https://github.com/eturino/pf2e-flank-vision/pull/2).

**Upgraded**

| Package | From | To | Notes |
| ------- | ---- | -- | ----- |
| `@dfreds/foundry-types` | 14.366.1 | 14.369.1 | `~` range: matches the server's Foundry 14.369. |
| `esbuild` | 0.27.7 | 0.28.2 | `dist/flank-vision.js` rebuilt byte-identical. Clears GHSA-g7r4-m6w7-qqqr. |
| `vitest` | 4.1.10 | 4.1.12, then 5.0.5 | |
| `typescript` | 5.9.3 | 7.0.2 | |
| `handlebars` (nested) | 4.7.9 | 4.7.10 | New `overrides` entry in `pnpm-workspace.yaml`. |
| `vite` (nested) | 8.2.1 | 8.3.5 | Moved with a temporary override, removed again. |

**Majors landed**

- `vitest` v5: no code change; the BACKLOG item for it is deleted.
- `typescript` v7: no code change; a planted type error still fails `tsc`.

**Nested refresh:** `pnpm update` moved `engine.io` 6.6.9 -> 6.6.11, `qs` 6.15.3 -> 6.16.1, `source-map-js` 1.2.1 -> 1.2.2, `prosemirror-view` 1.42.2 -> 1.42.7, among others in range.

**Security:** 19 advisories (2 critical, 4 high) -> 0.

| From | To | Advisory |
| ---- | -- | -------- |
| `handlebars` 4.7.9 | 4.7.10 (override) | GHSA-8r5x-fm3f-whwj, GHSA-p8wg-vrv2-v86f, GHSA-xw65-4hp5-5hc7 |
| `vite` 8.2.1 | 8.3.5 | GHSA-587h-7wmj-h5pm, GHSA-698v-4r3x-3vcv, GHSA-r825-w8mm-5pxw, GHSA-rq7h-c2jc-7f22, GHSA-vfpm-58rq-9qcg, GHSA-9jrq-w75r-8gcw |
| `vitest`, `@vitest/mocker` 4.1.10 | 5.0.5 | GHSA-82fw-gwwq-j7x9, GHSA-qxg6-89mg-rqv8 |
| `engine.io` 6.6.9 | 6.6.11 | GHSA-2gc4-cqfq-p2gv |
| `prosemirror-view` 1.42.2 | 1.42.7 | GHSA-c8x8-7fp4-3x9w |
| `source-map-js` 1.2.1 | 1.2.2 | GHSA-68fv-2mgg-jv7q |
| `qs` 6.15.3 | 6.16.1 | GHSA-x5fp-wj9c-mxmx, GHSA-4mjr-xmp4-gh2g, GHSA-6pq8-jhm2-2vcw |
| `esbuild` 0.27.7 | 0.28.2 | GHSA-g7r4-m6w7-qqqr |

**Still outdated after this pass:** empty.

**GitHub Actions:** the workflows pin by tag (`actions/checkout@v6`, `pnpm/action-setup@v4`, `actions/setup-node@v6`, `softprops/action-gh-release@v2`), not by SHA, so there was nothing to repin.

**Tested:** `pnpm typecheck` green, `pnpm test` 36 passed / 4 files, `pnpm build` leaves `dist/` unchanged, `pnpm audit` no known vulnerabilities.

## Upgrade history

- **2026-10-28**: first pass: minor+patches + `vitest` v5 + `typescript` v7; 19 advisories cleared (`handlebars` override)

## Overrides

| Package | Pinned to | Why | Remove when |
| ------- | --------- | --- | ----------- |
| `handlebars` | 4.7.10 | `@dfreds/foundry-types` pins 4.7.9 exactly, which carries GHSA-8r5x-fm3f-whwj and GHSA-p8wg-vrv2-v86f (critical) and GHSA-xw65-4hp5-5hc7. Types only, never bundled. | A `@dfreds/foundry-types` release depends on `handlebars` >= 4.7.10. |
