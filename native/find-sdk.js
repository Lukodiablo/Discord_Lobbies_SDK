#!/usr/bin/env node

/**
 * Discord SDK Path Finder - ROBUST VERSION
 * Supports multiple fallback locations:
 * 1. DISCORD_SDK_PATH environment variable
 * 2. Project root directory (default)
 * 3. Common system locations
 * 4. User home directory
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function findDiscordSDK() {
    const searchLocations = [];
    
    // Priority 1: Environment variable
    if (process.env.DISCORD_SDK_PATH) {
        const envPath = process.env.DISCORD_SDK_PATH;
        if (fs.existsSync(envPath)) {
            const resolved = resolveSdkPath(envPath);
            if (resolved) {
                process.stdout.write(resolved);
                return;
            }
        }
        console.warn(`⚠️  DISCORD_SDK_PATH set but not found: ${envPath}`);
    }
    
    // Priority 2: Project root directory
    const parentDir = path.dirname(__dirname);
    searchLocations.push(parentDir);
    
    // Priority 3: Common system locations
    if (process.platform === 'linux') {
        searchLocations.push('/opt/discord-sdk');
        searchLocations.push('/usr/local/discord-sdk');
        searchLocations.push(path.join(os.homedir(), '.discord-sdk'));
    } else if (process.platform === 'win32') {
        searchLocations.push('C:\\Discord SDK');
        searchLocations.push('C:\\Program Files\\Discord SDK');
    } else if (process.platform === 'darwin') {
        searchLocations.push('/opt/discord-sdk');
        searchLocations.push(path.join(os.homedir(), '.discord-sdk'));
    }
    
    // Search through all locations
    for (const location of searchLocations) {
        if (!fs.existsSync(location)) continue;
        
        try {
            const entries = fs.readdirSync(location, { withFileTypes: true });
            const sdkDirs = [];
            
            for (const entry of entries) {
                if (!entry.isDirectory()) continue;
                
                const name = entry.name;
                const resolved = resolveSdkPath(path.join(location, name));
                
                if (resolved) {
                    const version = extractVersion(name);
                    sdkDirs.push({ version, path: resolved, name });
                }
            }
            
            if (sdkDirs.length > 0) {
                // Sort by version (descending) to use newest
                sdkDirs.sort((a, b) => b.version.localeCompare(a.version));
                const sdk = sdkDirs[0];
                process.stdout.write(sdk.path);
                return;
            }
        } catch (err) {
            // Continue to next location
        }
    }
    
    // Not found anywhere
    console.error('ERROR: Discord Social SDK not found!');
    console.error('');
    console.error('Searched locations:');
    for (const loc of searchLocations) {
        console.error(`  • ${loc}`);
    }
    console.error('');
    console.error('Solutions:');
    console.error('  1. Set DISCORD_SDK_PATH environment variable:');
    console.error('     export DISCORD_SDK_PATH=/path/to/discord_social_sdk');
    console.error('');
    console.error('  2. Place SDK in project root:');
    console.error(`     ${parentDir}`);
    console.error('');
    console.error('  Expected folder names:');
    console.error('     • discord_social_sdk');
    console.error('     • DiscordSocialSdk-1.8.13395');
    console.error('     • DiscordSocialSdk-X.Y.Z');
    console.error('');
    process.exit(1);
}

function resolveSdkPath(dirPath) {
    // Check if it's already a valid SDK directory
    if (isValidSdk(dirPath)) {
        return dirPath;
    }
    
    // Check if it contains a discord_social_sdk subdirectory
    const sdkSubdir = path.join(dirPath, 'discord_social_sdk');
    if (isValidSdk(sdkSubdir)) {
        return sdkSubdir;
    }
    
    return null;
}

function isValidSdk(dirPath) {
    // SDK must have include, lib/release, and bin/release directories
    try {
        if (!fs.existsSync(dirPath)) return false;
        if (!fs.existsSync(path.join(dirPath, 'include'))) return false;
        if (!fs.existsSync(path.join(dirPath, 'lib'))) return false;
        return true;
    } catch (err) {
        return false;
    }
}

function extractVersion(dirName) {
    // Extract version from DiscordSocialSdk-X.Y.Z
    const match = dirName.match(/DiscordSocialSdk-([\d.]+)/);
    if (match) return match[1];
    
    // discord_social_sdk gets high priority
    if (dirName === 'discord_social_sdk') return '999.999.999';
    
    return '0.0.0';
}

findDiscordSDK();


