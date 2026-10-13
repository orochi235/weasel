import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerFont, registerFontOutlines, subscribeGlyphReady } from '@weasel-js/font';
import {
  _resetFontRegistryForTests,
  _resetFallbackForTests,
  _resetDynamicFontsForTests,
  _resetFontOutlinesForTests,
} from '@weasel-js/font/test-seams';
import { layoutAndPaint } from './testing/layoutAndPaint';
import type { ResolvedRun } from '../runs/resolveRuns';
import { stubFetch, registerFixture } from './testing/fontFixtures';

beforeEach(() => {
  _resetFontRegistryForTests();
  stubFetch();
});

/**
 * The failure that reaches a consumer as an empty canvas. A run whose family
 * resolves to neither an atlas nor an outline face is skipped, and a skipped
 * run is indistinguishable downstream from empty text — so the only signal is
 * the one this warning emits.
 */
describe('layoutRuns — a family with no metrics at all', () => {
  const OPTS = { maxWidth: Infinity, lineHeight: 1.2, align: 'left' as const };

  const run = (text: string, fontFamily = 'never-registered'): ResolvedRun => ({
    text, fontFamily, fontSize: 32, fontWeight: 400, fontStyle: 'normal',
    fill: { paint: { kind: 'solid', color: '#000' } }, letterSpacing: 0,
    underline: false, strikethrough: false, overline: false, baselineShift: 0,
  });

  beforeEach(() => {
    _resetFontRegistryForTests();
    _resetFallbackForTests();
    _resetDynamicFontsForTests();
    _resetFontOutlinesForTests();
  });

  it('warns rather than laying out nothing in silence', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const out = layoutAndPaint([run('hello')], OPTS);

    expect(out.groups).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('no metrics for "never-registered"');
    warn.mockRestore();
  });

  // The duplicate-copy case is the one that costs an afternoon: the consumer
  // registered the face, into the other copy's registry.
  it('names the duplicated-font cause, which produces exactly this', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    layoutAndPaint([run('hello')], OPTS);
    expect(warn.mock.calls[0][0]).toContain('@weasel-js/font');
    warn.mockRestore();
  });

  it('warns once per family variant however many runs use it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    layoutAndPaint([run('a'), run('b'), run('c')], OPTS);
    layoutAndPaint([run('d')], OPTS);
    layoutAndPaint([run('e', 'also-missing')], OPTS);

    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('leaves it at one warning when the registry already said the face cannot render', async () => {
    // A family that is its own fallback and has no variant near the request.
    await registerFixture('lonely', [{ weight: 700, style: 'italic' }]);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    layoutAndPaint([run('hello', 'lonely')], OPTS);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('will not render at all');
    warn.mockRestore();
  });

  // apps/draw registers its atlas un-awaited so first paint is not gated on
  // it; that first paint must not report the face as unregistered.
  it('stays quiet while an atlas registration is still in flight', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const realFetch = global.fetch;
    global.fetch = vi.fn(() => new Promise<Response>(() => {})) as typeof fetch;

    void registerFont('pending-atlas', {}, '/p.json', '/p.png');
    layoutAndPaint([run('hello', 'pending-atlas')], OPTS);

    expect(warn).not.toHaveBeenCalled();
    global.fetch = realFetch;
    warn.mockRestore();
  });

  it('stays quiet while an outline face is still loading', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registerFontOutlines('pending-outline', {}, () => new Promise<ArrayBuffer>(() => {}));

    layoutAndPaint([run('hello', 'pending-outline')], OPTS);
    layoutAndPaint([run('hello', 'pending-outline')], OPTS);

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('warns once a pending registration fails, on the relayout its failure triggers', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const realFetch = global.fetch;
    let fail!: (err: Error) => void;
    global.fetch = vi.fn(() => new Promise<Response>((_, rej) => { fail = rej; })) as typeof fetch;
    const redraw = vi.fn();
    const unsubscribe = subscribeGlyphReady(redraw);

    const registration = registerFont('failing-atlas', {}, '/f.json', '/f.png').catch(() => {});
    layoutAndPaint([run('hello', 'failing-atlas')], OPTS);
    expect(warn).not.toHaveBeenCalled();

    fail(new Error('network down'));
    await registration;
    expect(redraw).toHaveBeenCalled();
    layoutAndPaint([run('hello', 'failing-atlas')], OPTS);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('no metrics for "failing-atlas"');
    unsubscribe();
    global.fetch = realFetch;
    warn.mockRestore();
  });
});
