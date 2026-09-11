import fs from 'fs';
import path from 'path';

/**
 * Safely writes a JSON file atomically using a temporary file and rename.
 * Prevents file corruption if the process crashes or shuts down mid-write.
 * Asynchronous to avoid blocking the Node.js event loop.
 */
export async function safeWriteJson(filePath, data) {
  const dir = path.dirname(filePath);
  const tempPath = `${filePath}.tmp.${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    const jsonString = JSON.stringify(data, null, 2);
    await fs.promises.writeFile(tempPath, jsonString, 'utf8');
    await fs.promises.rename(tempPath, filePath);
    return true;
  } catch (err) {
    console.error(`[FileUtils] ❌ Error writing JSON to "${filePath}":`, err.message);
    // Cleanup temporary file if left behind
    try {
      if (fs.existsSync(tempPath)) {
        await fs.promises.unlink(tempPath);
      }
    } catch (_) {}
    return false;
  }
}

/**
 * Safely reads and parses a JSON file with a fallback default.
 */
export function safeReadJson(filePath, fallback = {}) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.trim()) {
        return JSON.parse(content);
      }
    }
  } catch (err) {
    console.error(`[FileUtils] ⚠️ Error reading JSON from "${filePath}":`, err.message);
  }
  return fallback;
}
