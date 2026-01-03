import * as https from 'https';
import * as http from 'http';

/**
 * Relay API Service - Connects to the Vercel-deployed Messages Relay API
 * Handles real-time message relay between extensions
 */

const RELAY_API_URL = process.env.RELAY_API_URL || 'https://messages-l5kpjcmhp-lukas-projects-2b680f8b.vercel.app';

interface RelayMessage {
  from: string;
  content: string;
  timestamp?: number;
  channel_id?: string;
  message_id?: string;
}

interface RelayResponse {
  status: string;
  received_at?: number;
  note?: string;
}

/**
 * Register extension with the relay API
 */
export async function registerExtension(extensionId: string): Promise<RelayResponse> {
  console.log(`[RelayAPI] Registering extension: ${extensionId}`);
  
  return new Promise((resolve, reject) => {
    const url = new URL(`${RELAY_API_URL}/register/${extensionId}`);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': 0,
        'User-Agent': 'Discord-VSCode-Extension/1.0.0'
      }
    };

    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Register failed ${res.statusCode}: ${data}`));
        } else {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Unregister extension from the relay API
 */
export async function unregisterExtension(extensionId: string): Promise<RelayResponse> {
  console.log(`[RelayAPI] Unregistering extension: ${extensionId}`);
  
  return new Promise((resolve, reject) => {
    const url = new URL(`${RELAY_API_URL}/unregister/${extensionId}`);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': 0,
        'User-Agent': 'Discord-VSCode-Extension/1.0.0'
      }
    };

    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Unregister failed ${res.statusCode}: ${data}`));
        } else {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Relay a message through the API to other connected extensions
 */
export async function relayMessage(
  lobbyId: string,
  message: RelayMessage
): Promise<RelayResponse> {
  console.log(`[RelayAPI] Relaying message to lobby: ${lobbyId}`, message);
  
  const payload = JSON.stringify(message);
  
  return new Promise((resolve, reject) => {
    const url = new URL(`${RELAY_API_URL}/relay/${lobbyId}`);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'Discord-VSCode-Extension/1.0.0'
      }
    };

    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Relay failed ${res.statusCode}: ${data}`));
        } else {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Register extension for a specific lobby
 */
export async function registerLobby(lobbyId: string, extensionId: string): Promise<any> {
  console.log(`[RelayAPI] Registering for lobby ${lobbyId}`);
  
  return new Promise((resolve, reject) => {
    const url = new URL(`${RELAY_API_URL}/register/${lobbyId}/${extensionId}`);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': 0,
        'User-Agent': 'Discord-VSCode-Extension/1.0.0'
      }
    };

    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Register lobby failed ${res.statusCode}: ${data}`));
        } else {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Unregister extension from a specific lobby
 */
export async function unregisterLobby(lobbyId: string, extensionId: string): Promise<any> {
  console.log(`[RelayAPI] Unregistering from lobby ${lobbyId}`);
  
  return new Promise((resolve, reject) => {
    const url = new URL(`${RELAY_API_URL}/unregister/${lobbyId}/${extensionId}`);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': 0,
        'User-Agent': 'Discord-VSCode-Extension/1.0.0'
      }
    };

    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Unregister lobby failed ${res.statusCode}: ${data}`));
        } else {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Get messages from a lobby
 */
export async function getLobbyMessages(lobbyId: string, since?: number): Promise<any[]> {
  console.log(`[RelayAPI] Getting messages for lobby ${lobbyId}`);
  
  return new Promise((resolve, reject) => {
    let path = `/messages/${lobbyId}`;
    if (since) {
      path += `?since=${since}`;
    }

    const url = new URL(RELAY_API_URL + path);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Discord-VSCode-Extension/1.0.0'
      }
    };

    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Get messages failed ${res.statusCode}`));
        } else {
          try {
            const response = JSON.parse(data);
            resolve(response.messages || []);
          } catch (e) {
            reject(e);
          }
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Health check for the relay API
 */
export async function healthCheck(): Promise<any> {
  console.log(`[RelayAPI] Health check...`);
  
  return new Promise((resolve, reject) => {
    const url = new URL(RELAY_API_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: '/',
      method: 'GET',
      headers: {
        'User-Agent': 'Discord-VSCode-Extension/1.0.0'
      }
    };

    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Health check failed ${res.statusCode}`));
        } else {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}
