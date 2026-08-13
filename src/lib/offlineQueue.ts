import { nowIso } from "@/lib/catTime";
import { supabase } from "@/integrations/supabase/client";

/**
 * Offline-first write queue.
 * Records saved while the device is offline are stored on the gadget
 * (localStorage) and automatically uploaded to the cloud once the
 * internet connection returns.
 */

export type QueuedTable = "payments" | "cash_movements" | "vacation_payments" | "inventory_sales";

export interface QueuedWrite {
  id: string;
  table: QueuedTable;
  row: Record<string, unknown>;
  created_at: string;
  label?: string;
}

const KEY = "pcc_offline_queue_v1";
const listeners = new Set<(items: QueuedWrite[]) => void>();
let syncing = false;

function read(): QueuedWrite[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedWrite[]) : [];
  } catch {
    return [];
  }
}

function write(items: QueuedWrite[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage full — ignore */
  }
  listeners.forEach((fn) => fn(items));
}

export function getQueue(): QueuedWrite[] {
  return read();
}

export function subscribeQueue(fn: (items: QueuedWrite[]) => void) {
  listeners.add(fn);
  fn(read());
  return () => {
    listeners.delete(fn);
  };
}

export function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function enqueueWrite(table: QueuedTable, row: Record<string, unknown>, label?: string) {
  const item: QueuedWrite = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    table,
    row,
    created_at: nowIso(),
    label,
  };
  write([...read(), item]);
  return item;
}

export function removeQueued(id: string) {
  write(read().filter((i) => i.id !== id));
}

/**
 * Save a row: straight to the cloud when online, otherwise onto the gadget.
 * Returns whether it was queued locally.
 */
export async function saveOrQueue(
  table: QueuedTable,
  row: Record<string, unknown>,
  label?: string,
): Promise<{ queued: boolean; data?: unknown; error?: { message: string; code?: string } }> {
  if (isOffline()) {
    enqueueWrite(table, row, label);
    return { queued: true };
  }
  const { data, error } = await supabase.from(table).insert(row as never).select().single();
  if (error) {
    const code = (error as { code?: string }).code;
    // Network-ish failure → keep it on the gadget instead of losing it
    const networkish = !code || code === "" || /fetch|network|Failed to fetch/i.test(error.message);
    if (networkish) {
      enqueueWrite(table, row, label);
      return { queued: true };
    }
    return { queued: false, error: { message: error.message, code } };
  }
  return { queued: false, data };
}

/** Upload everything held on the gadget. Safe to call repeatedly. */
export async function syncQueue(): Promise<{ uploaded: number; failed: number }> {
  if (syncing || isOffline()) return { uploaded: 0, failed: 0 };
  syncing = true;
  let uploaded = 0;
  let failed = 0;
  try {
    for (const item of read()) {
      const { error } = await supabase.from(item.table).insert(item.row as never);
      if (!error) {
        removeQueued(item.id);
        uploaded++;
      } else if ((error as { code?: string }).code === "23505") {
        // already uploaded / duplicate reference — drop it
        removeQueued(item.id);
        uploaded++;
      } else {
        failed++;
      }
    }
  } finally {
    syncing = false;
  }
  return { uploaded, failed };
}

let started = false;
export function initOfflineSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", () => { void syncQueue(); });
  window.setInterval(() => { void syncQueue(); }, 30000);
  void syncQueue();
}
