# claude-mem 15.0.1 pinned local build

Built 2026-10-22 on Windows 11 (Git Bash, node v24.14.0, bun 1.3.9).

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

## Cutover (do not run until the branch is pushed and reviewed)

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
Re-run the functional test on a DB copy (port 37799, Chroma disabled, fresh `BUN_RUNTIME_TRANSPILER_CACHE_PATH`). Drop patch 4 when upstream PR #4966 is in the new tag. Re-check that no upstream change adds new hard-coded `thedotmack` paths (`grep -rn thedotmack src`), and re-run the skill reference grep (a new hook or instruction may reference a trimmed skill).

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
