import * as vscode from 'vscode';
import { DiagnosticsPanel } from './diagnosticsPanel';

/**
 * Connection Tester
 * Validates that all Discord extension components are working
 */
export class ConnectionTester {
    private diagnostics = DiagnosticsPanel.getInstance();
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Run full end-to-end test
     */
    async runFullTest(): Promise<{
        success: boolean;
        sdk: boolean;
        vercel: boolean;
        results: string[];
    }> {
        const results: string[] = [];
        
        this.diagnostics.section('Starting End-to-End Connection Test');

        // Test 1: SDK configuration
        const sdkOk = await this.testSDKConfiguration();
        results.push(`SDK Configuration: ${sdkOk ? '✅' : '❌'}`);

        // Test 2: Vercel backend connectivity (handles OAuth)
        const vercelOk = await this.testVercelAPI();
        results.push(`Vercel Backend: ${vercelOk ? '✅' : '❌'}`);

        const success = sdkOk && vercelOk;

        this.diagnostics.logInfo(`Test Results: ${success ? 'All tests passed ✅' : 'Some tests failed ❌'}`);
        results.forEach(r => this.diagnostics.logInfo(r));
        this.diagnostics.separator();

        return {
            success,
            sdk: sdkOk,
            vercel: vercelOk,
            results
        };
    }

    /**
     * Test SDK configuration - reads from VS Code secrets like the extension does
     */
    private async testSDKConfiguration(): Promise<boolean> {
        try {
            // Read from secrets (same as wizard/extension) instead of env var
            const sdkPath = await this.context.secrets.get('discord-sdk-path');
            
            if (!sdkPath) {
                this.diagnostics.logWarning('SDK Test', 'SDK path not configured in extension settings');
                return false;
            }

            const { existsSync } = require('fs');
            if (!existsSync(sdkPath)) {
                this.diagnostics.logWarning('SDK Test', `SDK path does not exist: ${sdkPath}`);
                return false;
            }

            const requiredDirs = ['include', 'lib', 'bin'];
            for (const dir of requiredDirs) {
                const dirPath = `${sdkPath}/${dir}`;
                if (!existsSync(dirPath)) {
                    this.diagnostics.logWarning('SDK Test', `Missing directory: ${dir}`);
                    return false;
                }
            }

            this.diagnostics.logInfo(`SDK configured correctly at: ${sdkPath}`);
            return true;
        } catch (e) {
            this.diagnostics.logError('SDK Test', e instanceof Error ? e.message : String(e));
            return false;
        }
    }

    /**
     * Test Vercel backend connectivity (which handles OAuth)
     */
    private async testVercelAPI(): Promise<boolean> {
        try {
            const vercelUrl = process.env.VERCEL_BACKEND;
            
            if (!vercelUrl) {
                this.diagnostics.logWarning('Vercel Test', 'VERCEL_BACKEND not configured');
                return false;
            }

            const response = await fetch(`${vercelUrl}/config`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const config = await response.json() as any;
                if (config.applicationId && config.clientId && config.redirectUri) {
                    this.diagnostics.logInfo('Vercel backend responding with valid Discord config');
                    return true;
                } else {
                    this.diagnostics.logWarning('Vercel Test', 'Vercel config missing required fields');
                    return false;
                }
            } else {
                this.diagnostics.logWarning('Vercel Test', `Vercel API returned ${response.status}`);
                return false;
            }
        } catch (e) {
            this.diagnostics.logError('Vercel Test', e instanceof Error ? e.message : String(e));
            return false;
        }
    }

    /**
     * Get test report summary
     */
    async getTestReport(): Promise<string> {
        const test = await this.runFullTest();
        
        let report = '## Connection Test Report\n\n';
        report += `**Overall Status**: ${test.success ? '✅ PASS' : '❌ FAIL'}\n\n`;
        report += '### Test Results:\n';
        test.results.forEach(r => report += `- ${r}\n`);
        
        return report;
    }
}
