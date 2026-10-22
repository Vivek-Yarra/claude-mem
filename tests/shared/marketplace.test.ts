import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ALL_MARKETPLACE_NAMES,
  LEGACY_MARKETPLACE_NAMES,
  MARKETPLACE_NAME,
  PLUGIN_SETTINGS_KEY,
} from '../../src/shared/marketplace.js';

const repoRoot = join(import.meta.dir, '..', '..');
const read = (relative: string) => readFileSync(join(repoRoot, relative), 'utf-8');

describe('marketplace name', () => {
  it('is vivek-claude-mem, keeps thedotmack only as a legacy fallback', () => {
    expect(MARKETPLACE_NAME).toBe('vivek-claude-mem');
    expect(LEGACY_MARKETPLACE_NAMES).toEqual(['thedotmack']);
    expect(ALL_MARKETPLACE_NAMES[0]).toBe(MARKETPLACE_NAME);
    expect(PLUGIN_SETTINGS_KEY).toBe('claude-mem@vivek-claude-mem');
  });

  it('matches .claude-plugin/marketplace.json (plugin name stays claude-mem)', () => {
    const marketplace = JSON.parse(read('.claude-plugin/marketplace.json'));
    expect(marketplace.name).toBe(MARKETPLACE_NAME);
    expect(marketplace.plugins.some((plugin: { name: string }) => plugin.name === 'claude-mem')).toBe(true);
  });

  it('matches the hand-written plugin scripts and dev scripts that cannot import it', () => {
    expect(read('plugin/scripts/bun-runner.js')).toContain(`'${PLUGIN_SETTINGS_KEY}'`);
    for (const script of ['scripts/sync-marketplace.cjs', 'scripts/restart-marketplace-worker.cjs']) {
      expect(read(script)).toContain(`const MARKETPLACE_NAME = '${MARKETPLACE_NAME}'`);
    }
  });
});
