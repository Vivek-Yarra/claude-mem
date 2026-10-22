/**
 * Single source of truth for the Claude Code marketplace name this build is
 * installed under. Claude Code lays a plugin out as
 * `plugins/{cache,marketplaces}/<marketplace>/...` and keys `enabledPlugins`
 * as `<plugin>@<marketplace>`, so every resolver that builds such a path or key
 * must take the name from here.
 *
 * Legacy names are fallbacks only: they let a machine that still has the
 * upstream `thedotmack` install keep working until cutover, but they never
 * outrank the current name (and a legacy `enabledPlugins` flag never disables
 * the current install).
 */
export const PLUGIN_NAME = 'claude-mem';
export const MARKETPLACE_NAME = 'vivek-claude-mem';
export const LEGACY_MARKETPLACE_NAMES: readonly string[] = ['thedotmack'];

/** Current name first, then legacy names. */
export const ALL_MARKETPLACE_NAMES: readonly string[] = [MARKETPLACE_NAME, ...LEGACY_MARKETPLACE_NAMES];

/** `enabledPlugins` / `installed_plugins.json` key for the current install. */
export const PLUGIN_SETTINGS_KEY = `${PLUGIN_NAME}@${MARKETPLACE_NAME}`;
