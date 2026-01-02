import * as vscode from 'vscode';

/**
 * Diagnostics Output Panel
 * Logs setup progress, SDK status, OAuth flow
 * Visible in VS Code Output panel even in packed VSIX
 */
export class DiagnosticsPanel {
    private static instance: DiagnosticsPanel;
    private outputChannel: vscode.OutputChannel;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Discord Extension');
    }

    static getInstance(): DiagnosticsPanel {
        if (!DiagnosticsPanel.instance) {
            DiagnosticsPanel.instance = new DiagnosticsPanel();
        }
        return DiagnosticsPanel.instance;
    }

    /**
     * Log setup wizard progress
     */
    logSetupProgress(step: number, message: string): void {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] Setup Step ${step}: ${message}`);
    }

    /**
     * Log SDK detection and validation
     */
    logSDKStatus(sdkPath: string, valid: boolean, version?: string, errors?: string[]): void {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] 📦 SDK Status:`);
        this.outputChannel.appendLine(`  Path: ${sdkPath}`);
        this.outputChannel.appendLine(`  Valid: ${valid ? '✅ Yes' : '❌ No'}`);
        if (version) {
            this.outputChannel.appendLine(`  Version: ${version}`);
        }
        if (errors && errors.length > 0) {
            this.outputChannel.appendLine(`  Errors:`);
            errors.forEach(e => this.outputChannel.appendLine(`    - ${e}`));
        }
    }

    /**
     * Log Discord installation detection
     */
    logDiscordDetection(found: boolean, path?: string): void {
        const timestamp = new Date().toISOString();
        if (found) {
            this.outputChannel.appendLine(`[${timestamp}] ✅ Discord detected at: ${path}`);
        } else {
            this.outputChannel.appendLine(`[${timestamp}] ⚠️  Discord not detected`);
            this.outputChannel.appendLine(`  Make sure Discord is installed and running`);
        }
    }

    /**
     * Log OAuth flow events
     */
    logOAuthStatus(event: string, details?: string): void {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] 🔗 OAuth: ${event}`);
        if (details) {
            this.outputChannel.appendLine(`  ${details}`);
        }
    }

    /**
     * Log configuration saved
     */
    logConfigurationSaved(key: string, value: any): void {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] 💾 Configuration saved:`);
        this.outputChannel.appendLine(`  ${key} = ${typeof value === 'string' ? value : JSON.stringify(value)}`);
    }

    /**
     * Log extension activation
     */
    logActivation(message: string): void {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] 🎮 ${message}`);
    }

    /**
     * Log errors
     */
    logError(context: string, error: Error | string): void {
        const timestamp = new Date().toISOString();
        const errorMsg = error instanceof Error ? error.message : error;
        this.outputChannel.appendLine(`[${timestamp}] ❌ Error in ${context}:`);
        this.outputChannel.appendLine(`  ${errorMsg}`);
        if (error instanceof Error && error.stack) {
            this.outputChannel.appendLine(`  Stack: ${error.stack}`);
        }
    }

    /**
     * Log warnings
     */
    logWarning(context: string, message: string): void {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] ⚠️  Warning in ${context}:`);
        this.outputChannel.appendLine(`  ${message}`);
    }

    /**
     * Log info messages
     */
    logInfo(message: string): void {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] ℹ️  ${message}`);
    }

    /**
     * Show the output panel
     */
    show(): void {
        this.outputChannel.show();
    }

    /**
     * Hide the output panel
     */
    hide(): void {
        this.outputChannel.hide();
    }

    /**
     * Clear all output
     */
    clear(): void {
        this.outputChannel.clear();
    }

    /**
     * Log separator
     */
    separator(): void {
        this.outputChannel.appendLine('────────────────────────────────────────────────────────────');
    }

    /**
     * Log section header
     */
    section(title: string): void {
        this.separator();
        this.outputChannel.appendLine(`📌 ${title}`);
        this.separator();
    }

    /**
     * Log setup completion summary
     */
    logSetupComplete(): void {
        this.separator();
        this.outputChannel.appendLine('✅ Setup Complete!');
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine('Discord Extension is ready to use. Features:');
        this.outputChannel.appendLine('  💬 Real-time chat');
        this.outputChannel.appendLine('  🎤 Voice lobbies');
        this.outputChannel.appendLine('  📂 Code sharing');
        this.outputChannel.appendLine('  ⚡ Instant notifications');
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine('View logs here anytime: View → Output → Discord Extension');
        this.separator();
    }

    /**
     * Log setup failure with recovery suggestions
     */
    logSetupFailure(reason: string, suggestions: string[]): void {
        this.separator();
        this.outputChannel.appendLine('❌ Setup Failed');
        this.outputChannel.appendLine(`Reason: ${reason}`);
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine('Suggestions:');
        suggestions.forEach((s, i) => {
            this.outputChannel.appendLine(`  ${i + 1}. ${s}`);
        });
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine('For more help, visit: https://discord.com/developers');
        this.separator();
    }

    /**
     * Log environment info (for debugging)
     */
    logEnvironmentInfo(): void {
        this.section('Environment Info');
        this.outputChannel.appendLine(`OS: ${process.platform}`);
        this.outputChannel.appendLine(`Node: ${process.version}`);
        this.outputChannel.appendLine(`VS Code: ${vscode.version}`);
        this.outputChannel.appendLine(`SDK_PATH env: ${process.env.DISCORD_SDK_PATH || 'not set'}`);
        this.separator();
    }
}
