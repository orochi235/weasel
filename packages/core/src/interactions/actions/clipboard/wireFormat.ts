import { dwarn } from 'debug/flag';

/** MIME type the kit writes its full-fidelity clipboard payload under, so a
 *  copy/paste between two weasel canvases round-trips scene nodes rather than
 *  the SVG or text flavors other apps read. */
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

// Opening `<svg ...>` tag of a serialized document. `[^>]*` is safe for OUR
// serializer's output (attribute values are XML-escaped, so no raw `>` can
// appear inside the tag) — see embedWeaselMetadataInSvg's contract note.
const SVG_OPEN_TAG = /<svg(?:\s[^>]*)?>/i;

/**
 * Embed a weasel clipboard payload in an SVG document as a `<metadata>`
 * child of the root — legal SVG 1.1, ignored by external tools — so one
 * `text/plain` flavor serves both audiences: external tools parse the SVG,
 * weasel extracts the JSON for full fidelity on draw→draw DOM paste.
 *
 * The payload rides in CDATA so JSON's `<` / `&` need no entity escaping; a
 * literal `]]>` inside the payload is split across CDATA sections
 * (`]]]]><![CDATA[>`), which {@link extractWeaselClipboardFromSvg} rejoins.
 *
 * Intended for OUR serializer's output only (`serializeSvg` — single
 * `<svg ...>` open tag, XML-escaped attributes). When no open tag is found
 * the input is returned unchanged with a debug warning.
 */
export function embedWeaselMetadataInSvg(svgText: string, payloadText: string): string {
  const open = SVG_OPEN_TAG.exec(svgText);
  if (!open) {
    dwarn('clipboard', 'embedWeaselMetadataInSvg: no <svg ...> open tag found — returning input unchanged');
    return svgText;
  }
  const cdata = `<![CDATA[${payloadText.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`;
  const at = open.index + open[0].length;
  return `${svgText.slice(0, at)}<metadata>${cdata}</metadata>${svgText.slice(at)}`;
}

/**
 * Recover an embedded weasel clipboard payload from SVG text: read the first
 * `<metadata>` block, rejoin its CDATA sections (concatenation restores the
 * `]]>` split by {@link embedWeaselMetadataInSvg}; plain non-CDATA content
 * passes through as-is), and return the payload text iff it sniffs as the
 * weasel wire format — else null (external/non-weasel metadata declines).
 *
 * A text scan, not an XML parse — the payload is small and ours.
 */
export function extractWeaselClipboardFromSvg(svgText: string): string | null {
  const block = /<metadata(?:\s[^>]*)?>([\s\S]*?)<\/metadata>/i.exec(svgText);
  if (!block) return null;
  const inner = block[1];
  const payload = inner.includes('<![CDATA[')
    ? Array.from(inner.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g), (m) => m[1]).join('')
    : inner;
  return sniffWeaselClipboardText(payload) ? payload : null;
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
