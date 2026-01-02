import * as http from 'http';
import * as url from 'url';
import * as vscode from 'vscode';

export class OAuthCallbackServer {
	private server: http.Server | null = null;
	private port: number = 3000;
	private authCode: string | null = null;
	private authError: string | null = null;
	private resolved: boolean = false;

	/**
	 * Start the OAuth callback server
	 */
	start(): Promise<string> {
		return new Promise((resolve, reject) => {
			this.server = http.createServer((req, res) => {
				this.handleRequest(req, res, resolve, reject);
			});

		this.server.listen(3000, 'localhost', () => {
			console.log(`OAuth callback server listening on port 3000`);
		});			this.server.on('error', (err: any) => {
				if (err.code === 'EADDRINUSE') {
					console.log(`Port ${this.port} already in use, trying next port`);
					this.port++;
					this.start().then(resolve).catch(reject);
				} else {
					reject(err);
				}
			});

			// Timeout after 5 minutes
			setTimeout(() => {
				if (!this.resolved) {
					this.stop();
					reject(new Error('OAuth callback timeout'));
				}
			}, 5 * 60 * 1000);
		});
	}

	/**
	 * Handle incoming requests
	 */
	private handleRequest(
		req: http.IncomingMessage,
		res: http.ServerResponse,
		resolve: (value: string) => void,
		reject: (reason?: any) => void
	): void {
		if (!req.url) {
			res.writeHead(400);
			res.end('Bad Request');
			return;
		}

		const parsedUrl = url.parse(req.url, true);
		const query = parsedUrl.query;

		// Check for error
		if (query.error) {
			this.authError = query.error as string;
			res.writeHead(400);
			res.end(`Error: ${this.authError}`);
			this.resolved = true;
			this.stop();
			reject(new Error(`OAuth error: ${this.authError}`));
			return;
		}

		// Check for code
		if (query.code) {
			this.authCode = query.code as string;
			res.writeHead(200, { 'Content-Type': 'text/html' });
			res.end(`
				<!DOCTYPE html>
				<html>
				<head>
					<title>Discord OAuth Success</title>
					<style>
						body { font-family: Arial, sans-serif; margin: 40px; text-align: center; }
						.success { color: #4CAF50; font-size: 24px; }
						.message { margin-top: 20px; }
					</style>
				</head>
				<body>
					<div class="success">✓ Authorization successful!</div>
					<div class="message">You can now close this window and return to VS Code.</div>
				</body>
				</html>
			`);
			this.resolved = true;
			this.stop();
			resolve(this.authCode);
			return;
		}

		res.writeHead(400);
		res.end('Invalid request');
	}

	/**
	 * Stop the server
	 */
	stop(): void {
		if (this.server) {
			this.server.close();
			this.server = null;
			console.log('OAuth callback server stopped');
		}
	}

	/**
	 * Get the callback URL
	 */
	getCallbackUrl(): string {
		return `http://localhost:3000/callback`;
	}
}
