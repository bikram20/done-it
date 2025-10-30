import { initDb } from './db';

let initialized = false;

export async function ensureDbInitialized() {
  if (!initialized) {
    await initDb();
    initialized = true;
  }
}
