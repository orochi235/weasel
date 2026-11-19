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
    ['a timeout that runs out', () => { setTimeout(noop, 60_000); return noop; }],
    ['a cleared interval', () => { const id = setInterval(noop, 10); return () => clearInterval(id); }],
    ['a canceled frame', () => { const id = requestAnimationFrame(noop); return () => cancelAnimationFrame(id); }],
    ['a disconnected observer', () => { const o = new ResizeObserver(noop); o.observe(document.body); return () => o.disconnect(); }],
    ['a removed media listener', () => { const q = matchMedia('(x)'); q.addListener(noop); return () => q.removeListener(noop); }],
  ])('passes %s', (_, clean) => {
    expect(leftBy(clean)).toEqual([]);
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
