#!/usr/bin/env node
/**
 * Run `bun test` with an isolated Bun runtime transpiler cache.
 *
 * Bun persists transpiled sources in a shared cache keyed by file content, and
 * a module that reads `process.env.CLAUDE_MEM_DATA_DIR` can be cached with the
 * value from a test run (oven-sh/bun#34210) -- the temp data dir then leaks into
 * every later real run. Every test run therefore gets a throw-away cache dir,
 * removed afterwards. Honours an explicit BUN_RUNTIME_TRANSPILER_CACHE_PATH
 * (including `0`, which disables the cache) and leaves it untouched.
 *
 * Usage: node scripts/bun-test.mjs <bun test args...>
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const env = { ...process.env };
let cacheDir = null;
if (!env.BUN_RUNTIME_TRANSPILER_CACHE_PATH) {
  cacheDir = mkdtempSync(join(tmpdir(), 'claude-mem-bun-cache-'));
  env.BUN_RUNTIME_TRANSPILER_CACHE_PATH = cacheDir;
}

const bun = process.env.BUN_BIN || 'bun';
const child = spawn(bun, ['test', ...process.argv.slice(2)], { stdio: 'inherit', env, shell: process.platform === 'win32' && bun === 'bun' });

function cleanup() {
  if (cacheDir) rmSync(cacheDir, { recursive: true, force: true });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', (error) => {
  cleanup();
  console.error(`bun-test: could not start ${bun}: ${error.message}`);
  process.exit(1);
});
child.on('exit', (code, signal) => {
  cleanup();
  process.exit(code ?? (signal ? 1 : 0));
});
