import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SDKValidator } from '../utils/sdkValidator';
import { DiagnosticsPanel } from '../utils/diagnosticsPanel';

export class SetupWizard {
    private panel: vscode.WebviewPanel | null = null;
    private context: vscode.ExtensionContext;
    private currentStep: number = 0;
    private diagnostics = DiagnosticsPanel.getInstance();

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    public async show(): Promise<void> {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.diagnostics.logSetupProgress(0, 'Setup Wizard launched');

        // Check if wizard was interrupted by auth reload
        const wizardStateStr = await this.context.secrets.get('discord-wizard-state');
        const wizardState = wizardStateStr ? JSON.parse(wizardStateStr) : null;
        const isResumingAfterAuth = wizardState?.pendingAuth === true;
        
        console.log(`🟡 [setupWizard.show()] wizardState: ${wizardState ? JSON.stringify(wizardState) : 'NOT FOUND'}`);
        console.log(`🟡 [setupWizard.show()] isResumingAfterAuth: ${isResumingAfterAuth}`);
        
        if (isResumingAfterAuth) {
            console.log('🟡 [setupWizard.show()] RESUMING after auth!');
            // CRITICAL: Restore to the saved step first
            this.currentStep = wizardState.currentStep || 3;
            console.log(`🟡 [setupWizard.show()] Restored currentStep from state: ${this.currentStep}`);
            
            this.diagnostics.logSetupProgress(0, 'Wizard resuming after auth...');
            // Wait for token to be stored asynchronously by SDK's token-received handler
            console.log('🟡 [setupWizard.show()] Waiting for token to be stored by SDK...');
            let tokenStr: string | undefined;
            for (let i = 0; i < 40; i++) { // Try for up to 4 seconds (40 * 100ms)
                await new Promise(resolve => setTimeout(resolve, 100));
                tokenStr = await this.context.secrets.get('discord-token');
                if (tokenStr) {
                    console.log(`🟡 [setupWizard.show()] Token found after ${i * 100 + 100}ms`);
                    break;
                }
            }
            
            console.log(`🟡 [setupWizard.show()] Token check: ${tokenStr ? 'FOUND' : 'NOT FOUND'}`);
            if (tokenStr) {
                console.log('🟡 [setupWizard.show()] Auth succeeded! Moving to Step 4');
                this.diagnostics.logSetupProgress(3, 'Auth succeeded! Token verified');
                // Move to Step 4 (verification) only if token is present
                this.currentStep = 4;
            } else {
                console.log('🟡 [setupWizard.show()] No token yet, staying on saved step: ' + this.currentStep);
                this.diagnostics.logSetupProgress(3, 'Auth may still be pending, staying on current step');
            }
        } else {
            console.log('🟡 [setupWizard.show()] NOT resuming - fresh wizard');
        }

        this.panel = vscode.window.createWebviewPanel(
            'discord.setup',
            'Discord Lobbies SDK',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.context.extensionUri, 'media')
                ]
            }
        );

        this.panel.webview.html = this.getWizardHTML();

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            message => this.handleMessage(message),
            undefined,
            this.context.subscriptions
        );

        // If resuming after auth, send the updated step to webview and verify
        if (isResumingAfterAuth) {
            console.log(`🟡 [setupWizard.show()] Sending update-step to webview, currentStep=${this.currentStep}`);
            this.diagnostics.logSetupProgress(this.currentStep, 'Sending update-step message to webview');
            this.panel.webview.postMessage({
                command: 'update-step',
                step: this.currentStep
            });
            console.log('🟡 [setupWizard.show()] update-step message posted, waiting 2 seconds for token to arrive');
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait longer for token to arrive
            console.log('🟡 [setupWizard.show()] Calling updateVerificationStatus()');
            await this.updateVerificationStatus();
            console.log('🟡 [setupWizard.show()] updateVerificationStatus() returned, clearing state');
            
            // Now clear the pending flag after everything is set up
            await this.context.secrets.delete('discord-wizard-state');
            console.log('🟡 [setupWizard.show()] State cleared, resumption complete');
        } else {
            console.log('🟡 [setupWizard.show()] isResumingAfterAuth=false, skipping restore logic');
        }

        this.panel.onDidDispose(() => {
            this.panel = null;
        });
    }

    private async handleMessage(message: any): Promise<void> {
        switch (message.command) {
            case 'next-step':
                await this.nextStep();
                break;
            case 'prev-step':
                await this.previousStep();
                break;
            case 'detect-discord':
                await this.detectDiscord();
                break;
            case 'browse-sdk':
                await this.browseSDK();
                break;
            case 'authorize-oauth':
                await this.authorizeOAuth();
                break;
            case 'verify-setup':
                await this.verifySetup();
                break;
            case 'setup-complete':
                await this.setupComplete();
                break;
            case 'run-cmd':
                await vscode.commands.executeCommand(message.cmd);
                break;
        }
    }

    private async setupComplete(): Promise<void> {
        // Setup is complete when token is stored in secrets - nothing to do here
        this.diagnostics.logSetupComplete();
        
        // Close wizard
        this.panel?.dispose();
        this.panel = null;
        
        // Show QuickAccessPanel as separate standalone panel
        const { QuickAccessPanel } = await import('./quickAccessPanel');
        const quickAccess = new QuickAccessPanel(this.context);
        await quickAccess.show();
    }

    private async nextStep(): Promise<void> {
        this.currentStep++;
        this.diagnostics.logSetupProgress(this.currentStep, `User moved to step ${this.currentStep}`);
        this.updateWizardUI();
    }

    private async previousStep(): Promise<void> {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.diagnostics.logSetupProgress(this.currentStep, `User went back to step ${this.currentStep}`);
            this.updateWizardUI();
        }
    }

    private async detectDiscord(): Promise<void> {
        // Don't auto-detect - just tell user to open Discord
        this.diagnostics.logSetupProgress(1, 'User instructed to open Discord desktop app');
        this.panel?.webview.postMessage({
            command: 'discord-status',
            status: 'waiting',
            message: 'Please open Discord desktop app, then click continue'
        });
    }

    private async browseSDK(): Promise<void> {
        this.diagnostics.logSetupProgress(2, 'Browse SDK button clicked');
        console.log(`🟡 [browseSDK] User browsing for SDK folder...`);
        
        const folders = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            title: 'Select Discord Social SDK folder (must contain include/, lib/, bin/ subdirectories)'
        });

        if (!folders || folders.length === 0) {
            console.log(`🟡 [browseSDK] User cancelled SDK selection`);
            this.diagnostics.logSetupProgress(2, 'User cancelled SDK selection');
            return;
        }
        
        const sdkPath = folders[0].fsPath;
        console.log(`🟡 [browseSDK] User selected: ${sdkPath}`);
        this.diagnostics.logSetupProgress(2, `User selected SDK path: ${sdkPath}`);
        
        // Validate the selected SDK
        console.log(`🟡 [browseSDK] Validating SDK at: ${sdkPath}`);
        const validation = await SDKValidator.validate(sdkPath);
        console.log(`🟡 [browseSDK] Validation result:`, validation);
        this.diagnostics.logSDKStatus(sdkPath, validation.valid, validation.version, validation.errors);
        
        if (validation.valid) {
            // Save SDK path to secrets (alongside token for persistence)
            this.diagnostics.logSetupProgress(2, 'SDK validated successfully, saving to secrets...');
            await this.context.secrets.store('discord-sdk-path', sdkPath);
            console.log(`🟡 [browseSDK] SDK path stored in secrets: ${sdkPath}`);
            
            // VERIFY it was actually saved
            const savedPath = await this.context.secrets.get('discord-sdk-path');
            if (savedPath === sdkPath) {
                this.diagnostics.logConfigurationSaved('discord-sdk-path', sdkPath);
                this.diagnostics.logSetupProgress(2, `✅ VERIFIED: SDK path saved and retrieved: ${savedPath}`);
            } else {
                this.diagnostics.logError('SDK Save', `Failed to verify! Expected: ${sdkPath}, Got: ${savedPath}`);
            }
            
            this.panel?.webview.postMessage({
                command: 'sdk-selected',
                path: sdkPath,
                valid: true,
                version: validation.version,
                message: `✅ SDK v${validation.version || 'unknown'} validated and saved`
            });
            
            // Update Step 5 verification status now that SDK is saved
            this.diagnostics.logSetupProgress(2, 'Triggering verification update after SDK save');
            await this.updateVerificationStatus();
        } else {
            // Show validation errors
            const errorMsg = validation.errors.join('\n');
            const suggestions = SDKValidator.getSuggestions(validation.errors, validation.warnings);
            console.log(`🟡 [browseSDK] VALIDATION FAILED for path: ${sdkPath}`);
            console.log(`🟡 [browseSDK] Errors:`, validation.errors);
            console.log(`🟡 [browseSDK] Warnings:`, validation.warnings);
            this.diagnostics.logWarning('SDK Validation', `Failed: ${errorMsg}`);
            
            this.panel?.webview.postMessage({
                command: 'sdk-selected',
                path: sdkPath,
                valid: false,
                errors: validation.errors,
                warnings: validation.warnings,
                suggestions: suggestions,
                message: `❌ SDK validation failed:\n${errorMsg}`
            });
        }
    }

    private async authorizeOAuth(): Promise<void> {
        this.diagnostics.logOAuthStatus('🟡 authorizeOAuth() CALLED');
        
        // Save wizard state before triggering auth (which causes reload)
        const stateToSave = {
            currentStep: this.currentStep,
            pendingAuth: true,
            timestamp: Date.now()
        };
        
        await this.context.secrets.store('discord-wizard-state', JSON.stringify(stateToSave));
        
        // Verify it was saved
        const verify = await this.context.secrets.get('discord-wizard-state');
        this.diagnostics.logOAuthStatus(`✅ STATE SAVED: ${JSON.stringify(stateToSave)}`);
        this.diagnostics.logOAuthStatus(`✅ STATE VERIFIED: ${verify ? 'YES' : 'NO'}`);
        
        this.panel?.webview.postMessage({
            command: 'oauth-status',
            status: 'Opening Discord for authorization...'
        });

        try {
            // Execute the official authenticate command which triggers SDK auth flow and reloads
            await vscode.commands.executeCommand('discord-vscode.authenticate');
            
            // If we get here, reload happened and wizard should be restored
        } catch (err) {
            this.diagnostics.logError('OAuth', err instanceof Error ? err.message : String(err));
            this.panel?.webview.postMessage({
                command: 'oauth-status',
                status: '❌ Authorization failed',
                error: 'Could not start authentication'
            });
        }
    }

    private async verifySetup(): Promise<void> {
        // This is called when user explicitly clicks on Step 5
        await this.updateVerificationStatus();
    }

    private async updateVerificationStatus(): Promise<void> {
        this.diagnostics.logSetupProgress(4, 'Starting verification check...');
        console.log('🟡 [updateVerificationStatus] Starting verification...');
        
        // Check SDK validity
        const sdkPath = await this.context.secrets.get('discord-sdk-path');
        let sdkValid = false;
        let sdkVersion = 'unknown';
        
        console.log(`🟡 [updateVerificationStatus] SDK path from secrets: ${sdkPath || 'NOT FOUND'}`);
        
        if (sdkPath) {
            // If SDK path is stored, it means it was validated when saved
            // No need to re-validate - just mark it as valid
            console.log(`✅ [updateVerificationStatus] SDK path found and was previously validated: ${sdkPath}`);
            sdkValid = true;
            sdkVersion = 'configured';
            this.diagnostics.logSetupProgress(4, `SDK Verification: VALID (previously configured at ${sdkPath})`);
        } else {
            console.log('🟡 [updateVerificationStatus] No SDK path found - user must configure it manually');
            this.diagnostics.logSetupProgress(4, 'SDK not configured - user will need to configure it manually');
        }
        
        // Check authentication - verify an actual token exists in secrets
        const authTokenStr = await this.context.secrets.get('discord-token');
        let authenticated = false;
        
        console.log(`🟡 [updateVerificationStatus] Auth token from secrets: ${authTokenStr ? 'FOUND' : 'NOT FOUND'}`);
        
        if (authTokenStr) {
            try {
                const token = JSON.parse(authTokenStr);
                authenticated = !!token.accessToken && token.accessToken.length > 0;
                console.log(`🟡 [updateVerificationStatus] Token parsed, accessToken length: ${token.accessToken?.length}`);
                this.diagnostics.logSetupProgress(4, `Auth Verification: TOKEN EXISTS (${token.accessToken.length} chars)`);
            } catch (e) {
                console.log(`🟡 [updateVerificationStatus] Token parse error:`, e);
                this.diagnostics.logSetupProgress(4, `Auth Verification: Invalid token format in secrets`);
            }
        } else {
            console.log('🟡 [updateVerificationStatus] No token found in secrets');
            this.diagnostics.logSetupProgress(4, 'No token found in secrets');
        }
        
        // Send verification results to webview
        const allValid = sdkValid && authenticated;
        console.log(`🟡 [updateVerificationStatus] Final result - SDK: ${sdkValid}, Auth: ${authenticated}, All Valid: ${allValid}`);
        this.diagnostics.logSetupProgress(4, `Verification complete - SDK: ${sdkValid}, Auth: ${authenticated}, All Valid: ${allValid}`);
        
        if (!this.panel) {
            this.diagnostics.logError('Verification', 'Webview panel is null - cannot send verify-complete message');
            return;
        }
        
        this.diagnostics.logSetupProgress(4, 'Sending verify-complete message to webview');
        this.panel.webview.postMessage({
            command: 'verify-complete',
            success: allValid,
            sdkVersion,
            details: {
                sdkFound: sdkValid,
                authenticated: authenticated
            }
        });
    }

    private async findDiscord(): Promise<boolean> {
        // Removed - user is responsible for opening Discord
        // Simplicity > auto-detection across different OS/arch
        return true;
    }

    private async validateSDK(sdkPath: string): Promise<boolean> {
        const validation = await SDKValidator.validate(sdkPath);
        return validation.valid;
    }

    private updateWizardUI(): void {
        this.panel?.webview.postMessage({
            command: 'update-step',
            step: this.currentStep,
            isLastStep: this.currentStep === 4
        });
    }

    private getWizardHTML(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Discord Lobbies SDK - Setup</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Courier New', monospace;
            background: #000000;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            overflow-y: auto;
            overflow-x: hidden;
            position: relative;
        }

        /* Scrollbar styling */
        body::-webkit-scrollbar {
            width: 12px;
        }

        body::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.5);
        }

        body::-webkit-scrollbar-thumb {
            background: #17028aff;
            border-radius: 6px;
            box-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
        }

        body::-webkit-scrollbar-thumb:hover {
            background: #00ffff;
            box-shadow: 0 0 15px rgba(0, 255, 255, 0.7);
        }

        /* Matrix Rain Background */
        #matrix-rain {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 0;
            opacity: 0.25;
            pointer-events: none;
        }

        .matrix-char {
            position: absolute;
            color: #00ff00;
            font-weight: bold;
            font-size: 20px;
            text-shadow: 0 0 10px #00ff00;
        }

        .container {
            width: 100%;
            max-width: 600px;
            background: rgba(13, 13, 23, 0.4);
            border-radius: 12px;
            border: 2px solid #00ff00;
            padding: 40px;
            box-shadow: 0 0 40px rgba(0, 255, 0, 0.3), inset 0 0 20px rgba(0, 255, 0, 0.05);
            position: relative;
            z-index: 100;
            animation: glowPulse 2s ease-in-out infinite;
        }

        @keyframes glowPulse {
            0%, 100% {
                box-shadow: 0 0 20px rgba(0, 255, 0, 0.3), inset 0 0 10px rgba(0, 255, 0, 0.05);
            }
            50% {
                box-shadow: 0 0 40px rgba(0, 255, 0, 0.5), inset 0 0 20px rgba(0, 255, 0, 0.1);
            }
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
        }

        .logo {
            width: 80px;
            height: 80px;
            margin: 0 auto 20px;
            background: radial-gradient(circle at 30% 30%, #002fffff, #0088ff);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
            position: relative;
            animation: portalFloat 3s ease-in-out infinite;
        }

        .logo::before {
            content: '';
            position: absolute;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            border: 2px solid #00ff00;
            animation: portalSpin 4s linear infinite;
            box-shadow: 0 0 30px rgba(0, 255, 0, 0.6);
        }

        .logo::after {
            content: '';
            position: absolute;
            width: 85%;
            height: 85%;
            border-radius: 50%;
            border: 1px solid #0088ff;
            animation: portalSpin 6s linear infinite reverse;
            box-shadow: inset 0 0 20px rgba(0, 136, 255, 0.3);
        }

        @keyframes portalFloat {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
        }

        @keyframes portalSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        h1 {
            font-size: 2em;
            color: #00ff00;
            margin-bottom: 10px;
            text-shadow: 0 0 20px rgba(0, 255, 0, 0.8), 0 0 40px rgba(0, 136, 255, 0.4);
            letter-spacing: 2px;
        }

        .subtitle {
            color: #00ff00;
            font-size: 1.1em;
            opacity: 0.8;
            text-shadow: 0 0 10px rgba(0, 255, 0, 0.6);
        }

        .steps {
            display: flex;
            justify-content: space-between;
            margin: 30px 0;
            padding: 0 10px;
        }

        .step-indicator {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.5);
            border: 2px solid #0088ff;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #0088ff;
            font-weight: bold;
            position: relative;
            transition: all 0.3s ease;
            box-shadow: 0 0 10px rgba(0, 136, 255, 0.3);
        }

        .step-indicator.active {
            background: rgba(0, 255, 0, 0.2);
            border-color: #00ff00;
            color: #00ff00;
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.8), inset 0 0 10px rgba(0, 255, 0, 0.3);
            animation: activePulse 1s ease-in-out infinite;
        }

        .step-indicator.completed {
            background: rgba(0, 255, 0, 0.3);
            border-color: #00ff00;
            color: #00ff00;
            box-shadow: 0 0 15px rgba(0, 255, 0, 0.6);
        }

        @keyframes activePulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }

        .step-line {
            flex: 1;
            height: 2px;
            background: #0088ff;
            margin-top: 19px;
            position: relative;
            box-shadow: 0 0 5px rgba(0, 136, 255, 0.4);
        }

        .step-line.completed {
            background: #00ff00;
            box-shadow: 0 0 10px rgba(0, 255, 0, 0.6);
        }

        .step-line.completed::after {
            content: '';
            position: absolute;
            height: 100%;
            background: #00ff00;
            width: 100%;
        }

        .content {
            min-height: 200px;
            margin: 30px 0;
        }

        .step {
            display: none;
            animation: fadeIn 0.3s ease-in;
        }

        .step.active {
            display: block;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .step h2 {
            color: #00ff00;
            margin-bottom: 20px;
            font-size: 1.5em;
            text-shadow: 0 0 15px rgba(0, 255, 0, 0.6);
        }

        .step p {
            color: #00ff00;
            margin-bottom: 15px;
            line-height: 1.6;
            opacity: 0.9;
        }

        .status {
            background: rgba(0, 255, 0, 0.05);
            border-left: 3px solid #00ff00;
            border: 2px solid #00ff00;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
            color: #00ff00;
            display: flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 0 15px rgba(0, 255, 0, 0.3), inset 0 0 10px rgba(0, 255, 0, 0.05);
            text-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
        }

        .status-icon {
            font-size: 1.5em;
            animation: iconGlow 1.5s ease-in-out infinite;
        }

        @keyframes iconGlow {
            0%, 100% { text-shadow: 0 0 10px rgba(0, 255, 0, 0.6); }
            50% { text-shadow: 0 0 20px rgba(0, 255, 0, 0.9); }
        }

        .button-group {
            display: flex;
            gap: 10px;
            justify-content: space-between;
            margin-top: 30px;
        }

        button {
            padding: 12px 24px;
            border: 2px solid #00ff00;
            border-radius: 6px;
            font-size: 1em;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .btn-secondary {
            background: rgba(0, 136, 255, 0.1);
            color: #0088ff;
            border-color: #0088ff;
            box-shadow: 0 0 10px rgba(0, 136, 255, 0.3);
        }

        .btn-secondary:hover {
            background: rgba(0, 136, 255, 0.2);
            color: #00ffff;
            border-color: #00ffff;
            box-shadow: 0 0 20px rgba(0, 255, 255, 0.5);
            text-shadow: 0 0 10px rgba(0, 255, 255, 0.7);
        }

        .btn-primary {
            background: rgba(0, 255, 0, 0.1);
            color: #00ff00;
            border-color: #00ff00;
            box-shadow: 0 0 15px rgba(0, 255, 0, 0.4);
        }

        .btn-primary:hover {
            background: rgba(0, 255, 0, 0.2);
            transform: translateY(-2px);
            box-shadow: 0 0 30px rgba(0, 255, 0, 0.7), 0 5px 15px rgba(0, 255, 0, 0.3);
            color: #00ff00;
            text-shadow: 0 0 10px rgba(0, 255, 0, 0.8);
        }

        .btn-primary:disabled {
            opacity: 0.3;
            cursor: not-allowed;
            box-shadow: 0 0 10px rgba(0, 255, 0, 0.1);
        }

        .progress {
            width: 100%;
            height: 4px;
            background: rgba(0, 136, 255, 0.2);
            border-radius: 2px;
            margin-top: 20px;
            overflow: hidden;
            box-shadow: 0 0 10px rgba(0, 136, 255, 0.3);
        }

        .progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #00ff00, #0088ff);
            width: 0%;
            transition: width 0.3s ease;
            box-shadow: 0 0 15px rgba(0, 255, 0, 0.8);
        }

        .details {
            background: rgba(0, 136, 255, 0.08);
            padding: 15px;
            border-radius: 6px;
            color: #00ff00;
            font-size: 0.9em;
            margin-top: 15px;
            border: 1px solid #0088ff;
            box-shadow: 0 0 10px rgba(0, 136, 255, 0.2);
        }

        .command-btn {
            background: rgba(0, 255, 0, 0.1);
            border: 2px solid #0088ff;
            color: #00ff00;
            padding: 12px;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 0.95em;
            font-weight: 500;
            box-shadow: 0 0 10px rgba(0, 136, 255, 0.3);
        }

        .command-btn:hover {
            background: rgba(0, 255, 0, 0.2);
            border-color: #00ff00;
            color: #00ff00;
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.6);
            text-shadow: 0 0 10px rgba(0, 255, 0, 0.7);
        }

        ul {
            color: #00ff00;
        }

        ul li {
            text-shadow: 0 0 5px rgba(0, 255, 0, 0.4);
        }

        a {
            color: #0088ff !important;
            text-shadow: 0 0 10px rgba(0, 136, 255, 0.6);
            border: 1px solid #0088ff !important;
            box-shadow: 0 0 10px rgba(0, 136, 255, 0.3) !important;
        }

        a:hover {
            color: #00ffff !important;
            text-shadow: 0 0 15px rgba(0, 255, 255, 0.8);
            box-shadow: 0 0 20px rgba(0, 255, 255, 0.5) !important;
            border-color: #00ffff !important;
        }
    </style>
</head>
<body>
    <canvas id="matrix-rain"></canvas>
    <div class="container">
        <div class="header">
            <div class="logo">🎮</div>
            <h1>Discord Lobbies SDK</h1>
            <div class="subtitle">Extension Setup Wizard</div>
        </div>

        <!-- Step Indicators -->
        <div class="steps">
            <div class="step-indicator active" data-step="0">1</div>
            <div class="step-line"></div>
            <div class="step-indicator" data-step="1">2</div>
            <div class="step-line"></div>
            <div class="step-indicator" data-step="2">3</div>
            <div class="step-line"></div>
            <div class="step-indicator" data-step="3">4</div>
            <div class="step-line"></div>
            <div class="step-indicator" data-step="4">✓</div>
        </div>

        <!-- Step Content -->
        <div class="content">
            <!-- Step 0: Welcome -->
            <div class="step active">
                <h2>Welcome! 👋</h2>
                <p>Let's set up your Discord integration in 5 simple steps.</p>
                <p>This one-time configuration will enable all Discord features in VS Code:</p>
                <ul style="color: #a0a0b0; margin: 20px 0 20px 20px;">
                    <li>💬 Real-time chat with teammates</li>
                    <li>🎤 Voice lobbies</li>
                    <li>📂 Code sharing</li>
                    <li>⚡ Instant notifications</li>
                </ul>
            </div>

            <!-- Step 1: Discord Check -->
            <div class="step">
                <h2>📱 Open Discord</h2>
                <p>We need your Discord desktop app running for authentication.</p>
                <div class="status">
                    <span class="status-icon">📌</span>
                    <span>Open Discord desktop app on your computer</span>
                </div>
                <div class="details">
                    Make sure Discord is fully loaded and you're logged in. Then click the button below to continue.
                </div>
                <button class="btn-primary" onclick="vscode.postMessage({command: 'next-step'})" style="width: 100%; margin-top: 20px;">
                    ✓ Discord is open
                </button>
            </div>

            <!-- Step 2: SDK Configuration -->
            <div class="step">
                <h2>Discord Social SDK</h2>
                <p>We need the official Discord Social SDK to enable advanced features.</p>
                <div class="status">
                    <span class="status-icon">📥</span>
                    <span>Download or select your SDK</span>
                </div>
                <div style="display: grid; gap: 10px; margin-top: 20px;">
                    <button class="btn-primary" onclick="vscode.postMessage({command: 'browse-sdk'})">
                        📂 Browse SDK Location
                    </button>
                    <a href="https://discord.com/developers" style="text-align: center; color: #00ff00; text-decoration: none; padding: 12px; border: 2px solid #00ff00; border-radius: 6px; box-shadow: 0 0 10px rgba(0, 255, 0, 0.3);">
                        📥 Download Official SDK
                    </a>
                </div>
                <div class="details" style="margin-top: 20px; background: rgba(0, 136, 255, 0.08); border: 1px solid #0088ff;">
                    <strong>📋 SDK Instructions:</strong><br>
                    1. Download the Discord Social SDK from the link above<br>
                    2. Extract/Unpack the ZIP file<br>
                    3. Click "Browse SDK Location" and select the unpacked folder<br>
                    The folder should contain: include/, lib/, and bin/ directories
                </div>
            </div>

            <!-- Step 3: OAuth Setup -->
            <div class="step">
                <h2>Discord Authorization</h2>
                <p>Connect your Discord account to enable features.</p>
                <div class="status">
                    <span class="status-icon">🔗</span>
                    <span>Ready to authorize</span>
                </div>
                <button class="btn-primary" onclick="vscode.postMessage({command: 'authorize-oauth'})" style="width: 100%; margin-top: 20px;">
                    🔗 Connect Discord Account
                </button>
                <div class="details" style="margin-top: 20px;">
                    ⚠️ Make sure Discord app is running before clicking connect.
                </div>
            </div>

            <!-- Step 5: Verify & Congrats -->
            <div class="step">
                <h2>✅ Verify & Congrats</h2>
                <p>Let's verify everything is set up correctly:</p>
                <div style="margin-top: 20px;">
                    <div class="status" id="verify-sdk">
                        <span class="status-icon">⏳</span>
                        <span>Checking SDK...</span>
                    </div>
                    <div class="status" id="verify-auth">
                        <span class="status-icon">⏳</span>
                        <span>Checking Authentication...</span>
                    </div>
                </div>
                <div class="details" style="margin-top: 20px;">
                    <strong>🎉 Setup Complete!</strong><br>
                    Your Discord extension is ready to use. You can now access all Discord commands from the Quick Access panel or command palette.
                </div>
            </div>
        </div>

        <!-- Progress Bar -->
        <div class="progress">
            <div class="progress-bar" id="progress-bar"></div>
        </div>

        <!-- Buttons -->
        <div class="button-group">
            <button class="btn-secondary" id="btn-prev" onclick="vscode.postMessage({command: 'prev-step'})">← Back</button>
            <button class="btn-primary" id="btn-next" onclick="vscode.postMessage({command: 'next-step'})">Next →</button>
        </div>
    </div>

    <script>
        // Matrix Rain Animation
        try {
            const canvas = document.getElementById('matrix-rain');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
                
                const matrixChars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
                const drops = [];
                
                for (let i = 0; i < 30; i++) {
                    drops.push({
                        x: Math.random() * canvas.width,
                        y: Math.random() * canvas.height,
                        speed: Math.random() * 6 + 2,
                        opacity: Math.random() * 0.5 + 0.1,
                        char: matrixChars[Math.floor(Math.random() * matrixChars.length)]
                    });
                }
                
                function drawMatrix() {
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    
                    ctx.fillStyle = '#00ff00';
                    ctx.font = '20px Courier New';
                    
                    drops.forEach(drop => {
                        ctx.globalAlpha = drop.opacity;
                        ctx.fillText(drop.char, drop.x, drop.y);
                        
                        drop.y += drop.speed;
                        if (drop.y > canvas.height) {
                            drop.y = -20;
                            drop.x = Math.random() * canvas.width;
                            drop.char = matrixChars[Math.floor(Math.random() * matrixChars.length)];
                        }
                    });
                    
                    ctx.globalAlpha = 1;
                    requestAnimationFrame(drawMatrix);
                }
                
                drawMatrix();
                
                window.addEventListener('resize', () => {
                    canvas.width = window.innerWidth;
                    canvas.height = window.innerHeight;
                });
            }
        } catch (e) {
            console.error('Matrix animation error:', e);
        }

        // Wizard Logic
        const vscode = acquireVsCodeApi();
        let currentStep = ${this.currentStep};
        const totalSteps = 5;

        function updateUI() {
            // Update step indicators with pulsing completed states
            document.querySelectorAll('.step-indicator').forEach((el, idx) => {
                el.classList.remove('active', 'completed');
                if (idx < currentStep) {
                    el.classList.add('completed');
                } else if (idx === currentStep) {
                    el.classList.add('active');
                }
            });

            // Update step line completion states
            document.querySelectorAll('.step-line').forEach((el, idx) => {
                el.classList.remove('completed');
                if (idx < currentStep) {
                    el.classList.add('completed');
                }
            });

            // Update step content
            document.querySelectorAll('.step').forEach((el, idx) => {
                el.classList.remove('active');
                if (idx === currentStep) {
                    el.classList.add('active');
                }
            });

            // Update progress bar with glow
            const progress = (currentStep / (totalSteps - 1)) * 100;
            document.getElementById('progress-bar').style.width = progress + '%';

            // Update button states
            document.getElementById('btn-prev').disabled = currentStep === 0;
            const nextBtn = document.getElementById('btn-next');
            if (currentStep === totalSteps - 1) {
                // On Step 5 (Verify & Congrats), show Complete button
                nextBtn.textContent = '✅ Complete';
                nextBtn.disabled = false;
                nextBtn.onclick = () => {
                    vscode.postMessage({command: 'setup-complete'});
                };
            } else {
                // On all other steps, show Next button
                nextBtn.textContent = 'Next →';
                nextBtn.onclick = () => {
                    vscode.postMessage({command: 'next-step'});
                };
            }
        }

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'update-step':
                    currentStep = message.step;
                    updateUI();
                    break;
                case 'verify-complete':
                    // Update SDK verification status
                    const sdkEl = document.getElementById('verify-sdk');
                    if (message.success && message.details.sdkFound) {
                        sdkEl.innerHTML = '<span class="status-icon">✅</span><span>SDK Valid (v' + (message.sdkVersion || 'unknown') + ')</span>';
                    } else {
                        sdkEl.innerHTML = '<span class="status-icon">⚠️</span><span>SDK Not Found - Please go back and configure</span>';
                    }
                    
                    // Update Auth verification status
                    const authEl = document.getElementById('verify-auth');
                    if (message.success && message.details.authenticated) {
                        authEl.innerHTML = '<span class="status-icon">✅</span><span>Authentication Passed</span>';
                    } else {
                        authEl.innerHTML = '<span class="status-icon">⚠️</span><span>Not Authenticated - Please go back and authorize</span>';
                    }
                    break;
                case 'discord-status':
                    const statusEl = document.getElementById('discord-status');
                    if (message.found) {
                        statusEl.innerHTML = '<span class="status-icon">✅</span><span>' + message.path + '</span>';
                    } else {
                        statusEl.innerHTML = '<span class="status-icon">⚠️</span><span>' + message.path + '</span>';
                    }
                    break;
            }
        });

        // Initial UI update
        updateUI();
    </script>
</body>
</html>`;
    }
}
