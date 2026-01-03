/**
 * Discord Subprocess Client
 * 
 * Launches and communicates with the Rust Discord server via JSON over stdio.
 * No Node.js native modules, no FFI - just clean subprocess IPC!
 */

import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

interface DiscordRequest {
    id: number;
    command: string;
    args?: Record<string, any>;
}

interface DiscordResponse {
    id: number;
    success: boolean;
    result?: any;
    error?: string;
}

export class DiscordSubprocess extends EventEmitter {
    private process: ChildProcess | null = null;
    private requestId = 0;
    private pendingRequests = new Map<number, (resp: DiscordResponse) => void>();
    private binaryPath: string;
    private sdkPath: string | null;

    constructor(sdkPath?: string) {
        super();
        this.sdkPath = sdkPath || null;
        this.binaryPath = this.findBinary();
    }

    /**
     * Find the Rust binary by searching upward for rust-native folder
     * Works from any directory structure on any OS and architecture
     */
    private findBinary(): string {
        const isWindows = process.platform === 'win32';
        const binaryName = isWindows ? 'lobbies-sdk.exe' : 'lobbies-sdk';
        
        console.log(`[DiscordSubprocess] 🔍 Searching for Rust binary (${binaryName})...`);
        console.log(`[DiscordSubprocess] __dirname = ${__dirname}`);
        
        // Search upward from current directory to find rust-native
        let currentDir = __dirname;
        const maxDepth = 15; // Prevent infinite loops
        const possiblePaths: string[] = [];
        
        for (let i = 0; i < maxDepth; i++) {
            const rustNativeDir = path.join(currentDir, 'rust-native');
            
            // Try both release and debug builds
            const releaseBinary = path.join(rustNativeDir, 'target/release', binaryName);
            const debugBinary = path.join(rustNativeDir, 'target/debug', binaryName);
            
            possiblePaths.push(releaseBinary);
            possiblePaths.push(debugBinary);
            
            console.log(`[DiscordSubprocess] Checking level ${i}: ${releaseBinary}`);
            
            if (fs.existsSync(releaseBinary)) {
                console.log(`[DiscordSubprocess] ✅ Found binary at: ${releaseBinary}`);
                return releaseBinary;
            }
            
            if (fs.existsSync(debugBinary)) {
                console.log(`[DiscordSubprocess] ✅ Found binary at: ${debugBinary}`);
                return debugBinary;
            }
            
            // Move up one directory
            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir) {
                // Reached filesystem root
                console.log(`[DiscordSubprocess] Reached filesystem root`);
                break;
            }
            currentDir = parentDir;
        }

        // Add platform-specific system paths as fallback
        if (!isWindows) {
            // Linux/macOS system paths
            possiblePaths.push(path.join('/usr/local/bin', binaryName));
            possiblePaths.push(path.join('/usr/bin', binaryName));
        }

        console.error(`[DiscordSubprocess] ❌ Binary not found!`);
        console.error(`[DiscordSubprocess] Checked paths:`);
        possiblePaths.forEach(p => console.error(`  - ${p}`));
        throw new Error(
            `Discord subprocess binary not found (${binaryName}). ` +
            `Ensure rust-native is built with 'cd rust-native && cargo build --release'`
        );
    }

    /**
     * Find the Discord SDK library path (supports passed-in path, environment variable and multiple locations)
     */
    private findSDKPath(): string | null {
        // Priority 1: Passed-in SDK path from VS Code secrets
        if (this.sdkPath) {
            const resolvedPath = this.resolveSdkLibPath(this.sdkPath);
            if (resolvedPath) {
                console.log(`[DiscordSubprocess] Found SDK from stored path: ${this.sdkPath}`);
                return resolvedPath;
            }
            console.warn(`[DiscordSubprocess] Stored SDK path not valid: ${this.sdkPath}`);
        }
        
        // Priority 2: Environment variable (for backward compatibility)
        if (process.env.DISCORD_SDK_PATH) {
            const envPath = process.env.DISCORD_SDK_PATH;
            const resolvedPath = this.resolveSdkLibPath(envPath);
            if (resolvedPath) {
                console.log(`[DiscordSubprocess] Found SDK via DISCORD_SDK_PATH: ${envPath}`);
                return resolvedPath;
            }
            console.warn(`[DiscordSubprocess] DISCORD_SDK_PATH set but not valid: ${envPath}`);
        }
        
        const binaryDir = path.dirname(this.binaryPath);
        
        // Priority 2: Search upward from binary directory
        let currentDir = binaryDir;
        const maxDepth = 10; // Limit search to avoid infinite loops
        
        for (let i = 0; i < maxDepth; i++) {
            // Determine the correct SDK path based on OS and architecture
            let libSubPath = '';
            
            if (process.platform === 'win32') {
                // Windows: check architecture (x64, arm64, etc)
                libSubPath = `bin/release`;
                if (process.arch === 'arm64') {
                    // Try arm64 variant first if available
                    const sdkDirs = this.findDiscordSdkDirectories(currentDir);
                    for (const sdkDir of sdkDirs) {
                        const arm64Path = path.join(sdkDir, `discord_social_sdk/bin/release/arm64`);
                        if (fs.existsSync(arm64Path)) {
                            console.log(`[DiscordSubprocess] Found SDK at: ${arm64Path}`);
                            return arm64Path;
                        }
                    }
                }
                libSubPath = 'bin/release';
            } else {
                // Linux/macOS uses lib/release
                libSubPath = 'lib/release';
            }
            
            // Try to find any DiscordSocialSdk-* folder
            const sdkDirs = this.findDiscordSdkDirectories(currentDir);
            for (const sdkDir of sdkDirs) {
                const possibleSdkPath = path.join(sdkDir, `discord_social_sdk/${libSubPath}`);
                if (fs.existsSync(possibleSdkPath)) {
                    console.log(`[DiscordSubprocess] Found SDK at: ${possibleSdkPath}`);
                    return possibleSdkPath;
                }
                // Also try the direct path (for extracted zip structure)
                const directPath = path.join(sdkDir, libSubPath);
                if (fs.existsSync(directPath)) {
                    console.log(`[DiscordSubprocess] Found SDK at: ${directPath}`);
                    return directPath;
                }
            }
            
            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir) {
                // Reached filesystem root
                break;
            }
            currentDir = parentDir;
        }
        
        console.warn(`[DiscordSubprocess] SDK path not found`);
        console.warn(`[DiscordSubprocess] To specify SDK path, set DISCORD_SDK_PATH environment variable`);
        return null;
    }

    /**
     * Resolve SDK lib path from a given directory
     */
    private resolveSdkLibPath(dirPath: string): string | null {
        if (!fs.existsSync(dirPath)) {
            return null;
        }

        let libSubPath = '';
        if (process.platform === 'win32') {
            libSubPath = `bin/release`;
        } else {
            libSubPath = `lib/release`;
        }

        // Check if this is already a valid SDK directory
        const directPath = path.join(dirPath, libSubPath);
        if (fs.existsSync(directPath)) {
            return directPath;
        }

        // Check if it contains discord_social_sdk subdirectory
        const sdkPath = path.join(dirPath, 'discord_social_sdk', libSubPath);
        if (fs.existsSync(sdkPath)) {
            return sdkPath;
        }

        return null;
    }


    /**
     * Find all Discord SDK directories (any version)
     * Searches for directories matching pattern: DiscordSocialSdk-*
     */
    private findDiscordSdkDirectories(searchDir: string): string[] {
        const sdkDirs: string[] = [];
        try {
            const entries = fs.readdirSync(searchDir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory() && entry.name.startsWith('DiscordSocialSdk-')) {
                    sdkDirs.push(path.join(searchDir, entry.name));
                }
            }
            // Sort by version (descending) to prefer newer versions
            sdkDirs.sort((a, b) => {
                const aVersion = this.extractVersion(a);
                const bVersion = this.extractVersion(b);
                return bVersion.localeCompare(aVersion);
            });
        } catch (e) {
            // Directory doesn't exist or can't be read
        }
        return sdkDirs;
    }

    /**
     * Extract version number from SDK directory name
     */
    private extractVersion(dirPath: string): string {
        const match = dirPath.match(/DiscordSocialSdk-([\d.]+)/);
        return match ? match[1] : '0.0.0';
    }

    /**
     * Launch the subprocess
     */
    async start(): Promise<void> {
        // Kill any existing process and wait for it to exit
        if (this.process) {
            console.log('[DiscordSubprocess] Killing existing process...');
            try {
                this.process.kill('SIGTERM');
                // Wait for process to exit to ensure clean state
                await new Promise<void>((resolve) => {
                    const exitHandler = () => resolve();
                    this.process?.once('exit', exitHandler);
                    // Fallback timeout
                    setTimeout(() => {
                        this.process?.removeListener('exit', exitHandler);
                        resolve();
                    }, 1000);
                });
            } catch (e) {
                console.warn('[DiscordSubprocess] Error killing process:', e);
            }
            this.process = null;
            this.pendingRequests.clear();
        }

        return new Promise((resolve, reject) => {
            try {
                console.log(`[DiscordSubprocess] Starting: ${this.binaryPath}`);

                // Set up environment with Discord SDK library path
                const env = { ...process.env };
                
                const discordSdkLib = this.findSDKPath();
                
                if (discordSdkLib) {
                    if (process.platform === 'linux') {
                        env.LD_LIBRARY_PATH = `${discordSdkLib}:${env.LD_LIBRARY_PATH || ''}`;
                        console.log('[DiscordSubprocess] Linux LD_LIBRARY_PATH updated');
                    } else if (process.platform === 'win32') {
                        env.PATH = `${discordSdkLib};${env.PATH || ''}`;
                        console.log('[DiscordSubprocess] Windows PATH updated');
                    }
                } else {
                    console.warn('[DiscordSubprocess] Could not locate SDK - subprocess may fail if SDK is not in system PATH');
                }

                this.process = spawn(this.binaryPath, [], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    env: env,
                });
                
                // Prevent stdin from closing prematurely
                this.process.stdin!.on('error', (err) => {
                    console.error('[DiscordSubprocess] stdin error:', err);
                });
                
                let startupError = '';

                // Handle stdout (responses from Rust)
                this.process.stdout!.on('data', (data: Buffer) => {
                    const lines = data.toString().split('\n').filter(l => l.trim());
                    // Silently process without logging (too verbose)
                    for (const line of lines) {
                        try {
                            const resp = JSON.parse(line) as DiscordResponse;
                            const callback = this.pendingRequests.get(resp.id);
                            if (callback) {
                                this.pendingRequests.delete(resp.id);
                                callback(resp);
                            } else {
                                console.warn(`[DiscordSubprocess] No callback found for id=${resp.id}`);
                            }
                        } catch (e) {
                            console.error('[DiscordSubprocess] Parse error:', e, 'Line:', line);
                        }
                    }
                });

                // Handle stderr - capture all output for debugging
                this.process.stderr!.on('data', (data: Buffer) => {
                    const msg = data.toString();
                    startupError += msg; // Capture all stderr for error reporting
                    
                    // Filter out spam from polling commands (get_user_messages, get_message_events)
                    const pollingSpamPatterns = [
                        /Processing command: (get_user_messages|get_message_events)/,
                        /Getting user messages:/,
                        /GetUserMessages callback FIRED/,
                        /No messages in response/,
                        /Fetched \d+ messages/,
                        /Sending response:.*bytes/
                    ];
                    const isPollingSpam = pollingSpamPatterns.some(pattern => pattern.test(msg));
                    
                    // Only log non-spam stderr
                    if (!isPollingSpam) {
                        console.error('[DiscordSubprocess] stderr:', msg);
                    }
                    
                    // Capture OAuth token info for storage (new format with refresh token and type)
                    const oauthMatch = msg.match(/OAuth_TOKEN_FOR_STORAGE: access=(.+?),refresh=(.+?),expires=(\d+),type=(\d+)/);
                    if (oauthMatch) {
                        const accessToken = oauthMatch[1].trim();
                        const refreshToken = oauthMatch[2].trim();
                        const expiresIn = parseInt(oauthMatch[3]);
                        const tokenType = parseInt(oauthMatch[4]);
                        
                        // Emit token data object with token type
                        const tokenData = {
                            access_token: accessToken,
                            refresh_token: refreshToken === 'NONE' ? '' : refreshToken,
                            token_type: tokenType === 1 ? 'Bearer' : 'Unknown',
                            expires_in: expiresIn,
                            type_value: tokenType  // Store the numeric type value too
                        };
                        console.log('[DiscordSubprocess] Captured OAuth token for storage:', accessToken.substring(0, 20) + '...');
                        this.emit('sdk-token', tokenData);
                    }
                });

                // Handle exit
                this.process.on('exit', (code: number | null, signal: string | null) => {
                    console.warn(`[DiscordSubprocess] Exited with code: ${code}, signal: ${signal}`);
                    if (code !== 0 && code !== null) {
                        if (startupError) {
                            console.error('[DiscordSubprocess] Startup error:', startupError);
                        }
                        // Log hex code for Windows error codes
                        if (code > 0) {
                            const hexCode = '0x' + code.toString(16).toUpperCase().padStart(8, '0');
                            console.error(`[DiscordSubprocess] Exit code ${code} (${hexCode})`);
                        }
                    }
                    this.process = null;
                    this.emit('exit', code);
                });

                // Handle error
                this.process.on('error', (err: Error) => {
                    console.error('[DiscordSubprocess] Error:', err);
                    reject(err);
                });

                // Give it a moment to start
                setTimeout(() => {
                    console.log('[DiscordSubprocess] Started successfully');
                    resolve();
                }, 100);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Send a command and wait for response
     * 
     * Timeout: 60s for initialize (user approval), 20s for lobby creation, 15s for other commands
     */
    private async sendCommand(command: string, args?: Record<string, any>): Promise<DiscordResponse> {
        return new Promise((resolve, reject) => {
            if (!this.process) {
                reject(new Error('Subprocess not running'));
                return;
            }

            const id = ++this.requestId;
            const req: DiscordRequest = { id, command, args };

            // Short timeout for synchronous commands, longer for callback-based operations
            const syncCommands = ['get_lobby_ids', 'get_guild_channels', 'get_guilds', 'get_relationships', 'get_message'];
            const timeout = command === 'initialize' ? 60000 : command === 'create_lobby' ? 20000 : syncCommands.includes(command) ? 5000 : 15000;
            
            const timeoutId = setTimeout(() => {
                this.pendingRequests.delete(id);
                console.error(`[DiscordSubprocess] ⏱️ TIMEOUT after ${timeout}ms: ${command}`);
                reject(new Error(`Command timeout: ${command} (${timeout}ms)`));
            }, timeout);

            this.pendingRequests.set(id, (resp) => {
                clearTimeout(timeoutId);
                resolve(resp);
            });

            try {
                const jsonStr = JSON.stringify(req) + '\n';
                // Skip verbose logging for continuous polling commands
                const silentCommands = ['get_message_events', 'get_user_messages'];
                if (!silentCommands.includes(command)) {
                    console.log(`[DiscordSubprocess] Sending command: ${command} (id=${id}, timeout=${timeout}ms)`);
                }
                this.process.stdin!.write(jsonStr, (err) => {
                    if (err) {
                        console.error(`[DiscordSubprocess] Write error for ${command}:`, err);
                        this.pendingRequests.delete(id);
                        clearTimeout(timeoutId);
                        reject(err);
                    } else {
                        if (!silentCommands.includes(command)) {
                            console.log(`[DiscordSubprocess] Command ${command} written to stdin`);
                        }
                    }
                });
            } catch (error) {
                this.pendingRequests.delete(id);
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }

    /**
     * Execute a generic command
     */
    async executeCommand(command: string, args?: Record<string, any>): Promise<any> {
        try {
            const resp = await this.sendCommand(command, args);
            if (resp.success) {
                return resp.result;
            } else {
                throw new Error(resp.error || `Command failed: ${command}`);
            }
        } catch (error) {
            console.error(`[DiscordSubprocess] Command error (${command}):`, error);
            throw error;
        }
    }

    /**
     * Initialize Discord connection with app ID and token
     */
    async initialize(appId: string, token: string): Promise<boolean> {
        try {
            console.log('[DiscordSubprocess] Initializing with app_id:', appId, 'token_length:', token.length);
            const resp = await this.sendCommand('initialize', { 
                app_id: appId,
                token: token 
            });
            if (resp.success) {
                console.log('[DiscordSubprocess] Initialized successfully');
                return true;
            } else {
                console.error('[DiscordSubprocess] Init failed:', resp.error);
                return false;
            }
        } catch (error) {
            console.error('[DiscordSubprocess] Initialize error:', error);
            return false;
        }
    }

    /**
     * Get current user
     */
    async getCurrentUser(): Promise<{ user_id: string; username: string } | null> {
        try {
            const resp = await this.sendCommand('get_user');
            return resp.success && resp.result ? resp.result : null;
        } catch (error) {
            console.error('[DiscordSubprocess] Get user error:', error);
            return null;
        }
    }

    /**
     * Get channels
     */
    async getChannels(): Promise<Array<{ id: string; name: string }>> {
        try {
            const resp = await this.sendCommand('get_channels');
            return resp.success && resp.result?.channels ? resp.result.channels : [];
        } catch (error) {
            console.error('[DiscordSubprocess] Get channels error:', error);
            return [];
        }
    }

    /**
     * Send message
     */
    async sendMessage(channelId: string, content: string): Promise<boolean> {
        try {
            const resp = await this.sendCommand('send_message', { channel_id: channelId, content });
            return resp.success;
        } catch (error) {
            console.error('[DiscordSubprocess] Send message error:', error);
            return false;
        }
    }

    /**
     * Set activity
     */
    async setActivity(state: string, details: string, image: string): Promise<boolean> {
        try {
            const resp = await this.sendCommand('set_activity', { state, details, image });
            return resp.success;
        } catch (error) {
            console.error('[DiscordSubprocess] Set activity error:', error);
            return false;
        }
    }

    /**
     * Get messages from a lobby
     */
    async getLobbyMessages(lobbyId: string, limit: number = 50): Promise<any[]> {
        try {
            const resp = await this.sendCommand('get_lobby_messages', { 
                lobby_id: lobbyId,
                limit: limit
            });
            return resp.success && resp.result?.messages ? resp.result.messages : [];
        } catch (error) {
            console.error('[DiscordSubprocess] Get lobby messages error:', error);
            return [];
        }
    }

    /**
     * Get a specific message by ID
     */
    async getMessage(messageId: string): Promise<any | null> {
        try {
            const resp = await this.sendCommand('get_message', { 
                message_id: messageId
            });
            return resp.success ? resp.result : null;
        } catch (error) {
            console.error('[DiscordSubprocess] Get message error:', error);
            return null;
        }
    }

    /**
     * Get pending message events (real-time)
     */
    async getMessageEvents(): Promise<any[]> {
        try {
            const resp = await this.sendCommand('get_message_events', {});
            return resp.success ? (resp.result?.messages || []) : [];
        } catch (error) {
            console.error('[DiscordSubprocess] Get message events error:', error);
            return [];
        }
    }

    /**
     * Get messages from a specific user/recipient
     */
    async getUserMessages(recipientId: string, limit: number = 50): Promise<any[]> {
        try {
            const resp = await this.sendCommand('get_user_messages', {
                recipient_id: recipientId,
                limit: limit,
            });
            return resp.success ? (resp.result?.messages || []) : [];
        } catch (error) {
            console.error('[DiscordSubprocess] Get user messages error:', error);
            return [];
        }
    }

    /**
     * Disconnect
     */
    async disconnect(): Promise<void> {
        try {
            if (this.process && this.process.pid) {
                console.log('[DiscordSubprocess] Disconnecting - killing subprocess to reset SDK state...');
                this.process.kill('SIGTERM');
                // Wait for process to exit
                await new Promise<void>((resolve) => {
                    const exitHandler = () => resolve();
                    this.process?.once('exit', exitHandler);
                    setTimeout(() => {
                        this.process?.removeListener('exit', exitHandler);
                        resolve();
                    }, 500);
                });
            }
        } catch (error) {
            console.warn('[DiscordSubprocess] Error during disconnect:', error);
        }
        this.process = null;
        this.pendingRequests.clear();
    }
}

export default DiscordSubprocess;
