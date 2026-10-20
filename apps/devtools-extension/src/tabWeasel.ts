/** What the toolbar button knows about a tab: whether weasel runs there, read from each frame's hook. */
import type { ExtensionApi } from './browserApi';

export interface FrameWeasel {
  kitVersion: string;
  roots: number;
}

export interface TabWeasel extends FrameWeasel {
  /** Frames with a hook. */
  frames: number;
}

/** Runs in the page's own world through `scripting.executeScript`, which sends only its source: it may not close over anything. */
export function probeFrame(): FrameWeasel | null {
  const hook = (window as { __weaselDevtools__?: { kitVersion?: unknown; roots?: () => unknown[] } }).__weaselDevtools__;
  if (typeof hook !== 'object' || hook === null) return null;
  return { kitVersion: String(hook.kitVersion ?? ''), roots: typeof hook.roots === 'function' ? hook.roots().length : 0 };
}

export function summarize(frames: readonly unknown[]): TabWeasel | null {
  const found = frames.filter((f): f is FrameWeasel => typeof f === 'object' && f !== null && 'roots' in f);
  if (found.length === 0) return null;
  return {
    kitVersion: found[0]!.kitVersion,
    roots: found.reduce((n, f) => n + f.roots, 0),
    frames: found.length,
  };
}

/** Null where weasel is absent, and where the browser lets no extension script the page. */
export async function probeTab(api: ExtensionApi, tabId: number): Promise<TabWeasel | null> {
  try {
    const results = await api.scripting!.executeScript({
      target: { tabId, allFrames: true }, world: 'MAIN', func: probeFrame,
    });
    return summarize((results ?? []).map((r) => r.result));
  } catch {
    return null;
  }
}

export function badgeText(tab: TabWeasel | null): string {
  if (!tab) return '';
  return tab.roots > 0 ? String(tab.roots) : '•';
}

/** Probe a tab and show the answer on its badge. */
export async function refreshBadge(api: ExtensionApi, tabId: number): Promise<TabWeasel | null> {
  const tab = await probeTab(api, tabId);
  await api.action?.setBadgeText({ tabId, text: badgeText(tab) });
  return tab;
}
