import { useEffect, type ReactElement } from 'react';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { grownSince, installLeakProbe, type LeakKind, type LeakProbe } from './leakProbe';

let probe: LeakProbe;
beforeEach(() => {
  probe = installLeakProbe();
});
afterEach(() => probe.restore());

const noop = () => {};

/** Renders `ui` into a host of its own and unmounts it, taking the host (and React's root listeners) out after. */
function mountAndUnmount(ui: ReactElement): void {
  const host = document.body.appendChild(document.createElement('div'));
  render(ui, { container: host }).unmount();
  host.remove();
}

/** Mounts an effect, unmounts it, flushes, and names the kinds left grown. */
function leftBy(effect: () => void | (() => void)): LeakKind[] {
  function Host() {
    useEffect(effect, []);
    return <div />;
  }
  const before = probe.live();
  mountAndUnmount(<Host />);
  probe.flush();
  return grownSince(before, probe.live()).map((line) => line.split(' ')[0] as LeakKind);
}

describe('installLeakProbe', () => {
  it.each<[LeakKind, () => void]>([
    ['listener', () => window.addEventListener('resize', noop)],
    ['listener', () => document.body.addEventListener('click', noop, true)],
    ['interval', () => { setInterval(noop, 1000); }],
    ['timeout', () => { const again = () => setTimeout(again, 10); again(); }],
    ['frame', () => { const again = () => requestAnimationFrame(again); again(); }],
    ['resize', () => new ResizeObserver(noop).observe(document.body)],
    ['intersection', () => new IntersectionObserver(noop).observe(document.body)],
    ['mutation', () => new MutationObserver(noop).observe(document, { childList: true })],
    ['media', () => matchMedia('(min-width: 1px)').addEventListener('change', noop)],
  ])('counts a %s left behind', (kind, leak) => {
    expect(leftBy(leak)).toEqual([kind]);
  });

  it.each<[string, () => () => void]>([
    ['a removed listener', () => { window.addEventListener('resize', noop); return () => window.removeEventListener('resize', noop); }],
    ['a once listener that fired', () => { window.addEventListener('blur', noop, { once: true }); window.dispatchEvent(new Event('blur')); return noop; }],
    ['an aborted listener', () => { const ac = new AbortController(); window.addEventListener('resize', noop, { signal: ac.signal }); return () => ac.abort(); }],
    ['a listener added with an aborted signal', () => { window.addEventListener('resize', noop, { signal: AbortSignal.abort() }); return noop; }],
    ['a once listener that stopped the event', () => {
      window.addEventListener('blur', (e) => e.stopImmediatePropagation(), { once: true });
      window.dispatchEvent(new Event('blur'));
      return noop;
    }],
    ['a timeout that runs out', () => { setTimeout(noop, 60_000); return noop; }],
    ['a cleared interval', () => { const id = setInterval(noop, 10); return () => clearInterval(id); }],
    ['an interval cleared by clearTimeout', () => { const id = setInterval(noop, 10); return () => clearTimeout(id); }],
    ['a canceled frame', () => { const id = requestAnimationFrame(noop); return () => cancelAnimationFrame(id); }],
    ['a disconnected observer', () => { const o = new ResizeObserver(noop); o.observe(document.body); return () => o.disconnect(); }],
    ['a removed media listener', () => { const q = matchMedia('(x)'); q.addListener(noop); return () => q.removeListener(noop); }],
  ])('passes %s', (_, clean) => {
    expect(leftBy(clean)).toEqual([]);
  });

  it('counts a listener added on window, which a jsdom environment also binds onto the global scope', () => {
    const before = probe.live().length;
    window.addEventListener('resize', noop);
    expect(probe.live().length).toBe(before + 1);
    window.removeEventListener('resize', noop);
    expect(probe.live().length).toBe(before);
  });

  it('passes a once listener on an element that stopped the event', () => {
    expect(leftBy(() => {
      document.body.addEventListener('click', (e) => e.stopImmediatePropagation(), { once: true });
      document.body.dispatchEvent(new Event('click'));
    })).toEqual([]);
  });

  it('passes a listener on an element given an already-aborted signal', () => {
    expect(leftBy(() => { document.body.addEventListener('click', noop, { signal: AbortSignal.abort() }); })).toEqual([]);
  });

  it('passes a listener on an element whose signal aborts', () => {
    expect(leftBy(() => {
      const ac = new AbortController();
      document.body.addEventListener('click', noop, { signal: ac.signal });
      return () => ac.abort();
    })).toEqual([]);
  });

  it('passes a listener on an element the unmount took out of the document', () => {
    function Host() {
      return <div ref={(el) => el?.addEventListener('click', noop)} />;
    }
    const before = probe.live();
    mountAndUnmount(<Host />);
    expect(grownSince(before, probe.live())).toEqual([]);
  });
});
