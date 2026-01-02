/**
 * Native Addon Loader Utility
 * Handles robust loading of the Discord Social SDK native addon
 * with multiple fallback paths and error handling
 */

import * as path from 'path';
import * as fs from 'fs';

/**
 * Find and load the native Discord addon
 * Tries multiple locations with detailed logging
 */
export function loadNativeAddon(): any | null {
  const possiblePaths: Array<{ name: string; path: string }> = [];

  console.log('[Native Addon] 🔍 Starting addon load process...');
  console.log(`[Native Addon] __dirname = ${__dirname}`);

  // Strategy 1: Use __dirname relative path - from dist/extension.js go up to find native/
  try {
    // __dirname = /path/to/extension/dist
    // We need: /path/to/extension/native/build/Release/discord_social_sdk.node
    const relPath = path.join(__dirname, '..', 'native', 'build', 'Release', 'discord_social_sdk.node');
    possiblePaths.push({ name: 'Relative from __dirname (dist)', path: relPath });
  } catch (e) {
    // Continue
  }

  // Strategy 2: From extension directory (one level up from dist)
  try {
    const extensionDir = path.dirname(__dirname);
    const addonPath = path.join(extensionDir, 'native', 'build', 'Release', 'discord_social_sdk.node');
    possiblePaths.push({ name: 'Extension directory', path: addonPath });
  } catch (e) {
    // Continue
  }

  // Strategy 3: Use process.cwd() (works when running from extension root)
  try {
    const cwdPath = path.join(process.cwd(), 'native', 'build', 'Release', 'discord_social_sdk.node');
    possiblePaths.push({ name: 'From cwd', path: cwdPath });
  } catch (e) {
    // Continue
  }

  // Strategy 4: Development/source directory paths (no hardcoded user paths)
  // These are fallbacks if relative paths don't work
  try {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    if (homeDir) {
      const devPath = path.join(homeDir, 'lobbies-sdk/native/build/Release/discord_social_sdk.node');
      possiblePaths.push({
        name: 'User home directory',
        path: devPath
      });
    }
  } catch (e) {
    // Continue
  }

  console.log(`[Native Addon] Attempting to load from ${possiblePaths.length} possible locations...`);

  for (const { name, path: addonPath } of possiblePaths) {
    try {
      console.log(`  [Native Addon] Trying ${name}: ${addonPath}`);

      // Check if file exists
      if (!fs.existsSync(addonPath)) {
        console.log(`    └─ File not found`);
        continue;
      }

      console.log(`    └─ File found, attempting to require...`);

      // Try to load the module
      // Clear require cache to ensure fresh load
      delete require.cache[addonPath];

      const addon = require(addonPath);

      if (addon && addon.DiscordAddon) {
        console.log(`✓ [Native Addon] Successfully loaded from: ${name}`);
        console.log(`✓ [Native Addon] Path: ${addonPath}`);
        return addon;
      } else {
        console.log(`    └─ Module loaded but DiscordAddon not found`);
      }
    } catch (error: any) {
      console.log(`    └─ Error: ${error.message}`);
    }
  }

  console.warn(`✗ [Native Addon] Failed to load from any location`);
  console.warn(`✗ [Native Addon] Discord Social SDK will be unavailable`);
  console.warn(`✗ [Native Addon] Extension will fall back to HTTP API`);

  return null;
}

/**
 * Validate that the addon has the required methods
 */
export function validateAddon(addon: any): boolean {
  const requiredMethods = [
    'initialize',
    'getGuildChannels',
    'sendMessage',
    'getCurrentUser',
    'getGuilds',
    'joinVoiceChannel',
    'leaveVoiceChannel',
    'setActivityRichPresence',
    'disconnect'
  ];

  if (!addon || !addon.DiscordAddon) {
    console.warn('[Native Addon] DiscordAddon class not found');
    return false;
  }

  // Try to create a test instance
  try {
    const testInstance = new addon.DiscordAddon();

    for (const method of requiredMethods) {
      if (typeof testInstance[method] !== 'function') {
        console.warn(`[Native Addon] Missing method: ${method}`);
        return false;
      }
    }

    console.log(`✓ [Native Addon] All required methods present`);
    return true;
  } catch (error: any) {
    console.warn(`[Native Addon] Failed to validate: ${error.message}`);
    return false;
  }
}
