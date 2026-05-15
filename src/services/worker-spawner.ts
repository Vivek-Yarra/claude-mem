
import path from 'path';
import { existsSync, mkdirSync, writeFileSync, unlinkSync, statSync } from 'fs';
import { logger } from '../utils/logger.js';
import { HOOK_TIMEOUTS } from '../shared/hook-constants.js';
import { SettingsDefaultsManager } from '../shared/SettingsDefaultsManager.js';
import {
  cleanStalePidFile,
  getPlatformTimeout,
  spawnDaemon,
  touchPidFile,
} from './infrastructure/ProcessManager.js';
import {
  isPortInUse,
  waitForHealth,
  waitForReadiness,
} from './infrastructure/HealthMonitor.js';

const WINDOWS_SPAWN_COOLDOWN_MS = 2 * 60 * 1000;

function getWorkerSpawnLockPath(): string {
  return path.join(SettingsDefaultsManager.get('CLAUDE_MEM_DATA_DIR'), '.worker-start-attempted');
}

function shouldSkipSpawnOnWindows(): boolean {
  if (process.platform !== 'win32') return false;
  const lockPath = getWorkerSpawnLockPath();
  if (!existsSync(lockPath)) return false;
  try {
    const modifiedTimeMs = statSync(lockPath).mtimeMs;
    return Date.now() - modifiedTimeMs < WINDOWS_SPAWN_COOLDOWN_MS;
  } catch (error) {
    if (error instanceof Error) {
      logger.debug('SYSTEM', 'Could not stat worker spawn lock file', {}, error);
    } else {
      logger.debug('SYSTEM', 'Could not stat worker spawn lock file', { error: String(error) });
    }
    return false;
  }
}

function markWorkerSpawnAttempted(): void {
  if (process.platform !== 'win32') return;
  try {
    const lockPath = getWorkerSpawnLockPath();
    mkdirSync(path.dirname(lockPath), { recursive: true });
    writeFileSync(lockPath, '', 'utf-8');
  } catch {
    // APPROVED OVERRIDE: best-effort cooldown marker. If we can't even create
    // the data dir or write the marker, the worker spawn itself is almost
    // certainly going to fail too — surfacing that downstream gives the user
    // a far more useful error than a noisy log line about a lock file.
  }
}

function clearWorkerSpawnAttempted(): void {
  if (process.platform !== 'win32') return;
  try {
    const lockPath = getWorkerSpawnLockPath();
    if (existsSync(lockPath)) unlinkSync(lockPath);
  } catch {
    // APPROVED OVERRIDE: best-effort cleanup of the cooldown marker after a
    // successful spawn. A stale marker on disk is harmless — the worst case
    // is one suppressed retry within the cooldown window, then it self-heals.
  }
}

export type WorkerStartResult = 'ready' | 'warming' | 'dead';

export async function ensureWorkerStarted(
  port: number,
  workerScriptPath: string
): Promise<WorkerStartResult> {
  const t0 = Date.now();
  if (!workerScriptPath) {
    logger.error('SYSTEM', 'ensureWorkerStarted called with empty workerScriptPath — caller bug');
    return 'dead';
  }
  if (!existsSync(workerScriptPath)) {
    logger.error(
      'SYSTEM',
      'ensureWorkerStarted: worker script not found at expected path — likely a partial install or build artifact missing',
      { workerScriptPath }
    );
    return 'dead';
  }

  const pidFileStatus = cleanStalePidFile();
  logger.info('PERF', `cleanStalePidFile: ${Date.now() - t0}ms, status=${pidFileStatus}`);
  if (pidFileStatus === 'alive') {
    logger.info('SYSTEM', 'Worker PID file points to a live process, skipping duplicate spawn');
    const t1 = Date.now();
    const healthy = await waitForHealth(port, getPlatformTimeout(HOOK_TIMEOUTS.PORT_IN_USE_WAIT));
    logger.info('PERF', `waitForHealth(live PID): ${Date.now() - t1}ms, healthy=${healthy}`);
    if (healthy) {
      clearWorkerSpawnAttempted();
      const t2 = Date.now();
      const ready = await waitForReadiness(port, getPlatformTimeout(HOOK_TIMEOUTS.READINESS_WAIT));
      logger.info('PERF', `waitForReadiness(live PID): ${Date.now() - t2}ms, ready=${ready}, total=${Date.now() - t0}ms`);
      logger.info('SYSTEM', 'Worker became healthy while waiting on live PID');
      return ready ? 'ready' : 'warming';
    }
    logger.warn('SYSTEM', `Live PID detected but worker did not become healthy before timeout (${Date.now() - t0}ms) — likely still starting`);
    return 'warming';
  }

  const t3 = Date.now();
  if (await waitForHealth(port, 1000)) {
    logger.info('PERF', `waitForHealth(quick): ${Date.now() - t3}ms`);
    clearWorkerSpawnAttempted();
    const t4 = Date.now();
    const ready = await waitForReadiness(port, getPlatformTimeout(HOOK_TIMEOUTS.READINESS_WAIT));
    logger.info('PERF', `waitForReadiness(existing): ${Date.now() - t4}ms, ready=${ready}, total=${Date.now() - t0}ms`);
    if (!ready) {
      logger.warn('SYSTEM', 'Worker is alive but readiness timed out — proceeding anyway');
    }
    logger.info('SYSTEM', 'Worker already running and healthy');
    return ready ? 'ready' : 'warming';
  }
  logger.info('PERF', `waitForHealth(quick) failed: ${Date.now() - t3}ms`);

  const t5 = Date.now();
  const portInUse = await isPortInUse(port);
  logger.info('PERF', `isPortInUse: ${Date.now() - t5}ms, inUse=${portInUse}`);
  if (portInUse) {
    logger.info('SYSTEM', 'Port in use, waiting for worker to become healthy');
    const t6 = Date.now();
    const healthy = await waitForHealth(port, getPlatformTimeout(HOOK_TIMEOUTS.PORT_IN_USE_WAIT));
    logger.info('PERF', `waitForHealth(port in use): ${Date.now() - t6}ms, healthy=${healthy}`);
    if (healthy) {
      clearWorkerSpawnAttempted();
      const t7 = Date.now();
      const ready = await waitForReadiness(port, getPlatformTimeout(HOOK_TIMEOUTS.READINESS_WAIT));
      logger.info('PERF', `waitForReadiness(port in use): ${Date.now() - t7}ms, ready=${ready}, total=${Date.now() - t0}ms`);
      logger.info('SYSTEM', 'Worker is now healthy');
      return ready ? 'ready' : 'warming';
    }
    logger.error('SYSTEM', `Port in use but worker not responding (${Date.now() - t0}ms total)`);
    return 'dead';
  }

  if (shouldSkipSpawnOnWindows()) {
    logger.warn('SYSTEM', `Worker unavailable on Windows — skipping spawn (cooldown), total=${Date.now() - t0}ms`);
    return 'dead';
  }

  logger.info('SYSTEM', 'Starting worker daemon', { workerScriptPath });
  markWorkerSpawnAttempted();
  const t8 = Date.now();
  const pid = spawnDaemon(workerScriptPath, port);
  logger.info('PERF', `spawnDaemon: ${Date.now() - t8}ms, pid=${pid}`);
  if (pid === undefined) {
    logger.error('SYSTEM', 'Failed to spawn worker daemon');
    return 'dead';
  }

  const t9 = Date.now();
  const healthy = await waitForHealth(port, getPlatformTimeout(HOOK_TIMEOUTS.POST_SPAWN_WAIT));
  logger.info('PERF', `waitForHealth(post-spawn): ${Date.now() - t9}ms, healthy=${healthy}`);
  if (!healthy) {
    logger.warn('SYSTEM', `Worker spawned but health not responding (${Date.now() - t0}ms total) — likely still starting in background`);
    return 'warming';
  }

  const t10 = Date.now();
  const ready = await waitForReadiness(port, getPlatformTimeout(HOOK_TIMEOUTS.READINESS_WAIT));
  logger.info('PERF', `waitForReadiness(post-spawn): ${Date.now() - t10}ms, ready=${ready}, total=${Date.now() - t0}ms`);
  if (!ready) {
    logger.warn('SYSTEM', 'Worker is alive but readiness timed out — proceeding anyway');
  }

  clearWorkerSpawnAttempted();
  touchPidFile();
  logger.info('SYSTEM', `Worker started successfully (${Date.now() - t0}ms total)`);
  return ready ? 'ready' : 'warming';
}
