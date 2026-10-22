# claude-mem 15.0.1 pinned local build

Built 2026-10-22 on Windows 11 (Git Bash, node v24.14.0, bun 1.3.9). `pinned-next` (below) was rebuilt the same day with bun 1.4.3.

- Upstream: https://github.com/thedotmack/claude-mem.git (remote `upstream`)
- Fork (distribution target): https://github.com/Vivek-Yarra/claude-mem.git (remote `fork`, not pushed yet)
- Base tag: `v15.0.1` = commit `0e7de4ee4671ff3e5c233b721904e9eac9d61792` ("chore: bump version to 15.0.1")
- Branch: `pinned` (created from the tag; `origin` removed)
- Marketplace name `vivek-claude-mem`, plugin name `claude-mem` -> install id `claude-mem@vivek-claude-mem`

## Patch series (one commit each, prefix `local:`)

1. `local: trim plugin skills ...` - plugin/skills keeps `mem-search`, `smart-explore`, `knowledge-agent`, `how-it-works`, `mode-creator`, `learn-codebase`.
   - `mode-creator` kept because `scripts/build-hooks.js` requires `plugin/skills/mode-creator/{SKILL.md,scripts/*}` in its distribution check (build fails without it).
   - `learn-codebase` kept because the installer outro text points users to `/learn-codebase` (instructions text).
   - `how-it-works` is also written by the build (onboarding-explainer.md) and referenced by `SearchRoutes.ts`; `mem-search` is referenced by the MCP tool descriptions, context formatters and `Server.ts` (`skills/mem-search` instructions dir); `smart-explore` by `file-context.ts` and build checks.
   - Removed (no code path references them; only other removed skills or tests/docs did): agent-cost-report, babysit, build, build-and-release, ccs-align (only the `CLAUDE_MEM_CCS_ALIGN_VIEWER_IDS` setting name matches; the skill dir is not read), childhood, cloud-sync, design-is, do, handoff, make-plan, oh-my-issues, pathfinder, release, screenpipe, standup, timeline-report, version-bump, weekly-digests, what-the, wowerpoint.
   - Tests that read removed skills were removed/adjusted: `tests/screenpipe-*.test.ts` deleted, cloud-sync skill assertion dropped from `tests/utils/skill-docs-placement.test.ts`, `tests/telemetry/skill-id.test.ts` pin relaxed to "every skill on disk is in the list" (`FIRST_PARTY_SKILL_IDS` in src untouched).
2. `local: run UserPromptSubmit session-init hook async` - `"async": true` in `plugin/hooks/hooks.json` and in the generator manifest in `scripts/build-hooks.js` (the build verifies hooks.json against that manifest). Verified in `src/cli/handlers/session-init.ts`: with `CLAUDE_MEM_SEMANTIC_INJECT` false/unset (default `'false'`) `additionalContext` stays `''` and the handler returns `{continue:true,suppressOutput:true}`, nothing injected. Trade-off: upstream test comment says sync keeps "prompt-row persistence ordered before downstream hooks"; with async a PostToolUse hook can in principle run before the prompt row exists. Tests updated accordingly. No change excludes subagent observations from session-start context.
3. `local: telemetry default OFF ...` - `src/services/telemetry/consent.ts`: final fallback of `explainTelemetryConsent` is now `{enabled:false, source:'default'}`. Precedence unchanged: `DO_NOT_TRACK` (off) > env `CLAUDE_MEM_TELEMETRY` (`1/true/on` enables, `0/false/off` disables) > `telemetry.json` `enabled` > default (now off). To opt in: `CLAUDE_MEM_TELEMETRY=1` or `enabled:true` in `<data dir>/telemetry.json`. All PostHog paths (telemetry.ts, cli-telemetry.ts, backfill.ts, work-state hooks) go through this function. `tests/telemetry/consent.test.ts` updated.
4. `local: bound Windows Bun discovery (upstream PR #4966 / issue #4934)` - `refs/pull/4966/head` fetched; commits `4025ee607` and `93be56cb8` cherry-picked cleanly (no conflicts) and squashed into one commit (Co-authored-by pei711). It adds `src/launcher/bun-runtime.ts`: known Bun paths (e.g. `~/.bun/bin`) are checked first, `where.exe` is only a fallback run asynchronously with a 1500 ms bound, then embedded Bun. Tests in `tests/launcher/bun-runtime.test.ts`.
5. `local: marketplace name vivek-claude-mem; ...` - `.claude-plugin/marketplace.json` name `thedotmack` -> `vivek-claude-mem`. Also: `src/launcher/claude-mem-launcher.ts` plugin-root fallback searches (`plugins/cache/vivek-claude-mem/claude-mem/<ver>` and `plugins/marketplaces/vivek-claude-mem/plugin`) after the existing `thedotmack` ones, and the "plugin disabled in Claude settings" check (`launcher`, `src/shared/plugin-state.ts`) also honours `enabledPlugins["claude-mem@vivek-claude-mem"] === false`. Without this, the launcher only found the plugin via `CLAUDE_PLUGIN_ROOT` (set inside hooks) and a terminal/MCP launch would not find it. `tests/marketplace-package-trim.test.ts` updated. The Setup hook shell template still scans `thedotmack` cache paths but uses `CLAUDE_PLUGIN_ROOT` first, so it works. The `claude-mem-cowork` entry in the marketplace is untouched.
6. `local: rebuild plugin artifacts for v15.0.1 + local patches` (last commit) - regenerated `plugin/scripts/*.cjs(.map)` via `npm run build`. Marketplace installs from git need no build.

Not changed: the Windows-only `thedotmack` strings in `mcp-server.ts` (a log-only marketplace-marker warning), `prune-cache.ts` and the npx installer.

## pinned-next (next version, branch `pinned-next` on top of `pinned` f830cccf8; not pushed)

Marketplace name `vivek-claude-mem` again, this time through one constant instead of a one-file patch. Supersedes patch 5 and the "keep thedotmack" revert (21a2cd990). One commit each, prefix `local:`, oldest first:

1. `marketplace name vivek-claude-mem via one constant (legacy thedotmack fallback)` - `src/shared/marketplace.ts` exports `MARKETPLACE_NAME='vivek-claude-mem'`, `LEGACY_MARKETPLACE_NAMES=['thedotmack']`, `PLUGIN_SETTINGS_KEY`. Used by `paths.ts` (MARKETPLACE_ROOT), `plugin-state.ts`, `worker-utils.ts`, the launcher, `mcp-server.ts`, `harness-worker.ts`, `hook-shell-template.ts` (+ regenerated `hooks.json`, `codex-hooks.json`, `.mcp.json`), npx-cli install/uninstall/paths/prune-cache, the integration installers, `should-track-project.ts` (plugin cache/marketplace dirs, both names), dev scripts, and the hand-written `plugin/scripts/bun-runner.js` (literal key, guarded by `tests/shared/marketplace.test.ts`). `.claude-plugin/marketplace.json` name is `vivek-claude-mem` (plugin name stays `claude-mem`).
   - Order everywhere: current cache, current marketplace dir, then each legacy name (cache, marketplace dir). Each cache is version-ranked on its own, so a legacy cache with a higher version never outranks the new one. `worker-utils.resolveWorkerScript` only considers legacy roots when nothing is installed under the new name.
   - `enabledPlugins`: only `claude-mem@vivek-claude-mem === false` disables; a legacy `claude-mem@thedotmack: false` is ignored. npx uninstall removes both names.
   - GitHub owner/repo URLs, the stars button and `relayed-text.ts` still point at thedotmack/claude-mem (upstream reference). `npx claude-mem install` still registers the marketplace source repo `thedotmack/claude-mem` (under the new name); use `claude plugin marketplace add Vivek-Yarra/claude-mem` instead.
   - Not renamed: `cowork/scripts/cmem-hook.mjs` and `openclaw/install.sh` (separate harnesses, still check `thedotmack`), Codex's own `claude-mem-local` marketplace.
2. `context-read worker gets DB path via workerData; resolveDataDir reads env by computed key` - defensive for Bun bug oven-sh/bun#34210 (the transpiler cache froze a temp `CLAUDE_MEM_DATA_DIR`). `ContextReadWorkerClient` passes `dbPath` in `workerData` (constructor option `{dbPath}` for tests), `context-read-worker.ts` uses it; `resolveDataDir()` reads `process.env[key]`. `ContextBuilder` (render path inside the thread) still uses the module-level `DB_PATH`, which is now derived from the dynamic read.
3. Upstream PRs, cherry-picked with their original authors (fetched from `refs/pull/N/head`):
   - `#4974` timeline CTE limit (supermario_leo): `dumb_search` timeline 198-245 ms -> 50-59 ms on the 24k-observation MetaBots project.
   - `#4971` context cache render order (Rudy Celekli).
   - `#4952` Chroma writer-lock statSync (keeponlight).
   - `#4944` `/api/mcp/toggle` cross-origin guard (DeryFerd).
   - `#4690` recover observations orphaned by a quota-cooldown restart (akushonkamen). The PR is the orphan-recovery scan, not a persisted RAM queue.
4. `orphan recovery pages past skipped sessions (PR #4690 review P1)` - the 5-session budget was applied in SQL before marker/live/echo-only sessions were excluded, so five such sessions starved every recoverable one. The budget now counts sessions actually re-fed (pages of 50, max 10 pages). New two-round regression test. The review's P2 (a completed batch whose rows were never linked can be re-fed once after its session leaves RAM) is NOT fixed: the cost is at most one extra provider run per session (one-shot marker). On this machine's DB the scan finds exactly 5 sessions / 25 rows (4 ctxprobe/ctxtest probes, 1 interior_design from 2026-10-08), so the first worker start re-feeds those 5 once. Seen in the functional test: when the observer cannot authenticate, the marker is still written and the buffered work is lost on the next restart (design trade-off of the PR).
5. `fix(shared): reap descendants on the Windows tree-kill path` - from ryanmcafee/claude-mem 038edada (author preserved). v15.0.1's `killProcessTree` on Windows was a bare `taskkill /T /F` that returned success on "already gone" without enumerating descendants, so a root that exits during the walk orphaned its children. It now snapshots descendants first, runs taskkill, reaps the union (PID-reuse checked), and throws taskkill failures only after the reap. +1 test in `tests/shared/kill-process-tree-cross-platform.test.ts`.
6. `isolate the Bun transpiler cache for test runs` - `npm test*` go through `scripts/bun-test.mjs` (fresh `BUN_RUNTIME_TRANSPILER_CACHE_PATH` per run, removed afterwards). `tests/preload.ts` exits with a message when the variable is unset (override `CLAUDE_MEM_ALLOW_SHARED_BUN_CACHE=1`, set in the CI workflows). A bare `bun test` therefore refuses to run; use `npm test` or set the variable yourself (`0` disables the cache).
7. `rebuild plugin artifacts` - `bun install` (no changes) + `npm run build` with bun 1.4.3.

### pinned-next test results
Isolated: scratch HOME/USERPROFILE/CLAUDE_CONFIG_DIR/CLAUDE_MEM_DATA_DIR/port, fresh transpiler cache and package cache per run.
- 4 groups (shared+launcher+misc / infrastructure / npx-cli+installers+memory+utils / context+worker/http+cli+supervisor+PR tests), 60 s per-test timeout, the same groups run on a `pinned` worktree:
  - pinned: 3,575 pass / 94 fail. pinned-next: 3,612 pass / 93 fail (+37 new tests). No failing test name on pinned-next that is not also failing on `pinned`; the one `pinned` failure that passes now is an `npm pack` timing test (`npm tarball includes generated runtime entries`, 5 s timeout, flaky under load).
  - The remaining ~93 failures are pre-existing Windows/environment failures (installer fixtures, `symlinkSync` EPERM, spawn-contract matrix, ChromaMcpManager singleton timeouts, ...). Not triaged individually.
- The first run caught a real bug in this series: the Codex Windows resolver embedded `"vivek-claude-mem"` with double quotes inside `node -e "..."`. Fixed (single quotes) in patch 1; `tests/infrastructure/hook-early-env-optout.test.ts` covers it.
- PR tests: #4974 `progressive-memory-search` (+2), #4971 `context-cache-render-order`, #4944 `mcp-toggle-origin-guard`, #4690 `quota-orphan-recovery` (+1 regression) all pass. #4952's test sits in `chroma-mcp-manager-singleton.test.ts`, whose 5 other tests time out identically on `pinned` (Windows); the new test passes.
- Some suites leave `worker-service.cjs --daemon` processes behind (4 after each sweep). Kill them by repo path, never the live worker under `~/.claude/plugins/cache`.

### pinned-next functional test
Copy of `backups\pre-15.0.1-local\claude-mem.db` + settings in a scratch data dir, port 37799, Chroma disabled.
- Observer cannot call a model: scratch HOME and CLAUDE_CONFIG_DIR, no API keys. (Setting `CLAUDE_MEM_PROVIDER=openrouter` with an empty key did not stop the Claude SDK from being used; the Claude CLI answered "Not logged in" and no observation was produced.)
- Migrations: schema 64 -> 67, no migration errors. Observations 70,612 before and after.
- `/api/context/inject` 200: laptop_lenovo 9,689 B, MetaBots 6,408 B, byte-identical to `pinned`'s output on the same DB apart from the timestamp. With a failing observer the output also carries a ~600 B "claude-mem can't save memories right now" banner and compacts the full-narrative rows. Cold first call 0.4 to 4 s (context-read worker start), cached 12-18 ms.
- Search: `/api/search?query=worker port` 200 (1,189 B, ids 28721-28723) -> `POST /api/observations/batch` 200, 3 rows.
- `POST /api/dumb-search` (timeline) on MetaBots, 5 runs: pinned 198-245 ms; pinned-next 50-59 ms.
- session-init hook (`claude-mem-launcher.cjs hook claude-code session-init`, 5 runs): 762, 1147, 1167, 1124, 892 ms wall, exit 0, stdout `{}` (the earlier pinned run was 654-982 ms; the machine was not idle either time).
- Orphan recovery (#4690): first start found 5 candidates and re-fed all 5; each failed with "SDK authentication failed"; marker file written.
- Rename resolution: scratch CLAUDE_CONFIG_DIR with `plugins/cache/vivek-claude-mem/claude-mem/15.0.1` (copy of the built plugin) and a decoy `plugins/cache/thedotmack/claude-mem/13.35.0`, repeated with a 99.0.0 decoy. `resolveWorkerScript`/`resolvePluginRoot`, the compiled launcher, the `.mcp.json` resolver and the Codex `commandWindows` resolver all pick the vivek-claude-mem tree. The Setup hook searches vivek cache, vivek marketplace, thedotmack cache, thedotmack marketplace in that order. `enabledPlugins {"claude-mem@thedotmack": false, "claude-mem@vivek-claude-mem": true}` keeps the new install enabled (launcher runs, `isPluginDisabledInClaudeSettings()` false); the new key `false` makes the launcher exit 0 silently.
- After the runs: all test processes stopped, live worker (15.0.1, 127.0.0.1:37782) healthy, `~/.bun/install/cache/@t@` listing unchanged.

### Remaining `thedotmack` strings after rebuild (`grep -rn thedotmack plugin/ src/`)
- Legacy fallback: `src/shared/marketplace.ts`, `CodexCliInstaller.ts` (legacy plugin id), `T3CodeInstaller.ts` (settings-arg regex), generated resolver strings in `plugin/hooks/*.json` and `plugin/.mcp.json`, and the bundled `LEGACY_MARKETPLACE_NAMES` in every `plugin/scripts/*.cjs` and `plugin/sqlite/*`.
- GitHub URLs / upstream reference: `thedotmack/claude-mem` links in sources and plugin manifests, `relayed-text.ts`, the `Header.tsx` stars button (`plugin/ui/viewer-bundle.js`).
- Comments: `worker-utils.ts`, `marketplace.ts`, `bun-runner.js` (legacy key note).

## Build

```
cd C:\workspace\claude-mem-pinned
bun install                 # 657 packages, ~100 s; 17 postinstalls blocked by bun (not needed for the build)
npm run build               # sync-plugin-manifests + build-hooks.js + gen-plugin-lockfile; ~15 s
```
Result: success. Hook generator verification passed. The plugin directory (`plugin/`) is self-contained: bundled scripts, hooks, skills, modes, UI; runtime deps (`plugin/package.json`: tree-sitter grammars etc.) are installed into `plugin/node_modules` by the Setup/`version-check` flow or `bun install` in `plugin/`. On first worker start the tree-sitter CLI is downloaded into the plugin dir.

## Test results

### Unit tests
- `bun test` in a single process does not finish: it stops producing output after `tests/utils/project-environments.test.ts` (log silent from 06:39, killed by `timeout 1700`, exit 124). So tests were run per top-level entry (4 parallel, isolated HOME / CLAUDE_CONFIG_DIR / data dir per entry, port 37798, 400 s cap each).
- Patched tree, per entry: 5,188 pass / 137 fail. `services/`, `shared/`, `worker/` hit the 400 s cap, so those were re-run per file (452 files, 90 s cap each): 3,854 pass / 194 fail (9 files time out, same 9 on the unpatched tag, e.g. `chroma-mcp-manager-singleton.test.ts`).
- Total approx 9,045 pass / 328 fail after test fixes below (about 9,042 / 331 before).
- Unpatched tag (git worktree of `v15.0.1`) on the same entries that had failures plus the split files: 123 failing in the per-entry run (its `infrastructure/` entry timed out at 400 s) and 198 failing in the split run.
- Failures caused by the patches (3), fixed by updating tests: `plugin-distribution` "#3303 ... UserPromptSubmit" expectation, `plugin-distribution` generator-parity for `UserPromptSubmit.0.0` (both are the async change), `marketplace-package-trim` expected name. After the fix only pre-existing failures remain in `plugin-distribution` (1, also fails on the tag; the tag additionally fails the "npm tarball includes generated runtime entries" test, which passes on the patched tree).
- One failure is environmental, not the patch: `transcripts/watcher-missing-file.test.ts` "relative glob" scans `cwd/../..`, which is `C:\` (EPERM) for a repo at `C:\workspace\claude-mem-pinned`; it passes when the repo is one level deeper (the tag worktree).
- All other failing tests fail identically on the tag. Typical causes: `symlinkSync` EPERM on Windows without developer mode, Windows path/process assumptions, 1 launcher test, 1 ProcessManager npm-global Bun test, `bounded-symbol-hints`, `Spawn-Contract ... CLAUDE_PLUGIN_ROOT` matrix test. I did not triage each of the ~330 pre-existing failures.
- The first, un-isolated `bun test` run (before I set HOME / data dir env) ran for about 10 minutes against the real home directory before I killed it. The live worker (13.35.0, 127.0.0.1:37782) stayed healthy afterwards, but I did not audit `~/.claude-mem` for side effects.

### Functional test on a copy of the data (port 37799, Chroma disabled)
Setup: copy of `backups\pre-13.41-2026-10-22\claude-mem.db` (613,638,144 bytes) + that backup's `settings.json` into `...\scratchpad\cm-test\`; `CLAUDE_MEM_DATA_DIR`, `CLAUDE_MEM_WORKER_PORT=37799`, `CLAUDE_MEM_CHROMA_ENABLED=false`, `CLAUDE_CONFIG_DIR` pointing at an empty test dir; for the hook timing run the observer provider was set to openrouter with an empty key so no model call is possible.
- Migrations: schema_versions max 64 -> 67; no migration errors in the log. Side effects: a `.bak-cwd-remap-*` copy and a `backups\claude-mem-pre-12.4.3-*` copy are created next to the DB (the one-time cwd remap and v12.4.3 cleanup run on this DB).
- Observation count: 69,926 before and after.
- `GET /api/context/inject?projects=laptop_lenovo`: HTTP 200, 9,783 bytes, 0.04 s (see the Bun cache issue below for the 500 case).
- Search path: `GET /api/search?query=worker%20port&limit=5` -> 200, 1,181 bytes; `POST /api/observations/batch {"ids":[28721,28722]}` -> 200, 3,082 bytes, returned both observations (28722 and 28721).
- session-init hook (`node plugin/scripts/claude-mem-launcher.cjs hook claude-code session-init`, CLAUDE_PLUGIN_ROOT set, stdin JSON): 5 runs, 654, 737, 982, 697, 687 ms wall (node start + bun spawn + HTTP), exit 0, stdout `{}` (nothing injected). 5 sessions and 5 prompts were written to the test DB copy. The compiled `claude-mem.exe` launcher was not timed.
- Cleanup: test worker stopped; no process with a pinned/test path or port 37797-37799 remained; live worker untouched.

### Bun transpiler cache problem (important)
On this machine, with the default Bun transpiler cache, the context-read worker thread (`plugin/scripts/context-read-worker.cjs`) failed with `SQLiteError: unable to open database file`, so `/api/context/inject` (the SessionStart context) returned HTTP 500. Reproduced on the unpatched tag too, so it is not caused by the patches. It was deterministic for the unmodified file (any edit to the file, even appending a debug string, or a CRLF copy, made it work). It disappears with `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0` or with a fresh cache dir (3 consecutive restarts OK). I could not locate the default cache directory, nor confirm where the bad entry came from (suspect: the killed, un-isolated first test run). All functional results above were taken with a fresh cache dir (`BUN_RUNTIME_TRANSPILER_CACHE_PATH`). After cutover, if SessionStart context is empty and the worker log shows `Context injection failed ... unable to open database file`, restart the worker with `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0` set, or locate and clear Bun's transpiler cache.

### Not verified
- Chroma (remote Docker) with v15; the live worker's observer / model calls; behaviour of the `claude-mem.exe` compiled launcher from this build; a real Claude Code session end to end; `claude plugin marketplace add Vivek-Yarra/claude-mem` (fork not pushed).

## Cutover for pinned-next (marketplace rename; do not run until reviewed)

Current live state: `claude-mem@thedotmack` 15.0.1 from the fork (`pinned`), worker on 127.0.0.1:37782 running from `~/.claude/plugins/cache/thedotmack/claude-mem/15.0.1`.

```
# 0. Stop the worker and take a fresh DB backup
claude-mem stop
mkdir C:\Users\ansiv\.claude-mem\backups\pre-pinned-next
copy C:\Users\ansiv\.claude-mem\claude-mem.db C:\Users\ansiv\.claude-mem\backups\pre-pinned-next\
copy C:\Users\ansiv\.claude-mem\settings.json C:\Users\ansiv\.claude-mem\backups\pre-pinned-next\

# 1. Publish the branch as `pinned` (fast-forward: fork/pinned f830cccf8 is an ancestor of pinned-next)
cd C:\workspace\claude-mem-pinned
git push fork pinned-next:pinned
git checkout pinned && git merge --ff-only pinned-next      # keep the local branch in step

# 2. Switch plugin and marketplace
claude plugin uninstall claude-mem@thedotmack
claude plugin marketplace remove thedotmack
claude plugin marketplace add Vivek-Yarra/claude-mem        # marketplace.json name = vivek-claude-mem
claude plugin install claude-mem@vivek-claude-mem

# 3. Settings keys
#    C:\workspace\hms\.claude\settings.json: "claude-mem@thedotmack" -> "claude-mem@vivek-claude-mem"
#    grep -r "claude-mem@thedotmack" C:\workspace\*\.claude   (fix any other project settings)
#    ~/.claude/settings.json env BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 can stay; remove it only after a restart shows /api/context/inject 200 without it.
```
Then start a new Claude Code session (SessionStart starts the worker) and check `curl http://127.0.0.1:37782/api/health`: `workerPath` should be under `plugins\cache\vivek-claude-mem\claude-mem\15.0.1`.

Notes:
- First start after cutover: the orphan-recovery scan (#4690) re-feeds 5 old sessions (25 rows) once through the observer, and `ensure-launcher` recompiles `claude-mem.exe` if stale.
- `uninstall` removes the `thedotmack` cache dir and the `enabledPlugins` key; the data dir (`~/.claude-mem`) is untouched.
- Rolling back the rename: `claude plugin uninstall claude-mem@vivek-claude-mem`, `claude plugin marketplace remove vivek-claude-mem`, push the previous head back (`git push fork f830cccf8:refs/heads/pinned --force-with-lease`), re-add `Vivek-Yarra/claude-mem` (it then registers as `thedotmack` again), install `claude-mem@thedotmack`, restore the hms settings key.
- Unverified until executed: `claude plugin marketplace add Vivek-Yarra/claude-mem` registering the name `vivek-claude-mem`, and Claude Code laying the cache out as `plugins/cache/vivek-claude-mem/claude-mem/<version>` (the resolvers assume this).

## Original cutover (superseded by the pinned-next cutover above; do not run until the branch is pushed and reviewed)

```
# 0. Fresh backup of the LIVE db (worker stopped) - the older backup is from 05:25 today
claude-mem stop            # or: bun C:\Users\ansiv\.claude\plugins\cache\thedotmack\claude-mem\13.35.0\scripts\worker-service.cjs stop
copy C:\Users\ansiv\.claude-mem\claude-mem.db C:\Users\ansiv\.claude-mem\backups\pre-15.0.1-local\claude-mem.db
copy C:\Users\ansiv\.claude-mem\settings.json C:\Users\ansiv\.claude-mem\backups\pre-15.0.1-local\settings.json

# 1. Publish the branch (orchestrator reviews first)
cd C:\workspace\claude-mem-pinned
git push fork pinned
#    then in GitHub: set the fork's default branch to `pinned` (old `main` with the 13.2-era custom commits stays untouched)

# 2. Switch plugin
claude plugin marketplace add Vivek-Yarra/claude-mem
claude plugin uninstall claude-mem@thedotmack
claude plugin install claude-mem@vivek-claude-mem
```
Then, in a new Claude Code session (SessionStart starts the worker). Check `curl http://127.0.0.1:37782/api/health` reports `15.0.1`.

Notes:
- `C:\workspace\hms\.claude\settings.json` has `"claude-mem@thedotmack": true` in `enabledPlugins` (project scope). Change it to `"claude-mem@vivek-claude-mem": true` (and check the other repos' `.claude/settings*.json`, e.g. `grep -r "claude-mem@thedotmack" C:\workspace\*\.claude`), otherwise that repo keeps asking for the removed plugin and the old key stays dangling. If the old key is ever `false`, the patched launcher/worker honours the new key as well.
- Launcher exe and PATH (Windows, 13.38+): hooks call `claude-mem` from PATH. The SessionStart `startup` hook `node ${CLAUDE_PLUGIN_ROOT}/scripts/ensure-launcher.cjs` compiles `claude-mem.exe` with `bun build --compile` into `%LOCALAPPDATA%\claude-mem\bin` when missing or stale and, via PowerShell, appends that directory to the persistent user PATH (new processes only; existing terminals and the running Claude Code do not see it until restarted). On first start after cutover that step runs (up to 180 s timeout) and the very first session may start without hooks on PATH. Pinned to this build, the exe resolves the plugin from `CLAUDE_PLUGIN_ROOT` or the `vivek-claude-mem` cache/marketplace paths added in patch 5.
- Telemetry is off by default; session-init is async; the trimmed skill set is what remains in the skill listing.
- Data dir: v15 migrates the live DB forward (schema 64 -> 67). Chroma remote settings are unchanged; Chroma was not exercised in testing.

## Upgrade procedure (new upstream release)

```
cd C:\workspace\claude-mem-pinned
git fetch upstream --tags
git checkout pinned
git rebase --onto v<NEW> v<OLD> pinned     # replays the local: commits onto the new tag; resolve conflicts (usually plugin/ artifacts)
```
Easiest: drop the last commit (`local: rebuild plugin artifacts ...`) first (`git reset --hard HEAD~1`), rebase the source patches, then
```
bun install && npm run build
bun test <entries>                         # per top-level entry, see Test results; compare against a worktree of the new tag
git add -A plugin && git commit -m "local: rebuild plugin artifacts for v<NEW> + local patches"
git push fork pinned --force-with-lease
```
Re-run the functional test on a DB copy (port 37799, Chroma disabled, fresh `BUN_RUNTIME_TRANSPILER_CACHE_PATH`). Drop patch 4 when upstream PR #4966 is in the new tag, and drop each pinned-next cherry-pick (#4974 #4971 #4952 #4944 #4690, the Windows tree-kill reaping) once it is in the new tag. Re-check that no upstream change adds new hard-coded `thedotmack` paths (`grep -rn thedotmack src`), and re-run the skill reference grep (a new hook or instruction may reference a trimmed skill).

## Rollback to 13.35.0

```
claude-mem stop                                  # stops the 15.x worker
claude plugin uninstall claude-mem@vivek-claude-mem
claude plugin marketplace remove vivek-claude-mem   # optional
claude plugin install claude-mem@thedotmack      # check the version is 13.35.0
```
- If the marketplace `thedotmack` now resolves to a newer version, the 13.35.0 cache dir `C:\Users\ansiv\.claude\plugins\cache\thedotmack\claude-mem\13.35.0` may still exist (not pruned until the cutover removes it); verify with `claude plugin list` before relying on it. Pinning a marketplace to a ref (`claude plugin marketplace add thedotmack/claude-mem#v13.35.0`) is unverified here.
- Database: stop the worker, then restore.
  - Preferred: the fresh pre-cutover copy `C:\Users\ansiv\.claude-mem\backups\pre-15.0.1-local\claude-mem.db` (no data loss).
  - Fallback: `C:\Users\ansiv\.claude-mem\backups\pre-13.41-2026-10-22\claude-mem.db` (13.35 consistent backup, 69,926 observations; loses everything captured after 05:25 on 2026-10-22).
  - `del claude-mem.db-wal claude-mem.db-shm` in `C:\Users\ansiv\.claude-mem`, copy the chosen backup over `claude-mem.db`, restore `settings.json` from the same backup folder, start Claude Code.
  - Also expect the 15.x one-time side copies in `C:\Users\ansiv\.claude-mem\backups` (`claude-mem-pre-12.4.3-*`) and `claude-mem.db.bak-cwd-remap-*`; they can stay.
- Restore the `enabledPlugins` key in `hms\.claude\settings.json` to `claude-mem@thedotmack`.
- PATH: the launcher directory `%LOCALAPPDATA%\claude-mem\bin` stays on the user PATH; 13.35 hooks use shell-form commands and do not need it. Remove the entry from the user PATH and delete `claude-mem.exe` only if you want a fully clean state.

## Cutover as executed (2026-10-22, historical: state before pinned-next)
- Marketplace rename to `vivek-claude-mem` was reverted (commit 21a2cd990): ~40 upstream code paths hard-code `plugins/{cache,marketplaces}/thedotmack`, so the MCP server kept auto-starting the old 13.35 worker. The fork keeps the name `thedotmack`; upstream's marketplace was removed and `Vivek-Yarra/claude-mem` (default branch `pinned`) was added in its place. Plugin id stays `claude-mem@thedotmack`; hms project settings unchanged.
- Old caches 13.33.0 / 13.35.0 moved to `~/.claude-mem/backups/old-plugin-cache-2026-10-22`.
- Fresh pre-cutover DB backup: `~/.claude-mem/backups/pre-15.0.1-local/` (70,612 observations).
- Bun transpiler-cache bug hit the live worker (`/api/context/inject` 500 "unable to open database file"). Fix: `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0` in `~/.claude/settings.json` env; worker restarted with it; inject returns 200 for all projects.
- Launcher `claude-mem.exe` at `%LOCALAPPDATA%\claude-mem\bin`, added to the user PATH; sessions/terminals started before the cutover do not see it until restarted.
