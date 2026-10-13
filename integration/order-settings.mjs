import fs from 'node:fs/promises';
export const settingsPath = new URL('./order-settings.local.json', import.meta.url);
export async function orderSettings() {
  try { return JSON.parse(await fs.readFile(process.env.ORDER_SETTINGS_FILE || settingsPath, 'utf8')); }
  catch(error) { if(error.code === 'ENOENT') return {}; if(error instanceof SyntaxError)throw new Error('Invalid order settings JSON');throw error; }
}
