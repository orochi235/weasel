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
 *  JSON drops a function-valued field (a container's `clipFromPose`, a
 *  node's `derivePath`). A scene adapter's snapshot also carries each one's
 *  `SceneRegistry` key (`clipFromPoseKey`, `derivePathKey`, …), which does
 *  cross, and its paste restores the function from the pasting scene's
 *  registry. A function that is not registered does not survive. */
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

// `[^>]*` is safe for OUR serializer's output only: attribute values are
// XML-escaped, so no raw `>` can appear inside the tag.
const SVG_OPEN_TAG = /<svg(?:\s[^>]*)?>/i;

/**
 * Embed a weasel clipboard payload in an SVG document as a `<metadata>`
 * child of the root — legal SVG 1.1, ignored by external tools — so one
 * `text/plain` flavor serves both audiences.
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
 * The weasel clipboard payload embedded in SVG text by
 * {@link embedWeaselMetadataInSvg}, or null when the first `<metadata>` block
 * is absent or not the weasel wire format. A text scan, not an XML parse.
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
