import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { RateLimitStore, shouldAbortForQuota } from '../../src/services/worker/RateLimitStore.js';

const FIXED_NOW = 1_700_000_000_000;

describe('CLAUDE_MEM_QUOTA_GUARD_OFF', () => {
  let saved: string | undefined;
  let store: RateLimitStore;

  beforeEach(() => {
    saved = process.env.CLAUDE_MEM_QUOTA_GUARD_OFF;
    store = new RateLimitStore();
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.CLAUDE_MEM_QUOTA_GUARD_OFF;
    else process.env.CLAUDE_MEM_QUOTA_GUARD_OFF = saved;
  });

  it('does not abort on utilization when set to 1', () => {
    process.env.CLAUDE_MEM_QUOTA_GUARD_OFF = '1';
    store.set({ rateLimitType: 'seven_day', utilization: 0.99, status: 'allowed_warning' });
    expect(shouldAbortForQuota('cli', store, FIXED_NOW).abort).toBe(false);
  });

  it('still aborts on a provider rejection when set to 1', () => {
    process.env.CLAUDE_MEM_QUOTA_GUARD_OFF = '1';
    store.set({ rateLimitType: 'five_hour', utilization: 0.5, status: 'rejected' });
    const decision = shouldAbortForQuota('cli', store, FIXED_NOW);
    expect(decision.abort).toBe(true);
    expect(decision.pause?.kind).toBe('quota_exhausted');
  });

  it('keeps upstream behavior when unset', () => {
    delete process.env.CLAUDE_MEM_QUOTA_GUARD_OFF;
    store.set({ rateLimitType: 'seven_day', utilization: 0.99, status: 'allowed_warning' });
    const decision = shouldAbortForQuota('cli', store, FIXED_NOW);
    expect(decision.abort).toBe(true);
    expect(decision.pause?.kind).toBe('quota_guard');
  });

  it('keeps upstream behavior for values other than 1', () => {
    process.env.CLAUDE_MEM_QUOTA_GUARD_OFF = '0';
    store.set({ rateLimitType: 'seven_day', utilization: 0.99, status: 'allowed_warning' });
    const decision = shouldAbortForQuota('cli', store, FIXED_NOW);
    expect(decision.abort).toBe(true);
    expect(decision.pause?.kind).toBe('quota_guard');
  });
});
