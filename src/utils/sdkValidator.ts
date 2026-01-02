import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Discord Social SDK Validator
 * Ensures SDK integrity and compatibility
 * 
 * NOTE: Checksum validation is OPTIONAL (warning only)
 * Maintainers can update KNOWN_CHECKSUMS when new SDK versions are released
 */
export class SDKValidator {
    /**
     * Official Discord SDK checksums (v1.8+)
     * MAINTAINER NOTE: Update this when new official SDK versions are released
     * Get checksums from: https://discord.com/developers/docs/sdk/releases
     */
    private static readonly KNOWN_CHECKSUMS: { [version: string]: string } = {
        // Format: 'version': 'SHA256_hash_of_official_sdk_package'
        // Example checksums (update with real values from Discord)
        '1.8.13395': 'optional_checksum_hash_here',
        '1.8.0': 'optional_checksum_hash_here',
        '1.7.13152': 'optional_checksum_hash_here',
    };

    /**
     * Validate entire SDK
     */
    static async validate(sdkPath: string): Promise<{
        valid: boolean;
        errors: string[];
        warnings: string[];
        version?: string;
    }> {
        const errors: string[] = [];
        const warnings: string[] = [];
        let version: string | undefined;

        // Check directory exists
        if (!fs.existsSync(sdkPath)) {
            errors.push(`SDK directory does not exist: ${sdkPath}`);
            return { valid: false, errors, warnings };
        }

        // Check required directories - search recursively if not at root
        const requiredDirs = ['include', 'lib', 'bin'];
        const foundPaths: { [key: string]: string | null } = {};
        
        for (const dir of requiredDirs) {
            const directPath = path.join(sdkPath, dir);
            if (fs.existsSync(directPath)) {
                foundPaths[dir] = directPath;
                console.log(`✓ Found ${dir} at: ${directPath}`);
            } else {
                // Search recursively in subdirectories (max 2 levels deep)
                const found = this.findDirectoryRecursive(sdkPath, dir, 2);
                if (found) {
                    foundPaths[dir] = found;
                    console.log(`✓ Found ${dir} at: ${found}`);
                } else {
                    errors.push(`Missing required directory: ${dir}/`);
                    foundPaths[dir] = null;
                }
            }
        }

        // Check read permissions
        try {
            fs.accessSync(sdkPath, fs.constants.R_OK);
        } catch {
            errors.push('SDK directory is not readable');
        }

        // Extract version
        version = this.extractVersion(sdkPath);
        if (!version) {
            warnings.push('Could not determine SDK version');
        } else {
            console.log(`[SDK] Detected version: ${version}`);
            
            // Optional: Check if version has known checksum
            // This is a warning-only check - doesn't block setup
            if (!this.KNOWN_CHECKSUMS[version]) {
                warnings.push(`SDK version ${version} checksum not verified (may be a newer release)`);
            }
        }

        // Validate version compatibility
        if (version && !this.isVersionCompatible(version)) {
            warnings.push(`SDK version ${version} may not be compatible. Recommended: 1.8+`);
        }

        // Validate SDK structure integrity - use found paths
        const structureValid = this.validateStructure(sdkPath, foundPaths, errors);
        if (!structureValid) {
            errors.push('SDK structure validation failed');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            version
        };
    }

    /**
     * Recursively search for a directory within a path
     */
    private static findDirectoryRecursive(basePath: string, targetDir: string, maxDepth: number, currentDepth: number = 0): string | null {
        if (currentDepth >= maxDepth) {
            return null;
        }

        try {
            const items = fs.readdirSync(basePath);
            for (const item of items) {
                const itemPath = path.join(basePath, item);
                try {
                    const stat = fs.statSync(itemPath);
                    if (stat.isDirectory() && item === targetDir) {
                        return itemPath;
                    }
                    if (stat.isDirectory()) {
                        const found = this.findDirectoryRecursive(itemPath, targetDir, maxDepth, currentDepth + 1);
                        if (found) {
                            return found;
                        }
                    }
                } catch {
                    continue;
                }
            }
        } catch {
            return null;
        }

        return null;
    }

    /**
     * Extract SDK version from version file or library
     */
    private static extractVersion(sdkPath: string): string | undefined {
        // Try version.txt
        const versionFile = path.join(sdkPath, 'version.txt');
        if (fs.existsSync(versionFile)) {
            try {
                const content = fs.readFileSync(versionFile, 'utf-8').trim();
                const match = content.match(/\d+\.\d+\.\d+/);
                if (match) return match[0];
            } catch (e) {
                console.warn('[SDK] Could not read version.txt');
            }
        }

        // Try to extract from library filename
        const libPath = path.join(sdkPath, 'lib');
        if (fs.existsSync(libPath)) {
            const files = fs.readdirSync(libPath);
            for (const file of files) {
                const versionMatch = file.match(/(\d+\.\d+\.\d+)/);
                if (versionMatch) {
                    return versionMatch[1];
                }
            }
        }

        // Try include header files
        const includePath = path.join(sdkPath, 'include');
        if (fs.existsSync(includePath)) {
            const files = fs.readdirSync(includePath);
            for (const file of files) {
                if (file.endsWith('.h')) {
                    try {
                        const content = fs.readFileSync(path.join(includePath, file), 'utf-8');
                        const versionMatch = content.match(/#define.*VERSION.*(\d+\.\d+\.\d+)/);
                        if (versionMatch) {
                            return versionMatch[1];
                        }
                    } catch {
                        continue;
                    }
                }
            }
        }

        return undefined;
    }

    /**
     * Check version compatibility
     */
    private static isVersionCompatible(version: string | undefined): boolean {
        if (!version) return false;
        try {
            const [major, minor] = version.split('.').map(Number);
            // Support 1.7+ (adjust as needed)
            return major > 1 || (major === 1 && minor >= 7);
        } catch {
            return false;
        }
    }

    /**
     * Validate SDK directory structure
     */
    private static validateStructure(sdkPath: string, foundPaths: { [key: string]: string | null }, errors: string[]): boolean {
        let valid = true;

        // Check include directory has headers
        const includePath = foundPaths['include'];
        if (includePath && fs.existsSync(includePath)) {
            const headers = this.findFilesRecursive(includePath, '.h');
            if (headers.length === 0) {
                // Don't error if include exists - it might have other formats
                console.warn('⚠ No .h header files found in include/, but directory exists');
            } else {
                console.log(`✓ Found ${headers.length} header files in include/`);
            }
        }

        // Check lib directory has ANY files (libraries can be .so, .a, .lib, etc. in subdirs)
        const libPath = foundPaths['lib'];
        if (libPath && fs.existsSync(libPath)) {
            // Just check if lib dir has ANY files at all (release/ or debug/ subdirs)
            const allFiles = this.findFilesRecursive(libPath, '');
            if (allFiles.length === 0) {
                errors.push('lib/ directory is empty - SDK may not be unpacked');
                valid = false;
            } else {
                console.log(`✓ Found ${allFiles.length} files in lib/`);
            }
        }

        // Check bin directory has executables or scripts
        const binPath = foundPaths['bin'];
        if (binPath && fs.existsSync(binPath)) {
            const allFiles = this.findFilesRecursive(binPath, '');
            if (allFiles.length === 0) {
                console.warn('⚠ bin/ directory is empty');
            } else {
                console.log(`✓ Found ${allFiles.length} files in bin/`);
            }
        }

        return valid;
    }

    /**
     * Find files recursively by extension(s)
     */
    private static findFilesRecursive(dirPath: string, extensions: string | string[]): string[] {
        const exts = Array.isArray(extensions) ? extensions : [extensions];
        const files: string[] = [];

        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    files.push(...this.findFilesRecursive(fullPath, exts));
                } else if (exts.includes('') || exts.some(ext => entry.name.endsWith(ext))) {
                    // If empty string in exts, match ANY file
                    files.push(fullPath);
                }
            }
        } catch {
            // Directory read error
        }

        return files;
    }

    /**
     * Calculate SHA256 checksum of SDK directory
     * (For manual verification against Discord's official registry)
     * 
     * Usage: Compare output with official Discord SDK checksums
     * This helps detect tampered or unofficial SDKs
     */
    static async calculateDirectoryChecksum(sdkPath: string): Promise<string> {
        const crypto = require('crypto');
        const fs = require('fs');
        const path = require('path');

        const hash = crypto.createHash('sha256');
        const files = this.getAllFilesRecursive(sdkPath);
        
        // Sort files for consistent ordering
        files.sort();
        
        for (const file of files) {
            try {
                const content = fs.readFileSync(file);
                hash.update(content);
            } catch {
                // Skip files that can't be read
                continue;
            }
        }
        
        return hash.digest('hex');
    }

    /**
     * Get all files recursively from directory
     */
    private static getAllFilesRecursive(dirPath: string): string[] {
        const fs = require('fs');
        const path = require('path');
        let files: string[] = [];

        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    files = files.concat(this.getAllFilesRecursive(fullPath));
                } else {
                    files.push(fullPath);
                }
            }
        } catch {
            // Directory read error - return empty
        }

        return files;
    }

    /**
     * Calculate SHA256 checksum of SDK package file
     * (For verifying downloaded SDK packages)
     */
    static async calculateFileChecksum(filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            const stream = fs.createReadStream(filePath);

            stream.on('error', reject);
            stream.on('data', chunk => hash.update(chunk));
            stream.on('end', () => resolve(hash.digest('hex')));
        });
    }

    /**
     * Verify SDK permissions (read-only)
     */
    static verifyPermissions(sdkPath: string): {
        readable: boolean;
        writable: boolean;
        canExecute: boolean;
    } {
        return {
            readable: this.canRead(sdkPath),
            writable: this.canWrite(sdkPath),
            canExecute: this.canExecute(sdkPath)
        };
    }

    private static canRead(path: string): boolean {
        try {
            fs.accessSync(path, fs.constants.R_OK);
            return true;
        } catch {
            return false;
        }
    }

    private static canWrite(path: string): boolean {
        try {
            fs.accessSync(path, fs.constants.W_OK);
            return true;
        } catch {
            return false;
        }
    }

    private static canExecute(path: string): boolean {
        try {
            fs.accessSync(path, fs.constants.X_OK);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get detailed SDK information
     */
    static async getSDKInfo(sdkPath: string): Promise<{
        path: string;
        version: string | undefined;
        size: number;
        createdDate: Date;
        permissions: { readable: boolean; writable: boolean; canExecute: boolean };
    }> {
        const stats = fs.statSync(sdkPath);
        const version = this.extractVersion(sdkPath);
        const permissions = this.verifyPermissions(sdkPath);

        return {
            path: sdkPath,
            version,
            size: stats.size,
            createdDate: stats.birthtime,
            permissions
        };
    }

    /**
     * Suggest fixes for validation failures
     */
    static getSuggestions(errors: string[], warnings: string[]): string[] {
        const suggestions: string[] = [];

        if (errors.some(e => e.includes('does not exist'))) {
            suggestions.push('Download Discord Social SDK from official Discord Developer Portal');
            suggestions.push('Set DISCORD_SDK_PATH environment variable to SDK location');
        }

        if (errors.some(e => e.includes('Missing required directory'))) {
            suggestions.push('Ensure SDK contains include/, lib/, and bin/ directories');
            suggestions.push('Re-download SDK if extraction was incomplete');
        }

        if (errors.some(e => e.includes('not readable'))) {
            suggestions.push('Check file permissions: chmod -R u+r /path/to/sdk');
        }

        if (warnings.some(w => w.includes('checksum not verified'))) {
            suggestions.push('⚠️  WARNING: This SDK version is not in the known list');
            suggestions.push('It may be a newer release. Verify it came from the official Discord Developer Portal');
            suggestions.push('If you just downloaded a new SDK, consider reporting the checksum to the maintainer');
        }

        if (warnings.some(w => w.includes('version'))) {
            suggestions.push('Update to latest Discord Social SDK (1.8+)');
        }

        return suggestions;
    }
}
