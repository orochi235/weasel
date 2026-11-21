import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LensCapture } from '@weasel-js/labkit/loupe';
import { type Bitmap, closed, endpoint, hosts, payload, request, revisions, settle, shown, stubBitmaps } from './pixels.fixture';
import { LENS_REST_MS } from '@weasel-js/labkit/loupe';
import { createPixelsSource, LOOSE_SHOTS } from './pixelsSource';
import type { TrialHit } from './trialAt';

const payloadFor = (hit: TrialHit) => payload(`story-of-${hit.trialId}`);

beforeEach(stubBitmaps);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('createPixelsSource', () => {
  it("labels a lens with the DPR its capture is taken at, a DPR comparison's own included", () => {
    const source = createPixelsSource({ base: '/', payloadFor, fetch: endpoint().fetch, ...revisions() });
    expect(source.label({ ...request(50), dpr: 2 })).toBe('Pixels 2×');
    expect(source.label({ ...request(50), dpr: 1, conditions: { kind: 'custom', dpr: 3 } })).toBe('Pixels 3×');
    expect(source.label({ ...request(50), dpr: 2, conditions: { kind: 'opposite-mode' } })).toBe('Pixels 2×');
  });

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
    await vi.advanceTimersByTimeAsync(LENS_REST_MS * 2);
    expect(posts).toHaveLength(1);

    // Crossing to the other trial and wandering there waits for the reticle to settle.
    handle.update(request(150));
    await vi.advanceTimersByTimeAsync(100);
    handle.update(request(160));
    await vi.advanceTimersByTimeAsync(100);
    handle.update(request(170));
    await vi.advanceTimersByTimeAsync(LENS_REST_MS - 1);
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
    await vi.advanceTimersByTimeAsync(LENS_REST_MS);
    expect(posts).toHaveLength(2);
    expect(posts[1]!.body).toEqual(posts[0]!.body);
    posts[1]!.answer();
    await settle();
    expect(shown(slot)).toBe(true);
    const after = await source.capture!(request(50));
    expect(((after as LensCapture).bitmap as unknown as Bitmap).from).toBe('png story-of-trial-a #2');
    handle.detach();
  });

  it('captures again when the host under it is resized, with no window resize to say so', async () => {
    vi.useFakeTimers();
    const observers: { fn: () => void; watched: Set<Element> }[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        watched = new Set<Element>();
        constructor(public fn: () => void) {
          observers.push(this);
        }
        observe(el: Element) {
          this.watched.add(el);
        }
        unobserve(el: Element) {
          this.watched.delete(el);
        }
        disconnect() {}
      },
    );
    const host = document.body.appendChild(document.createElement('div'));
    host.dataset.fgHost = 'trial-a';
    let width = 100;
    Object.defineProperty(host, 'offsetWidth', { configurable: true, get: () => width });
    document.elementsFromPoint = () => [host];
    const { fetch, posts } = endpoint();
    const sized = (hit: TrialHit) => ({ ...payload('s'), box: { width: hit.width, height: 100 } });
    const source = createPixelsSource({ base: '/', payloadFor: sized, fetch, ...revisions() });
    const handle = source.attach(document.createElement('div'), request(50));
    await vi.advanceTimersByTimeAsync(0);
    posts[0]!.answer();
    await settle();
    width = 300;
    for (const o of observers) if (o.watched.has(host)) o.fn();
    await vi.advanceTimersByTimeAsync(LENS_REST_MS);
    expect(posts.map((p) => p.body.box.width)).toEqual([100, 300]);
    handle.detach();
    expect(observers.some((o) => o.watched.has(host))).toBe(false);
  });

  it('keeps a bounded number of shots for lenses that capture without attaching, as Difference does', async () => {
    hosts();
    const { fetch, posts } = endpoint();
    const source = createPixelsSource({ base: '/', payloadFor, fetch, ...revisions() });
    const take = async (lensId: string) => {
      const got = source.capture!({ ...request(50), lensId });
      await settle();
      posts.at(-1)!.answer();
      return got;
    };
    await take('lens-0');
    // Asked again, the first lens's shot is served from the map.
    await source.capture!({ ...request(50), lensId: 'lens-0' });
    expect(posts).toHaveLength(1);
    for (let n = 1; n <= LOOSE_SHOTS; n += 1) await take(`lens-${n}`);
    expect(posts).toHaveLength(LOOSE_SHOTS + 1);
    // Past the bound, the longest unwritten side is gone, and asking for it captures again.
    const again = source.capture!({ ...request(50), lensId: 'lens-0' });
    await settle();
    expect(posts).toHaveLength(LOOSE_SHOTS + 2);
    posts.at(-1)!.answer();
    await again;
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
    expect(closed).toEqual(['png story-of-trial-a #1']);
    await vi.advanceTimersByTimeAsync(LENS_REST_MS);
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

  describe('closes each bitmap it lets go of, once, and none it still holds', () => {
    const from = (got: LensCapture | { reason: string }) => ((got as LensCapture).bitmap as unknown as Bitmap).from;
    const once = () => expect(new Set(closed).size).toBe(closed.length);

    it('on a capture that replaces its side, past the loose bound, and when a loose shot goes stale', async () => {
      hosts();
      const { fetch, posts } = endpoint();
      const rev = revisions();
      const source = createPixelsSource({ base: '/', payloadFor, fetch, ...rev });
      const take = async (r: ReturnType<typeof request>) => {
        const got = source.capture!(r);
        await settle();
        posts.at(-1)!.answer();
        return got;
      };
      const first = await take(request(50));
      const second = await take(request(150));
      expect(from(first)).toBe('png story-of-trial-a #1');
      expect(closed).toEqual(['png story-of-trial-a #1']);
      // Served from the map, the held shot is handed out again and left open.
      expect(from(await source.capture!(request(150)))).toBe(from(second));
      expect(closed).toEqual(['png story-of-trial-a #1']);

      // A shot taken before an edit goes at the next write; with no lens attached, nothing else drops it.
      rev.bump();
      await take({ ...request(50), lensId: 'lens-1' });
      expect(closed).toEqual(['png story-of-trial-a #1', 'png story-of-trial-b #2']);

      for (let n = 2; n <= LOOSE_SHOTS + 1; n += 1) await take({ ...request(50), lensId: `lens-${n}` });
      // Past the bound, the longest unwritten side (lens-1's, #3) is the one closed.
      expect(closed).toEqual(['png story-of-trial-a #1', 'png story-of-trial-b #2', 'png story-of-trial-a #3']);
      once();
    });

    it("on a lens's newer capture, a story edit, and a detach, but not while another lens shows the side", async () => {
      vi.useFakeTimers();
      hosts();
      const { fetch, posts } = endpoint();
      const rev = revisions();
      const source = createPixelsSource({ base: '/', payloadFor, fetch, ...rev });
      const handle = source.attach(document.createElement('div'), request(50));
      await vi.advanceTimersByTimeAsync(0);
      posts[0]!.answer();
      await settle();
      handle.update(request(150));
      await vi.advanceTimersByTimeAsync(LENS_REST_MS);
      posts[1]!.answer();
      await settle();
      expect(closed).toEqual(['png story-of-trial-a #1']);

      // An edit closes the lens's shot and a loose one alike.
      const loose = source.capture!({ ...request(50), lensId: 'lens-9' });
      await settle();
      posts[2]!.answer();
      await loose;
      rev.bump();
      expect(closed).toEqual(['png story-of-trial-a #1', 'png story-of-trial-b #2', 'png story-of-trial-a #3']);

      await vi.advanceTimersByTimeAsync(LENS_REST_MS);
      posts[3]!.answer();
      await settle();
      // A second lens on the same side keeps the shot through the first one's detach; the last detach closes it.
      const twin = source.attach(document.createElement('div'), request(150));
      handle.detach();
      expect(closed).toHaveLength(3);
      twin.detach();
      expect(closed.at(-1)).toBe('png story-of-trial-b #4');
      once();
    });
  });
});
