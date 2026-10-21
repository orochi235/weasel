import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LensCapture } from '@weasel-js/labkit/loupe';
import { type Bitmap, endpoint, hosts, payload, request, revisions, settle, shown, stubBitmaps } from './pixels.fixture';
import { createPixelsSource, RECAPTURE_DEBOUNCE_MS } from './pixelsSource';
import type { TrialHit } from './trialAt';

const payloadFor = (hit: TrialHit) => payload(`story-of-${hit.trialId}`);

beforeEach(stubBitmaps);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('createPixelsSource', () => {
  it('debounces recapture to 250 ms while the reticle moves', async () => {
    vi.useFakeTimers();
    hosts();
    const { fetch, posts } = endpoint();
    const source = createPixelsSource({ base: '/', payloadFor, fetch, ...revisions() });
    const slot = document.createElement('div');
    const handle = source.attach(slot, request(50));
    await vi.advanceTimersByTimeAsync(0);
    // The first capture goes at once.
    expect(posts.map((p) => p.body.story)).toEqual(['story-of-trial-a']);
    expect(fetch).toHaveBeenCalledWith('/__forge/capture', expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'application/json' } }));
    posts[0]!.answer();
    await settle();
    expect(shown(slot)).toBe(true);

    // Moving within the trial changes only where the image is cropped: nothing to capture again.
    handle.update(request(60));
    await vi.advanceTimersByTimeAsync(RECAPTURE_DEBOUNCE_MS * 2);
    expect(posts).toHaveLength(1);

    // Crossing to the other trial and wandering there waits for the reticle to settle.
    handle.update(request(150));
    await vi.advanceTimersByTimeAsync(100);
    handle.update(request(160));
    await vi.advanceTimersByTimeAsync(100);
    handle.update(request(170));
    await vi.advanceTimersByTimeAsync(RECAPTURE_DEBOUNCE_MS - 1);
    expect(posts).toHaveLength(1);
    // The last image stays up meanwhile.
    expect(shown(slot)).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(posts.map((p) => p.body.story)).toEqual(['story-of-trial-a', 'story-of-trial-b']);
    handle.detach();
  });

  it('drops its last image on a revision bump', async () => {
    vi.useFakeTimers();
    hosts();
    const { fetch, posts } = endpoint();
    const rev = revisions();
    const source = createPixelsSource({ base: '/', payloadFor, fetch, ...rev });
    const slot = document.createElement('div');
    const handle = source.attach(slot, request(50));
    await vi.advanceTimersByTimeAsync(0);
    posts[0]!.answer();
    await settle();
    expect(shown(slot)).toBe(true);
    const before = await source.capture!(request(50));
    expect(((before as LensCapture).bitmap as unknown as Bitmap).from).toBe('png story-of-trial-a #1');
    expect(posts).toHaveLength(1);

    rev.bump();
    expect(shown(slot)).toBe(false);
    // The same payload is captured again rather than served from the lens's own copy.
    await vi.advanceTimersByTimeAsync(RECAPTURE_DEBOUNCE_MS);
    expect(posts).toHaveLength(2);
    expect(posts[1]!.body).toEqual(posts[0]!.body);
    posts[1]!.answer();
    await settle();
    expect(shown(slot)).toBe(true);
    const after = await source.capture!(request(50));
    expect(((after as LensCapture).bitmap as unknown as Bitmap).from).toBe('png story-of-trial-a #2');
    handle.detach();
  });

  it('never shows a capture that was taken before the story was edited', async () => {
    vi.useFakeTimers();
    hosts();
    const { fetch, posts } = endpoint();
    const rev = revisions();
    const source = createPixelsSource({ base: '/', payloadFor, fetch, ...rev });
    const slot = document.createElement('div');
    const handle = source.attach(slot, request(50));
    await vi.advanceTimersByTimeAsync(0);
    expect(posts).toHaveLength(1);

    // The edit lands while the first capture is still being taken.
    rev.bump();
    posts[0]!.answer();
    await settle();
    expect(shown(slot)).toBe(false);
    await vi.advanceTimersByTimeAsync(RECAPTURE_DEBOUNCE_MS);
    expect(posts).toHaveLength(2);
    posts[1]!.answer();
    await settle();
    expect(shown(slot)).toBe(true);
    const shot = await source.capture!(request(50));
    expect(((shot as LensCapture).bitmap as unknown as Bitmap).from).toBe('png story-of-trial-a #2');
    handle.detach();
  });

  it("says why a lens cannot show its trial, as the payload names it", async () => {
    hosts();
    const { fetch, posts } = endpoint();
    const source = createPixelsSource({
      base: '/',
      payloadFor: () => ({ unavailable: "this story's state cannot be sent to a capture" }),
      fetch,
      ...revisions(),
    });
    const slot = document.createElement('div');
    const handle = source.attach(slot, request(50));
    expect(slot.textContent).toBe("Pixels unavailable: this story's state cannot be sent to a capture");
    expect(posts).toHaveLength(0);
    expect(shown(slot)).toBe(false);
    handle.detach();
  });

  it("reports the endpoint's answer as its status, asking again on subscribe", async () => {
    const answers = [{ available: false, reason: 'install playwright' }, { available: true }];
    const fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => answers.shift() }) as unknown as Response);
    const source = createPixelsSource({ base: '/base/', payloadFor, fetch, ...revisions() });
    const changed = vi.fn();
    const off = source.subscribe(changed);
    await vi.waitFor(() => expect(source.status()).toBe('install playwright'));
    off();
    source.subscribe(changed);
    await vi.waitFor(() => expect(source.status()).toBe(true));
    expect(fetch).toHaveBeenCalledWith('/base/__forge/capture');
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('says the server takes no captures where nothing answers at the endpoint, as in a built workshop', async () => {
    const fetch = vi.fn(async () => ({ ok: false, status: 404, json: async () => Promise.reject(new SyntaxError('not JSON')) }) as unknown as Response);
    const source = createPixelsSource({ base: '/', payloadFor, fetch, ...revisions() });
    source.subscribe(() => {});
    await vi.waitFor(() => expect(source.status()).toBe('this server takes no captures'));
  });
});
