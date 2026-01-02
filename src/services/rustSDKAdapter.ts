import { EventEmitter } from 'events';
import { DiscordGatewayClient } from '../gateway/discordGatewayClient';

type SDKState = 'UNINITIALIZED' | 'CONNECTING' | 'READY' | 'ERROR' | 'DISCONNECTED';

interface Guild {
  id: string;
  name: string;
  icon?: string;
  owner?: boolean;
}

interface Channel {
  id: string;
  name: string;
  type: number;
}

export class RustSDKAdapter extends EventEmitter {
  private static instance: RustSDKAdapter | null = null;
  private state: SDKState = 'UNINITIALIZED';
  private gateway: DiscordGatewayClient | null = null;

  private constructor() {
    super();
  }

  static getInstance(): RustSDKAdapter {
    if (!RustSDKAdapter.instance) {
      RustSDKAdapter.instance = new RustSDKAdapter();
    }
    return RustSDKAdapter.instance;
  }

  getState(): SDKState {
    return this.state;
  }

  isReady(): boolean {
    return this.state === 'READY' && this.gateway !== null && this.gateway.isReady();
  }

  async initialize(appId: string, token: string): Promise<boolean> {
    if (this.state === 'CONNECTING' || this.state === 'READY') {
      return this.isReady();
    }

    try {
      this.state = 'CONNECTING';
      this.emit('state-change', 'CONNECTING');

      this.gateway = new DiscordGatewayClient();
      this.gateway.setToken(token);
      
      this.gateway.on('ready', (data) => {
        this.state = 'READY';
        this.emit('state-change', 'READY');
        this.emit('ready', data);
      });

      await this.gateway.connect();
      return true;
    } catch (error) {
      this.state = 'ERROR';
      this.emit('state-change', 'ERROR');
      this.emit('error', error);
      return false;
    }
  }

  async getGuilds(): Promise<Guild[]> {
    if (!this.isReady() || !this.gateway) {
      throw new Error('Gateway not ready');
    }
    return this.gateway.getGuilds();
  }

  async getGuildChannels(guildId: string): Promise<Channel[]> {
    if (!this.isReady() || !this.gateway) {
      throw new Error('Gateway not ready');
    }
    return this.gateway.getGuildChannels(guildId);
  }

  async getDMChannels(): Promise<Channel[]> {
    if (!this.isReady() || !this.gateway) {
      throw new Error('Gateway not ready');
    }
    return this.gateway.getDMChannels();
  }

  async getFriends(): Promise<any[]> {
    if (!this.isReady() || !this.gateway) {
      throw new Error('Gateway not ready');
    }
    return this.gateway.getFriends();
  }

  async sendMessage(channelId: string, content: string): Promise<void> {
    throw new Error('Use messageAPI for sending messages');
  }

  async disconnect(): Promise<void> {
    if (this.gateway) {
      this.gateway.disconnect();
      this.gateway = null;
    }
    this.state = 'DISCONNECTED';
    this.emit('state-change', 'DISCONNECTED');
    this.emit('disconnected');
  }
}

export const rustSDKAdapter = RustSDKAdapter.getInstance();
export default RustSDKAdapter;
