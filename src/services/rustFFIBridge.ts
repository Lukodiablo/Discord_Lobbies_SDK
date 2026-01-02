/**
 * DEPRECATED: Rust FFI Bridge
 * 
 * This file is no longer used. The extension now uses:
 * - Discord Subprocess (Rust binary with JSON IPC)
 * - See: discordSDKSubprocess.ts
 */

// Stub exports for backwards compatibility
export class RustFFIBridge {
  async initialize(appId: string, token: string): Promise<boolean> {
    throw new Error('RustFFIBridge is deprecated. Use DiscordSubprocess instead.');
  }
}

export const rustFFIBridge = new RustFFIBridge();
export default rustFFIBridge;

