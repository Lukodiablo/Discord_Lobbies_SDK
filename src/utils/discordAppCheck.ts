/**
 * Utility to check if Discord desktop app is running
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Check if Discord desktop app is running on the system
 */
export async function isDiscordAppRunning(): Promise<boolean> {
    try {
        if (process.platform === 'linux') {
            const { stdout } = await execAsync('pgrep -x Discord || pgrep -x discord');
            return stdout.trim().length > 0;
        } else if (process.platform === 'darwin') {
            const { stdout } = await execAsync('pgrep -x Discord');
            return stdout.trim().length > 0;
        } else if (process.platform === 'win32') {
            const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq Discord.exe" /NH');
            return stdout.includes('Discord.exe');
        }
        return false;
    } catch (error) {
        // pgrep returns non-zero exit code if process not found
        return false;
    }
}
