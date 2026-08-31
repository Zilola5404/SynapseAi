import fs from "node:fs";
import path from "node:path";

const lockPath = path.join(process.cwd(), ".synapse-telegram.lock");

export function acquireTelegramLock(): { ok: boolean; reason?: string } {
  try {
    if (fs.existsSync(lockPath)) {
      const raw = fs.readFileSync(lockPath, "utf8").trim();
      const pid = parseInt(raw, 10);
      if (pid && pid !== process.pid && isPidAlive(pid)) {
        return { ok: false, reason: `Another SynapseAI bot instance is already running (pid ${pid}). Stop the other process.` };
      }
    }
    fs.writeFileSync(lockPath, String(process.pid), "utf8");
    return { ok: true };
  } catch (err) {
    return { ok: true, reason: err instanceof Error ? err.message : String(err) };
  }
}

export function releaseTelegramLock() {
  try {
    if (!fs.existsSync(lockPath)) return;
    const pid = parseInt(fs.readFileSync(lockPath, "utf8").trim(), 10);
    if (!pid || pid === process.pid) fs.unlinkSync(lockPath);
  } catch {
    /* ignore */
  }
}

function isPidAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
