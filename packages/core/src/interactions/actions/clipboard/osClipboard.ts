import { dwarn } from 'debug/flag';
import { WEASEL_CLIPBOARD_MIME, buildWeaselClipboardText } from './wireFormat';

/** MIME type to payload, as `produceFlavors` returns it. */
export type ClipboardFlavors = Record<string, string | Promise<string>>;

type Replacer = (key: string, value: unknown) => unknown;
type Flavor = [mime: string, text: string | Promise<string>];

/** The kit's flavors for a copy: its own MIME, and `text/plain` carrying the same JSON. */
export function defaultFlavors(items: readonly unknown[], replacer?: Replacer): ClipboardFlavors {
  const text = buildWeaselClipboardText(items as unknown[], replacer);
  return { [WEASEL_CLIPBOARD_MIME]: text, 'text/plain': text };
}

/** MIME types the async Clipboard API accepts unprefixed. Every other type
 *  (including our own custom MIME, and app-supplied flavors like
 *  `image/svg+xml`) must carry Chromium's `web ` prefix or `ClipboardItem`'s
 *  constructor throws. */
const WELL_KNOWN_CLIPBOARD_MIMES = new Set(['text/plain', 'text/html', 'image/png']);

/** Degradation ladder: full map (every non-well-known MIME web-prefixed) →
 *  the same minus any promised flavor that rejected → well-known-only → give
 *  up with a dwarn. Chromium writes nothing when one flavor rejects, so a
 *  rejection costs only that flavor, never the clipboard's previous content
 *  half-overwritten. */
export async function writeOsClipboard(flavors: ClipboardFlavors): Promise<void> {
  const entries = Object.entries(flavors);
  if (entries.length === 0) return;
  const cb = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (!cb?.write || typeof ClipboardItem === 'undefined') return;
  const rejected = new Set<string>();
  for (const [mime, text] of entries) {
    if (typeof text !== 'string') text.catch(() => { rejected.add(mime); });
  }
  const wireMime = (mime: string) => (WELL_KNOWN_CLIPBOARD_MIMES.has(mime) ? mime : `web ${mime}`);
  const toItem = (fs: Flavor[]) => new ClipboardItem(Object.fromEntries(
    fs.map(([mime, text]) => {
      const wire = wireMime(mime);
      const blob = (t: string) => new Blob([t], { type: wire });
      if (typeof text === 'string') return [wire, blob(text)];
      const promised = text.then(blob);
      // Chromium leaves a ClipboardItem's rejected promise unhandled.
      promised.catch(() => {});
      return [wire, promised];
    }),
  ));
  // Writes `fs`, dropping flavors whose promise rejected and retrying the
  // rest. Returns the last error, or null once a write lands.
  const writeLive = async (fs: Flavor[]): Promise<unknown> => {
    let live = fs;
    for (;;) {
      try {
        await cb.write([toItem(live)]);
        return null;
      } catch (err) {
        const next = live.filter(([mime]) => !rejected.has(mime));
        if (next.length === live.length || next.length === 0) return err;
        live = next;
      }
    }
  };
  if (await writeLive(entries) === null) return;
  const standard = entries.filter(([mime]) => WELL_KNOWN_CLIPBOARD_MIMES.has(mime) && !rejected.has(mime));
  if (standard.length === 0) { dwarn('clipboard', 'OS write failed; no standard flavors to fall back to'); return; }
  const err = await writeLive(standard);
  if (err !== null) dwarn('clipboard', `OS clipboard write failed twice — copy stays in-memory only: ${String(err)}`);
}
