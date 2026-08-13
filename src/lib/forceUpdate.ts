// Detects when the server has a newer build than the one currently loaded and
// forces a hard refresh (clearing caches + service workers) exactly once.

const RELOAD_FLAG = "pcc-forced-reload-at";

const currentEntryScript = () => {
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]'));
  const entry = scripts.map((s) => s.getAttribute("src") || "").find((src) => src.includes("/assets/"));
  return entry || "";
};

const remoteEntryScript = async () => {
  const res = await fetch(`/index.html?ts=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return "";
  const html = await res.text();
  const match = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/i);
  return match?.[1] || "";
};

const hardRefresh = async () => {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.allSettled(keys.map((k) => caches.delete(k)));
    }
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(regs.map((r) => r.unregister()));
    }
  } catch {
    /* best effort */
  }
  window.location.reload();
};

const checkForNewBuild = async () => {
  try {
    const local = currentEntryScript();
    if (!local) return;
    const remote = await remoteEntryScript();
    if (!remote) return;

    const norm = (v: string) => v.split("/").pop() || v;
    if (norm(remote) === norm(local)) return;

    // Guard against reload loops (e.g. CDN serving mixed versions).
    const last = Number(sessionStorage.getItem(RELOAD_FLAG) || 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
    await hardRefresh();
  } catch {
    /* offline or blocked — ignore */
  }
};

export const installBuildFreshnessCheck = () => {
  if (typeof window === "undefined" || !import.meta.env.PROD) return;
  void checkForNewBuild();
  window.setInterval(() => void checkForNewBuild(), 60_000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkForNewBuild();
  });
  window.addEventListener("online", () => void checkForNewBuild());
};
