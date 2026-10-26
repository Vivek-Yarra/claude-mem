import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { proTrialLine } from '../../src/shared/pro-promo.js';
import { hasShownTeamBrainDiscoveryNotice } from '../../src/shared/teambrain.js';

describe('CLAUDE_MEM_HIDE_PROMOS', () => {
  let saved: string | undefined;
  let dataDir: string;

  beforeEach(() => {
    saved = process.env.CLAUDE_MEM_HIDE_PROMOS;
    dataDir = mkdtempSync(join(tmpdir(), 'hide-promos-'));
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.CLAUDE_MEM_HIDE_PROMOS;
    else process.env.CLAUDE_MEM_HIDE_PROMOS = saved;
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('hides the Pro trial line and suppresses the TeamBrain discovery line when set to 1', () => {
    process.env.CLAUDE_MEM_HIDE_PROMOS = '1';
    expect(proTrialLine('session-start')).toBe('');
    expect(proTrialLine('context-banner')).toBe('');
    // "already shown" => handler skips the line and never writes the marker
    expect(hasShownTeamBrainDiscoveryNotice(dataDir)).toBe(true);
  });

  it('keeps upstream behavior when unset', () => {
    delete process.env.CLAUDE_MEM_HIDE_PROMOS;
    expect(proTrialLine('session-start')).toContain('from=session-start');
    expect(hasShownTeamBrainDiscoveryNotice(dataDir)).toBe(false);
  });

  it('keeps upstream behavior for values other than 1', () => {
    process.env.CLAUDE_MEM_HIDE_PROMOS = '0';
    expect(proTrialLine('session-start')).not.toBe('');
    expect(hasShownTeamBrainDiscoveryNotice(dataDir)).toBe(false);
  });
});
