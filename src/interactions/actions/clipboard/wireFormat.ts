import { dwarn } from 'debug/flag';

export const WEASEL_CLIPBOARD_MIME = 'application/x-weasel-clipboard+json';
/** Chromium's async-clipboard spelling for custom formats. */
export const WEASEL_CLIPBOARD_MIME_WEB = `web ${WEASEL_CLIPBOARD_MIME}`;

interface WeaselClipboardPayload { weaselClipboard: 1; nodes: unknown[] }

type Replacer = (key: string, value: unknown) => unknown;
type Reviver = (key: string, value: unknown) => unknown;

/** Serialize snapshot items into the versioned wire text.
 *
 *  Function-valued fields (e.g. a container's `clipFromPose`) are dropped by
 *  JSON serialization — OS-pasted clip containers arrive unclipped.
 *  Consumers who need clips to survive the OS round-trip can translate
 *  function ↔ registry key in their `jsonReplacer`/reviver pair (the
 *  scene-serialization `clipFromPoseKey` precedent). */
export function buildWeaselClipboardText(items: unknown[], replacer?: Replacer): string {
  const payload: WeaselClipboardPayload = { weaselClipboard: 1, nodes: items };
  return JSON.stringify(payload, replacer as Parameters<typeof JSON.stringify>[1]);
}

/** Cheap check: could this text be a weasel clipboard payload? Substring
 *  pre-check, then a guarded parse + marker/version test. */
export function sniffWeaselClipboardText(text: string): boolean {
  if (!text.includes('"weaselClipboard"')) return false;
  try {
    const parsed = JSON.parse(text) as Partial<WeaselClipboardPayload> | null;
    return !!parsed && parsed.weaselClipboard === 1;
  } catch {
    return false;
  }
}

/** Parse wire text to snapshot items, or null when malformed/mismatched
 *  (callers decline to the next content handler). */
export function parseWeaselClipboardText(text: string, reviver?: Reviver): unknown[] | null {
  try {
    const parsed = JSON.parse(text, reviver as Parameters<typeof JSON.parse>[1]) as
      Partial<WeaselClipboardPayload> | null;
    if (!parsed || parsed.weaselClipboard !== 1 || !Array.isArray(parsed.nodes)) return null;
    return parsed.nodes;
  } catch (err) {
    dwarn('clipboard', `weasel payload failed to parse: ${String(err)}`);
    return null;
  }
}
