
import { relative, isAbsolute, join, normalize, dirname } from 'path';
import { isProjectExcluded } from '../utils/project-filter.js';
import { loadFromFileOnce } from './hook-settings.js';
import {
  CLAUDE_CONFIG_DIR,
  MARKETPLACE_ROOT,
  OBSERVER_SESSIONS_DIR,
  OBSERVER_SESSIONS_PROJECT,
} from './paths.js';
import { ALL_MARKETPLACE_NAMES, PLUGIN_NAME } from './marketplace.js';

const PLUGINS_DIR_NAME = 'plugins';
const PLUGIN_CACHE_DIR_NAME = 'cache';
const PLUGIN_RUNTIME_DIR_NAME = 'plugin';
// Plugin install dirs under every marketplace name (current and legacy): work
// done inside them is the plugin itself, never a user project.
const PLUGIN_CACHE_ROOTS = ALL_MARKETPLACE_NAMES.map(name =>
  join(CLAUDE_CONFIG_DIR, PLUGINS_DIR_NAME, PLUGIN_CACHE_DIR_NAME, name, PLUGIN_NAME),
);
const PLUGIN_MARKETPLACE_PLUGIN_ROOTS = ALL_MARKETPLACE_NAMES.map(name =>
  join(dirname(MARKETPLACE_ROOT), name, PLUGIN_RUNTIME_DIR_NAME),
);

function isWithin(child: string, parent: string): boolean {
  const normChild = normalize(child);
  const normParent = normalize(parent);
  if (normChild === normParent) return true;
  const rel = relative(normParent, normChild);
  return rel.length > 0 && !rel.startsWith('..') && !isAbsolute(rel);
}

export function shouldTrackProject(cwd: string): boolean {
  if (process.env.CLAUDE_MEM_INTERNAL === '1') return false;
  if (!cwd) return true;
  if (isWithin(cwd, OBSERVER_SESSIONS_DIR)) {
    return false;
  }
  if (PLUGIN_CACHE_ROOTS.some(root => isWithin(cwd, root)) || PLUGIN_MARKETPLACE_PLUGIN_ROOTS.some(root => isWithin(cwd, root))) {
    return false;
  }
  const settings = loadFromFileOnce();
  return !isProjectExcluded(cwd, settings.CLAUDE_MEM_EXCLUDED_PROJECTS);
}

export function shouldEmitProjectRow(project: string | null | undefined): boolean {
  if (!project) return true;
  return project !== OBSERVER_SESSIONS_PROJECT;
}
