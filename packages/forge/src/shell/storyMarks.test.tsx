import { TrialIdContext } from '@weasel-js/labkit';
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { meta, story } from '../story/define';
import { loadNativeModule } from '../story/native';
import { documentInstrument } from './documentInstrument';
import { createStoryHosts, StoryHostsContext } from './storyHosts';
import { captureHost, storyMarks } from './storyMarks';
import { storyInstrument } from './storyInstrument';
import { createAnswerBook } from './answers';
import { TrialHost } from './TrialHost';

const parse = (markup: string) => new DOMParser().parseFromString(markup, 'image/svg+xml');

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanups.splice(0)) fn();
});

function sized(el: HTMLElement, width: number, height: number) {
  Object.defineProperty(el, 'offsetWidth', { configurable: true, value: width });
  Object.defineProperty(el, 'offsetHeight', { configurable: true, value: height });
}

/** A host of `width × height` whose scroller holds `content`, scrolled down by `top`. */
function scrolled(width: number, height: number, content: { width: number; height: number; top: number }) {
  const host = document.createElement('div');
  host.className = 'fg-story';
  sized(host, width, height);
  const scroller = document.createElement('div');
  scroller.className = 'fg-story__scroll';
  Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: content.width });
  Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: content.height });
  scroller.scrollTop = content.top;
  host.append(scroller);
  return host;
}

const loaded = loadNativeModule({ default: meta({ title: 'Test/Shape' }), Shape: story({ render: () => <p>hello</p> }) }, 'Test/Auto')[0]!;
const entry = { id: loaded.id, title: 'Test/Shape', name: 'Shape', exportName: 'Shape', file: '/shape.stories.tsx' };

describe('storyMarks', () => {
  it("declares the trial's story host as its one target, sized by the host's layout box", () => {
    const hosts = createStoryHosts();
    const host = document.createElement('div');
    sized(host, 320, 200);
    hosts.attach('t1', host);
    const targets = storyMarks(hosts).targets(null, {}, { id: 't1', view: null });
    expect(targets).toHaveLength(1);
    expect(targets[0]?.id).toBe('story');
    expect(targets[0]?.ref).toBe(hosts.ref('t1'));
    expect(targets[0]?.content).toEqual({ w: 320, h: 200 });
  });

  it('keeps a positive content box before the host attaches, and the same ref after', () => {
    const hosts = createStoryHosts();
    const capability = storyMarks(hosts);
    const before = capability.targets(null, {}, { id: 't2', view: null })[0]!;
    expect(before.content).toEqual({ w: 1, h: 1 });
    const host = document.createElement('div');
    hosts.attach('t2', host);
    expect(before.ref.current).toBe(host);
  });

  it('places the host in the content its scroller scrolls, which is the content box', () => {
    const hosts = createStoryHosts();
    const host = scrolled(320, 200, { width: 320, height: 900, top: 150 });
    hosts.attach('t5', host);
    const target = storyMarks(hosts).targets(null, {}, { id: 't5', view: null })[0]!;
    expect(target.content).toEqual({ w: 320, h: 900 });
    expect(target.shown).toEqual({ x: 0, y: 150, w: 320, h: 200 });
  });

  it('exports the marks over a capture of the host', async () => {
    const hosts = createStoryHosts();
    const host = document.createElement('div');
    host.innerHTML = '<p>first<br>second</p>';
    document.body.append(host);
    cleanups.push(() => host.remove());
    hosts.attach('t3', host);
    const base = await storyMarks(hosts).targets(null, {}, { id: 't3', view: null })[0]!.base!();
    expect(base.kind).toBe('svg');
    if (base.kind !== 'svg') throw new Error('not svg');
    expect(parse(base.markup).documentElement.textContent).toContain('second');
  });
});

describe('captureHost', () => {
  it('wraps the host in a foreignObject that parses as XML', () => {
    const host = document.createElement('div');
    host.innerHTML = '<p>first<br>second</p>';
    document.body.append(host);
    cleanups.push(() => host.remove());
    const doc = parse(captureHost(host).markup);
    // An unclosed `<br>` is what an HTML serialization would have left behind.
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(doc.documentElement.localName).toBe('svg');
    expect(doc.getElementsByTagName('foreignObject')).toHaveLength(1);
  });

  it('pictures the whole scrolled content, sizing the copy of the host to it', () => {
    const host = scrolled(320, 200, { width: 320, height: 900, top: 150 });
    document.body.append(host);
    cleanups.push(() => host.remove());
    const doc = parse(captureHost(host).markup);
    expect(doc.documentElement.getAttribute('height')).toBe('900');
    expect(doc.documentElement.getAttribute('viewBox')).toBe('0 0 320 900');
    expect(doc.getElementsByTagName('style')[0]?.textContent).toContain(
      '[data-fg-capture] > .fg-story{width:320px;height:900px}',
    );
  });

  it('pictures a host still pending its first paint, which would otherwise draw at opacity 0', () => {
    const host = scrolled(320, 200, { width: 320, height: 200, top: 0 });
    host.setAttribute('data-pending', '');
    document.body.append(host);
    cleanups.push(() => host.remove());
    const copy = parse(captureHost(host).markup).querySelector('.fg-story');
    expect(copy).not.toBeNull();
    expect(copy?.hasAttribute('data-pending')).toBe(false);
    expect(host.hasAttribute('data-pending')).toBe(true);
  });

  it("restates the custom properties as they resolve on the host, which no :root rule reaches", () => {
    const sheet = document.createElement('style');
    sheet.textContent = ':root{--fg-probe:#123456}.probe{color:var(--fg-probe)}';
    document.head.append(sheet);
    const host = document.createElement('div');
    host.innerHTML = '<span class="probe">x</span>';
    document.body.append(host);
    cleanups.push(() => {
      host.remove();
      sheet.remove();
    });
    const markup = captureHost(host).markup;
    expect(markup).toContain('[data-fg-capture]{');
    expect(markup).toContain('--fg-probe: #123456;');
  });
});

describe('which trials take marks', () => {
  it('is a story or index page rendered in the document, given the hosts', () => {
    const hosts = createStoryHosts();
    expect(documentInstrument({ entry, loaded: { kind: 'story', story: loaded }, setup: {}, hosts }).annotations).toBeDefined();
    expect(documentInstrument({ entry, loaded: { kind: 'story', story: loaded }, setup: {} }).annotations).toBeUndefined();
  });

  it('is never an isolated story, whose frame path gets no new features', () => {
    const instrument = storyInstrument({ entry, answers: createAnswerBook(), frameUrl: '/frame.html', onReady: () => {} });
    expect(instrument.annotations).toBeUndefined();
  });
});

describe('TrialHost', () => {
  it("attaches its element as its trial's story host, and a copy attaches nothing", () => {
    const hosts = createStoryHosts();
    const { container, unmount } = render(
      <StoryHostsContext.Provider value={hosts}>
        <TrialIdContext.Provider value="t4">
          <TrialHost layout="padded" setup={{}} config={{}}>
            {() => null}
          </TrialHost>
          <TrialHost layout="padded" setup={{}} config={{}} copy={{ id: 'copy-1', globals: {} }}>
            {() => null}
          </TrialHost>
        </TrialIdContext.Provider>
      </StoryHostsContext.Provider>,
    );
    const host = container.querySelector<HTMLElement>('.fg-story:not([data-fg-copy])');
    expect(hosts.ref('t4').current).toBe(host);
    unmount();
    expect(hosts.ref('t4').current).toBeNull();
  });

  /** An IntersectionObserver that always reports its element far from the viewport. */
  class FarObserver {
    constructor(private readonly report: IntersectionObserverCallback) {}
    observe(el: Element) {
      const entry = { target: el, isIntersecting: false, rootBounds: null } as unknown as IntersectionObserverEntry;
      this.report([entry], this as unknown as IntersectionObserver);
    }
    unobserve() {}
    disconnect() {}
  }

  it('renders a story out of view for an export of its marks, and unmounts it again after', async () => {
    const real = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = FarObserver as unknown as typeof IntersectionObserver;
    cleanups.push(() => {
      globalThis.IntersectionObserver = real;
    });
    const hosts = createStoryHosts();
    const { container, unmount } = render(
      <StoryHostsContext.Provider value={hosts}>
        <TrialIdContext.Provider value="t6">
          <TrialHost layout="padded" setup={{}} config={{}}>
            {() => <p>far away</p>}
          </TrialHost>
        </TrialIdContext.Provider>
      </StoryHostsContext.Provider>,
    );
    cleanups.push(unmount);
    await waitFor(() => expect(container.textContent).toBe(''));
    const base = await storyMarks(hosts).targets(null, {}, { id: 't6', view: null })[0]!.base!();
    if (base.kind !== 'svg') throw new Error('not svg');
    expect(parse(base.markup).documentElement.textContent).toContain('far away');
    await waitFor(() => expect(container.textContent).toBe(''));
  });
});
