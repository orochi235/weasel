/**
 * The edit overlay must never be seen laid out in the fallback face while its
 * own face is on the way: a wrapped line breaks differently in the fallback,
 * then reflows when the face lands. Watched with a `MutationObserver` on every
 * style write, not through `overlayReady`, which waits the load out itself.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { registerFont, registerFontOutlines, loadFontOutlines } from '@weasel-js/font';
import type { TextStyle } from '@weasel-js/text';
import { useTextEdit, type TextEditScreenPose } from './useTextEdit';
import metricsUrl from '../../../../../assets/fonts/inter/inter.json?url';
import atlasUrl from '../../../../../assets/fonts/inter/inter.png?url';
import ttfUrl from '../../../../../assets/fonts/inter/inter.ttf?url';

const BOX = { x: 20, y: 20, width: 200, height: 200 };
const TEXT = 'a well-known, hand-made, state-of-the-art text';

let host: HTMLDivElement;
let root: Root;
let ttf: ArrayBuffer;

function Editor({ family, fontHold }: { family: string; fontHold?: number }) {
  const style: TextStyle = { fontFamily: family, fontSize: 20, lineHeight: 1.2, wrap: true };
  const { startEdit } = useTextEdit({
    container: host,
    getText: () => TEXT,
    getStyle: () => style,
    getScreenPose: (): TextEditScreenPose => ({ ...BOX, fontSize: 20, zoom: 1 }),
    setText: () => {},
    fontHold,
  });
  useEffect(() => { startEdit('n', { caret: 0 }); }, [startEdit]);
  return null;
}

/** The private faces named first in `el`'s inline font-family. */
function privateFaces(el: HTMLElement): FontFace[] {
  const first = el.style.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
  return [...document.fonts].filter((f) => f.family === first);
}

interface Sample { at: number; shown: boolean; loaded: boolean }

/**
 * Open an edit on `family` and record, at every write to the overlay's style
 * and every frame, whether it was showing and whether its face had loaded.
 * Stops once the overlay has shown for `settle` ms.
 */
async function watchEdit(family: string, fontHold?: number, settle = 50): Promise<Sample[]> {
  const samples: Sample[] = [];
  const t0 = performance.now();
  let shownAt: number | null = null;
  let resolveDone!: () => void;
  const done = new Promise<void>((r) => { resolveDone = r; });
  const sample = () => {
    const el = host.querySelector<HTMLElement>('[contenteditable]');
    if (!el) return;
    const faces = privateFaces(el);
    const shown = el.style.opacity !== '0';
    const now = performance.now() - t0;
    samples.push({ at: now, shown, loaded: faces.length > 0 && faces.every((f) => f.status === 'loaded') });
    if (shown && shownAt === null) shownAt = now;
    if (shownAt !== null && now - shownAt > settle) resolveDone();
  };
  const obs = new MutationObserver(sample);
  obs.observe(host, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
  // A style write that changes nothing fires no mutation, so frames sample too.
  let raf = 0;
  const everyFrame = () => { sample(); raf = requestAnimationFrame(everyFrame); };
  raf = requestAnimationFrame(everyFrame);
  const timeout = setTimeout(resolveDone, 6000);
  flushSync(() => root.render(createElement(Editor, { key: family, family, fontHold })));
  sample();
  await done;
  clearTimeout(timeout);
  cancelAnimationFrame(raf);
  obs.disconnect();
  return samples;
}

beforeAll(async () => {
  host = document.createElement('div');
  Object.assign(host.style, { position: 'fixed', left: '0px', top: '0px', width: '400px', height: '400px' });
  document.body.style.margin = '0';
  document.body.appendChild(host);
  root = createRoot(document.createElement('div'));
  ttf = await (await fetch(ttfUrl)).arrayBuffer();
});

afterEach(() => { flushSync(() => root.render(null)); });

afterAll(() => {
  root.unmount();
  host.remove();
});

describe('edit overlay face', () => {
  it('is never shown in the fallback face when an edit opens right after registration', async () => {
    await registerFont('Face Url', {}, metricsUrl, atlasUrl);
    registerFontOutlines('Face Url', {}, ttfUrl);
    // A hold long enough that a loaded machine cannot outrun it; the default's
    // bound is the last test's business.
    const samples = await watchEdit('Face Url', 5000);
    expect(samples.some((s) => s.shown), 'the overlay showed at all').toBe(true);
    expect(samples.filter((s) => s.shown && !s.loaded)).toEqual([]);
  });

  it('is built at registration when the bytes are already in hand', async () => {
    await registerFont('Face Bytes', {}, metricsUrl, atlasUrl);
    const before = document.fonts.size;
    registerFontOutlines('Face Bytes', {}, ttf.slice(0));
    const added = [...document.fonts].slice(before);
    expect(added).toHaveLength(1);
    await added[0].loaded;
    const samples = await watchEdit('Face Bytes');
    expect(samples[0]).toMatchObject({ shown: true, loaded: true });
  });

  it('is built as soon as the canvas has the bytes, before any edit asks', async () => {
    await registerFont('Face Canvas', {}, metricsUrl, atlasUrl);
    registerFontOutlines('Face Canvas', {}, ttfUrl);
    const before = document.fonts.size;
    expect(await loadFontOutlines('Face Canvas')).toBe('ready');
    const added = [...document.fonts].slice(before);
    expect(added).toHaveLength(1);
    await added[0].loaded;
    const samples = await watchEdit('Face Canvas');
    expect(samples[0]).toMatchObject({ shown: true, loaded: true });
  });

  it('does not fetch a lazily registered file just for being registered', async () => {
    let asked = 0;
    await registerFont('Face Lazy', {}, metricsUrl, atlasUrl);
    const before = document.fonts.size;
    registerFontOutlines('Face Lazy', {}, () => { asked++; return ttf.slice(0); });
    await new Promise((r) => setTimeout(r, 50));
    expect(asked).toBe(0);
    expect(document.fonts.size).toBe(before);
  });

  it('shows the fallback after a short hold when the face is slow', async () => {
    await registerFont('Face Slow', {}, metricsUrl, atlasUrl);
    registerFontOutlines('Face Slow', {}, () => new Promise<ArrayBuffer>((r) => setTimeout(() => r(ttf.slice(0)), 2000)));
    const samples = await watchEdit('Face Slow');
    const first = samples.find((s) => s.shown);
    expect(first, 'the overlay showed').toBeDefined();
    expect(first!.at).toBeLessThan(1000);
    expect(first!.loaded).toBe(false);
  });
});
