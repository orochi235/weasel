import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { pickActiveSection, useScrollSpy } from './useScrollSpy';

describe('pickActiveSection', () => {
  it('is null before the first section reaches the top', () => {
    expect(pickActiveSection([{ id: 'a', top: 120 }, { id: 'b', top: 400 }])).toBeNull();
  });

  it('is the last section whose top has passed', () => {
    expect(
      pickActiveSection([{ id: 'a', top: -300 }, { id: 'b', top: -40 }, { id: 'c', top: 260 }]),
    ).toBe('b');
  });

  it('counts a heading flush with the top as arrived, within the slack', () => {
    expect(pickActiveSection([{ id: 'a', top: 6 }], 8)).toBe('a');
    expect(pickActiveSection([{ id: 'a', top: 9 }], 8)).toBeNull();
  });

  it('is null with nothing to observe', () => {
    expect(pickActiveSection([])).toBeNull();
  });

  it('stops at the first section still below the fold rather than scanning past it', () => {
    // Offsets arrive in document order; a later one being negative would mean
    // the measurement is wrong, and taking it would hide that.
    expect(
      pickActiveSection([{ id: 'a', top: -10 }, { id: 'b', top: 500 }, { id: 'c', top: -999 }]),
    ).toBe('a');
  });
});

/**
 * jsdom has no layout: every `getBoundingClientRect` is zero, so a spy that
 * works and a spy that never recomputes agree on every answer it can give.
 * These assert the wiring — that the hook subscribes to the container it was
 * given, and unsubscribes — as a **proxy** for the behavior. What the reader
 * sees is covered by the forge story and the rail's visual baseline.
 */
describe('useScrollSpy wiring (proxy assertions)', () => {
  function Harness({ onRoot }: { onRoot: (el: HTMLDivElement) => void }) {
    const ref = useRef<HTMLDivElement | null>(null);
    useScrollSpy({ rootRef: ref, ids: ['one', 'two'] });
    return (
      <div
        ref={(el) => {
          ref.current = el;
          // The ref callback runs before effects, so a spy installed here sees
          // the hook's own subscription. A spy on HTMLElement.prototype does
          // not work: something else in a React tree listens for scroll too,
          // and the assertion passes with this hook deleted entirely.
          if (el) onRoot(el);
        }}
      >
        <section data-spy-section="one" />
        <section data-spy-section="two" />
      </div>
    );
  }

  function renderSpied() {
    const added: string[] = [];
    const removed: string[] = [];
    const view = render(
      <Harness
        onRoot={(el) => {
          const add = el.addEventListener.bind(el);
          const remove = el.removeEventListener.bind(el);
          el.addEventListener = ((type: string, ...rest: unknown[]) => {
            added.push(type);
            return (add as (...a: unknown[]) => void)(type, ...rest);
          }) as typeof el.addEventListener;
          el.removeEventListener = ((type: string, ...rest: unknown[]) => {
            removed.push(type);
            return (remove as (...a: unknown[]) => void)(type, ...rest);
          }) as typeof el.removeEventListener;
        }}
      />,
    );
    return { view, added, removed };
  }

  it('listens to the container it was given, and stops when unmounted', () => {
    const { view, added, removed } = renderSpied();
    expect(added).toContain('scroll');
    view.unmount();
    expect(removed).toContain('scroll');
  });
});

describe('useScrollSpy scrollTo', () => {
  function Probe() {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const spy = useScrollSpy({ rootRef, ids: ['a'] });
    return (
      <div ref={rootRef}>
        <section data-spy-section="a" />
        <output>{spy.active ?? 'none'}</output>
        <button type="button" onClick={() => spy.scrollTo('gone')}>go</button>
      </div>
    );
  }

  it('does not report a section it was asked for and could not find', () => {
    const view = render(<Probe />);
    const before = screen.getByRole('status').textContent;
    act(() => screen.getByRole('button').click());
    expect(screen.getByRole('status').textContent).toBe(before);
    view.unmount();
  });

  function Held() {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const spy = useScrollSpy({ rootRef, ids: ['a', 'b'] });
    return (
      <div ref={rootRef} data-testid="root">
        <section data-spy-section="a" />
        <section data-spy-section="b" ref={(el) => { if (el) el.getBoundingClientRect = () => ({ top: 500 }) as DOMRect; }} />
        <output>{spy.active ?? 'none'}</output>
        <button type="button" onClick={() => spy.scrollTo('b')}>go</button>
      </div>
    );
  }

  // jsdom lays nothing out, so `b` is pinned 500px down: whenever the spy measures, it answers `a`.
  it('holds the section it was sent to while the container is still scrolling, however long that takes', () => {
    vi.useFakeTimers();
    const view = render(<Held />);
    const root = screen.getByTestId('root');
    const active = () => screen.getByRole('status').textContent;
    act(() => screen.getByRole('button').click());
    expect(active()).toBe('b');
    for (let i = 0; i < 4; i++) {
      act(() => {
        vi.advanceTimersByTime(400);
        root.dispatchEvent(new Event('scroll'));
      });
    }
    expect(active()).toBe('b');
    act(() => void vi.advanceTimersByTime(2000));
    expect(active()).toBe('a');
    view.unmount();
    vi.useRealTimers();
  });

  it('lets go of the held section when the scroll ends', () => {
    const view = render(<Held />);
    act(() => screen.getByRole('button').click());
    expect(screen.getByRole('status').textContent).toBe('b');
    act(() => void screen.getByTestId('root').dispatchEvent(new Event('scrollend')));
    expect(screen.getByRole('status').textContent).toBe('a');
    view.unmount();
  });
});
