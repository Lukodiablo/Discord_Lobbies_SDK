import * as vscode from 'vscode';
import * as path from 'path';
import { DiagnosticsPanel } from '../utils/diagnosticsPanel';

/**
 * Quick Access Panel - Displays frequently used Discord commands
 * Can be shown on startup (configurable) or triggered via command palette
 */
export class QuickAccessPanel {
    private panel: vscode.WebviewPanel | null = null;
    private context: vscode.ExtensionContext;
    private diagnostics = DiagnosticsPanel.getInstance();

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    public async show(): Promise<void> {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.diagnostics.logSetupProgress(0, 'Quick Access Panel opened');

        this.panel = vscode.window.createWebviewPanel(
            'discord.quickAccess',
            'Discord Lobbies SDK',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.context.extensionUri, 'media')
                ]
            }
        );

        this.panel.webview.html = this.getHTML();

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            message => this.handleMessage(message),
            undefined,
            this.context.subscriptions
        );

        this.panel.onDidDispose(
            () => {
                this.panel = null;
            },
            undefined,
            this.context.subscriptions
        );
    }

    private handleMessage(message: any): void {
        if (message.command === 'run-cmd') {
            Promise.resolve(vscode.commands.executeCommand(message.cmd)).catch((error: any) => {
                vscode.window.showErrorMessage(`Failed to run command: ${error.message}`);
            });
        } else if (message.command === 'get-startup-setting') {
            const showOnStartup = vscode.workspace.getConfiguration('discord').get<boolean>('showQuickAccessOnStartup', false);
            this.panel?.webview.postMessage({command: 'startup-setting-value', value: showOnStartup});
        } else if (message.command === 'set-startup-setting') {
            vscode.workspace.getConfiguration('discord').update('showQuickAccessOnStartup', message.value, vscode.ConfigurationTarget.Global);
        }
    }

    private getHTML(): string {
        const commands = [
            { id: 'discord-vscode.authenticate', label: '🔐 Authenticate', desc: 'Login to Discord' },
            { id: 'discord-vscode.createLobby', label: '🏠 Create Lobby', desc: 'Start a new lobby' },
            { id: 'discord-vscode.listLobbies', label: '📋 List Lobbies', desc: 'View all lobbies' },
            { id: 'discord-vscode.joinLobby', label: '🚪 Join Lobby', desc: 'Join existing lobby' },
            { id: 'discord-vscode.connectLobbyVoice', label: '🎤 Connect Voice', desc: 'Join voice channel' },
            { id: 'discord-vscode.testConnection', label: '✅ Test Connection', desc: 'Verify setup' }
        ];

        const commandButtons = commands.map(cmd => `
            <div class="command-btn" onclick="vscode.postMessage({command: 'run-cmd', cmd: '${cmd.id}'})">
                <div class="cmd-label">${cmd.label}</div>
                <div class="cmd-desc">${cmd.desc}</div>
            </div>
        `).join('');

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Discord Lobbies SDK - Quick Access</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Courier New', monospace;
            background: #000000;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            color: #00ff00;
            overflow: hidden;
            position: relative;
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

        .container {
            max-width: 900px;
            width: 100%;
            position: relative;
            z-index: 100;
            background: rgba(13, 13, 23, 0.4);
            border-radius: 12px;
            border: 2px solid #00ff00;
            padding: 40px;
            box-shadow: 0 0 40px rgba(0, 255, 0, 0.3), inset 0 0 20px rgba(0, 255, 0, 0.05);
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
            margin-bottom: 50px;
            animation: slideDown 0.6s ease-out;
        }

        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            color: #00ff00;
            text-shadow: 0 0 20px rgba(0, 255, 0, 0.8), 0 0 40px rgba(0, 136, 255, 0.4);
            letter-spacing: 2px;
        }

        .header p {
            font-size: 1.1em;
            color: #00ff00;
            opacity: 0.8;
            text-shadow: 0 0 10px rgba(0, 255, 0, 0.6);
        }

        .commands-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }

        .command-btn {
            background: rgba(0, 255, 0, 0.05);
            border: 2px solid #00ff00;
            border-radius: 12px;
            padding: 25px;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            flex-direction: column;
            gap: 8px;
            animation: slideUp 0.6s ease-out backwards;
            box-shadow: 0 0 15px rgba(0, 255, 0, 0.2);
        }

        .command-btn:nth-child(1) { animation-delay: 0.1s; }
        .command-btn:nth-child(2) { animation-delay: 0.2s; }
        .command-btn:nth-child(3) { animation-delay: 0.3s; }
        .command-btn:nth-child(4) { animation-delay: 0.4s; }
        .command-btn:nth-child(5) { animation-delay: 0.5s; }
        .command-btn:nth-child(6) { animation-delay: 0.6s; }
        .command-btn:nth-child(7) { animation-delay: 0.7s; }

        .command-btn:hover {
            background: rgba(0, 255, 0, 0.15);
            border-color: #00ffff;
            transform: translateY(-5px);
            box-shadow: 0 0 30px rgba(0, 255, 0, 0.6), 0 5px 15px rgba(0, 255, 0, 0.3);
            color: #00ffff;
        }

        .cmd-label {
            font-size: 1.2em;
            font-weight: 600;
            color: #00ff00;
            text-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
        }

        .command-btn:hover .cmd-label {
            color: #00ffff;
            text-shadow: 0 0 15px rgba(0, 255, 255, 0.8);
        }

        .cmd-desc {
            font-size: 0.9em;
            color: #00ff00;
            opacity: 0.7;
        }

        .command-btn:hover .cmd-desc {
            color: #00ffff;
            opacity: 1;
        }

        .footer {
            text-align: center;
            padding: 20px;
            color: #00ff00;
            font-size: 0.9em;
            opacity: 0.7;
            text-shadow: 0 0 5px rgba(0, 255, 0, 0.4);
        }

        .footer a {
            color: #0088ff;
            text-decoration: none;
            text-shadow: 0 0 10px rgba(0, 136, 255, 0.6);
        }

        .footer a:hover {
            color: #00ffff;
            text-shadow: 0 0 15px rgba(0, 255, 255, 0.8);
            text-decoration: underline;
        }

        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @media (max-width: 600px) {
            .header h1 {
                font-size: 1.8em;
            }

            .commands-grid {
                grid-template-columns: 1fr;
                gap: 15px;
            }

            .command-btn {
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <canvas id="matrix-rain"></canvas>
    <div class="container">
        <div class="header">
            <h1>🎮 Discord Lobbies SDK</h1>
            <p>Extension Quick Access</p>
        </div>

        <div class="commands-grid">
            ${commandButtons}
        </div>

        <div class="footer">
            <p>💡 Tip: You can also access these commands via the command palette (Ctrl+Shift+P)</p>
            <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(0, 255, 0, 0.3);">
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                    <input type="checkbox" id="startupToggle" style="width: 18px; height: 18px; cursor: pointer;" />
                    <span>Show this panel at startup</span>
                </label>
            </div>
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

        const vscode = acquireVsCodeApi();

        // Load startup toggle state
        try {
            const startupToggle = document.getElementById('startupToggle');
            if (startupToggle) {
                vscode.postMessage({command: 'get-startup-setting'});
                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'startup-setting-value') {
                        startupToggle.checked = message.value;
                    }
                });
                
                startupToggle.addEventListener('change', (e) => {
                    const isChecked = e.target.checked;
                    vscode.postMessage({command: 'set-startup-setting', value: isChecked});
                });
            }
        } catch (e) {
            console.error('Startup toggle error:', e);
        }
    </script>
</body>
</html>
        `;
    }
}
