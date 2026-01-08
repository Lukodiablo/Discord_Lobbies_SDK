import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import { promisify } from 'util';

const exec = promisify(cp.exec);

export interface DiscordDetectionResult {
    isRunning: boolean;
    platform: string;
    processName?: string;
    installPath?: string;
    details: string;
}

export class DiscordDetector {
    /**
     * Detects if Discord is running on the current platform
     */
    static async isDiscordRunning(): Promise<DiscordDetectionResult> {
        const platform = os.platform();
        
        try {
            switch (platform) {
                case 'win32':
                    return await this.checkWindows();
                case 'darwin':
                    return await this.checkMacOS();
                case 'linux':
                    return await this.checkLinux();
                default:
                    return {
                        isRunning: false,
                        platform,
                        details: `Unsupported platform: ${platform}`
                    };
            }
        } catch (error) {
            return {
                isRunning: false,
                platform,
                details: `Error checking Discord: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Windows: Check for Discord processes
     * Handles: Discord App, Discord (stable/canary/ptb)
     */
    private static async checkWindows(): Promise<DiscordDetectionResult> {
        const discordProcesses = [
            'Discord.exe',
            'DiscordPTB.exe',
            'DiscordCanary.exe',
            'DiscordDevelopment.exe'
        ];

        try {
            // Use tasklist to get running processes
            const { stdout } = await exec('tasklist /v /fo csv', { encoding: 'utf8' });
            const lines = stdout.split('\n').map(line => line.toLowerCase());
            
            for (const processName of discordProcesses) {
                if (lines.some(line => line.includes(processName.toLowerCase()))) {
                    return {
                        isRunning: true,
                        platform: 'win32',
                        processName,
                        details: `Discord is running (${processName})`
                    };
                }
            }

            return {
                isRunning: false,
                platform: 'win32',
                details: 'Discord process not found in running processes'
            };
        } catch (error) {
            return {
                isRunning: false,
                platform: 'win32',
                details: `Failed to query processes: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * macOS: Check for Discord process and installation
     * Handles: Discord.app in Applications folder
     */
    private static async checkMacOS(): Promise<DiscordDetectionResult> {
        try {
            // Try using pgrep (more reliable on macOS)
            const processPatterns = [
                'Discord',
                'Discord Canary',
                'Discord PTB'
            ];

            for (const pattern of processPatterns) {
                try {
                    const { stdout } = await exec(`pgrep -i "${pattern}"`, { encoding: 'utf8' });
                    if (stdout.trim()) {
                        return {
                            isRunning: true,
                            platform: 'darwin',
                            processName: pattern,
                            details: `Discord is running (${pattern})`
                        };
                    }
                } catch {
                    // Process not found, continue
                }
            }

            // Also check if Discord.app exists in Applications (better UX)
            const appPath = '/Applications/Discord.app';
            if (fs.existsSync(appPath)) {
                return {
                    isRunning: false,
                    platform: 'darwin',
                    installPath: appPath,
                    details: 'Discord is installed but not currently running'
                };
            }

            return {
                isRunning: false,
                platform: 'darwin',
                details: 'Discord not found'
            };
        } catch (error) {
            return {
                isRunning: false,
                platform: 'darwin',
                details: `Error checking Discord: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Linux: Check for Discord processes across all installation methods
     * Handles: 
     * - Discord from official snap
     * - Discord from flatpak
     * - Discord from AppImage
     * - Discord from system packages (deb, rpm, etc.)
     * - Discord from source/custom installations
     */
    private static async checkLinux(): Promise<DiscordDetectionResult> {
        try {
            // Process patterns to search for across different Linux distributions
            const processPatterns = [
                // Standard Discord process names
                'Discord',
                'discord',
                // Snap-specific (adds snap name prefix)
                'snap.*discord',
                // Flatpak-specific (runs under bwrap container)
                'discord.*flatpak',
                // AppImage specific
                'AppRun.*discord',
                'discord.*appimage'
            ];

            // Try pgrep first (most efficient)
            for (const pattern of processPatterns) {
                try {
                    const { stdout } = await exec(`pgrep -i "${pattern}"`, { encoding: 'utf8' });
                    if (stdout.trim()) {
                        return {
                            isRunning: true,
                            platform: 'linux',
                            processName: pattern,
                            details: `Discord is running (matched: ${pattern})`
                        };
                    }
                } catch {
                    // Pattern didn't match, try next
                }
            }

            // Fallback: check ps aux for broader search
            try {
                const { stdout } = await exec('ps aux | grep -i discord | grep -v grep', { shell: '/bin/bash', encoding: 'utf8' });
                if (stdout.trim()) {
                    const processLine = stdout.trim().split('\n')[0];
                    return {
                        isRunning: true,
                        platform: 'linux',
                        processName: 'discord (via ps)',
                        details: `Discord is running`
                    };
                }
            } catch {
                // No processes found
            }

            // Check for common Discord installation paths
            const commonPaths = [
                path.join(os.homedir(), 'snap/discord/current'),
                path.join(os.homedir(), '.var/app/com.discordapp.Discord'),
                '/opt/Discord',
                path.join(os.homedir(), 'Applications/Discord')
            ];

            let installedPath: string | undefined;
            for (const checkPath of commonPaths) {
                if (fs.existsSync(checkPath)) {
                    installedPath = checkPath;
                    break;
                }
            }

            if (installedPath) {
                return {
                    isRunning: false,
                    platform: 'linux',
                    installPath: installedPath,
                    details: 'Discord is installed but not currently running'
                };
            }

            return {
                isRunning: false,
                platform: 'linux',
                details: 'Discord process not found (checked pgrep, ps aux, and common installation paths)'
            };
        } catch (error) {
            return {
                isRunning: false,
                platform: 'linux',
                details: `Error checking Discord: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
}
