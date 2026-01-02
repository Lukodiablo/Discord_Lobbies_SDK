import * as https from 'https';
import * as DiscordSDK from './discordSocialSDK';

const DISCORD_API_ENDPOINT = 'https://discord.com/api/v10';

/**
 * Fetch message history for a channel using User Bearer Token
 * @param channelId - Discord channel ID
 * @param accessToken - User OAuth2 Bearer token
 * @param limit - Number of messages to fetch (default 50)
 * @returns Array of message objects (newest first from Discord, reverse for display)
 */
export async function fetchMessages(
  channelId: string,
  accessToken: string,
  limit: number = 50
): Promise<any[]> {
  console.log(`📡 Fetching message history for channel ${channelId} (limit: ${limit})...`);
  
  return new Promise((resolve, reject) => {
    const url = new URL(
      `${DISCORD_API_ENDPOINT}/channels/${channelId}/messages?limit=${limit}`
    );

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'Discord-VSCode-Extension/1.0.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          try {
            const errorData = JSON.parse(data);
            reject(
              new Error(
                `Failed to fetch messages ${res.statusCode}: ${
                  errorData.message || JSON.stringify(errorData)
                }`
              )
            );
          } catch {
            reject(new Error(`Failed to fetch messages ${res.statusCode}`));
          }
        } else {
          try {
            const messages = JSON.parse(data);
            // Reverse to show oldest first
            const reversed = messages.reverse();
            console.log(`✅ Fetched ${reversed.length} messages`);
            resolve(reversed);
          } catch (e) {
            reject(new Error(`Failed to parse messages response: ${e}`));
          }
        }
      });
    });

    req.on('error', (error) => {
      console.error(`Failed to fetch messages for channel ${channelId}:`, error);
      reject(
        new Error(`Could not fetch messages: ${error.message}`)
      );
    });

    req.end();
  });
}

/**
 * Send a message to a channel using User Bearer Token or Discord Social SDK
 * @param channelId - Discord channel ID
 * @param accessToken - User OAuth2 Bearer token
 * @param content - Message content
 * @param userId - User ID (for SDK usage)
 * @returns Message object containing ID, timestamp, etc.
 */
export async function sendMessage(
  channelId: string,
  accessToken: string,
  content: string,
  userId?: string
): Promise<any> {
  if (!content || !content.trim()) {
    return Promise.reject(new Error('Message content cannot be empty'));
  }

  console.log(`📤 Sending message to channel ${channelId}...`);

  // Try using Discord Social SDK if available
  if (DiscordSDK.isInitialized() && userId) {
    try {
      console.log(`📤 Sending message via Discord Social SDK...`);
      const success = DiscordSDK.sendMessage(channelId, userId, content.trim());
      if (success) {
        console.log(`✅ Message sent via SDK`);
        return {
          id: 'sdk-' + Date.now(),
          content: content.trim(),
          channel_id: channelId,
          author: { id: userId }
        };
      }
    } catch (error) {
      console.warn('SDK send message failed, falling back to HTTP API:', error);
    }
  }

  // Fallback to HTTP API
  const messageData = JSON.stringify({
    content: content.trim()
  });

  return new Promise((resolve, reject) => {
    const url = new URL(`${DISCORD_API_ENDPOINT}/channels/${channelId}/messages`);

    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Discord-VSCode-Extension/1.0.0',
        'Content-Length': Buffer.byteLength(messageData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          try {
            const errorData = JSON.parse(data);
            reject(
              new Error(
                `Failed to send message ${res.statusCode}: ${
                  errorData.message || JSON.stringify(errorData)
                }`
              )
            );
          } catch {
            reject(new Error(`Failed to send message ${res.statusCode}`));
          }
        } else {
          try {
            const message = JSON.parse(data);
            console.log(`✅ Message sent via HTTP API (ID: ${message.id})`);
            resolve(message);
          } catch (e) {
            reject(new Error(`Failed to parse message response: ${e}`));
          }
        }
      });
    });

    req.on('error', (error) => {
      console.error(`Failed to send message to channel ${channelId}:`, error);
      reject(new Error(`Could not send message: ${error.message}`));
    });

    req.write(messageData);
    req.end();
  });
}
