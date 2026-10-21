import { isSafeOverride } from '../../frame/safeOverride.ts';
import type { Globals, Layout } from '../../protocol/messages.ts';

/** Everything the screen renders a story from, as the capture endpoint takes it. */
export interface CapturePayload {
  /** The story's index id. */
  story: string;
  /** Picks the document: an isolated story renders under frame styles, any other under shell styles. */
  isolate: boolean;
  /** The story's config, with forge's `$` keys stripped and a comparison's args laid over. */
  config: unknown;
  /** Must survive JSON. */
  state: unknown;
  globals: Globals;
  /** CSS variable overrides, by property name. */
  overrides: Readonly<Record<string, string>>;
  /** Null for a story with no timeline, and for an isolated story. */
  playhead: number | null;
  /** The host's size in CSS pixels. */
  box: { width: number; height: number };
  layout: Layout;
  /** Device pixel ratio, in [1, 3]. */
  dpr: number;
  /** Where the story's scroller stands in its host, in CSS pixels, so the capture shows the patch the screen does. */
  scroll: { left: number; top: number };
  /** The workshop lab's theme as the screen shows it: the lab's globals, which the shell config's `labTheme` reads,
   *  and its resolved color mode. An isolated story's document has no lab, and ignores it. */
  lab: { globals: Globals; mode: 'light' | 'dark' };
}

/** Where the endpoint answers, under the dev server's base. */
export const CAPTURE_PATH = '__forge/capture';

/** The pages a capture renders on, under the dev server's base: one per document a story can render in. */
export const CAPTURE_PAGES = { shell: '__forge/capture.html', frame: '__forge/capture-frame.html' };

export const MIN_DPR = 1;
export const MAX_DPR = 3;

const LAYOUTS: readonly string[] = ['centered', 'padded', 'fullscreen'] satisfies readonly Layout[];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const positive = (n: unknown): n is number => finite(n) && n > 0;

/** Reads a request body as a payload, or names the first field it rejects. */
export function parsePayload(body: unknown): CapturePayload | { error: string } {
  if (!isRecord(body)) return { error: 'a capture payload is an object' };
  const { story, isolate, config, state, globals, overrides, playhead, box, layout, dpr, scroll, lab } = body;
  if (typeof story !== 'string' || story === '') return { error: 'story must be an index id' };
  if (typeof isolate !== 'boolean') return { error: 'isolate must be a boolean' };
  if (!isRecord(globals)) return { error: 'globals must be an object' };
  if (!isRecord(overrides) || !Object.values(overrides).every((v) => typeof v === 'string')) {
    return { error: 'overrides must map property names to strings' };
  }
  const unsafe = Object.entries(overrides as Record<string, string>).find(([name, value]) => !isSafeOverride(name, value));
  if (unsafe) return { error: `overrides must name custom properties, with no { } or ; in a value: ${unsafe[0]}` };
  if (playhead !== null && !(typeof playhead === 'number' && Number.isFinite(playhead))) {
    return { error: 'playhead must be a number or null' };
  }
  if (!isRecord(box) || !positive(box.width) || !positive(box.height)) {
    return { error: 'box must have a positive width and height' };
  }
  if (typeof layout !== 'string' || !LAYOUTS.includes(layout)) return { error: `layout must be one of ${LAYOUTS.join(', ')}` };
  if (typeof dpr !== 'number' || !(dpr >= MIN_DPR && dpr <= MAX_DPR)) return { error: `dpr must be in [${MIN_DPR}, ${MAX_DPR}]` };
  if (!isRecord(scroll) || !finite(scroll.left) || !finite(scroll.top)) return { error: 'scroll must hold a finite left and top' };
  if (!isRecord(lab) || !isRecord(lab.globals) || (lab.mode !== 'light' && lab.mode !== 'dark')) {
    return { error: 'lab must hold globals and a mode of light or dark' };
  }
  return {
    story,
    isolate,
    config,
    state,
    globals,
    overrides: overrides as Record<string, string>,
    playhead,
    box: { width: box.width, height: box.height },
    layout: layout as Layout,
    dpr,
    scroll: { left: scroll.left, top: scroll.top },
    lab: { globals: lab.globals, mode: lab.mode },
  };
}
