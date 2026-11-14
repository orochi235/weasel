import { describe, expect, it } from 'vitest';
import { act, screen } from '@testing-library/react';
import { renderWithIcons } from '../../../testing/withIcons';
import type { ReactElement, ReactNode } from 'react';
import { Disabled, ReadOnly, type HoldProps } from '..';

/** One mounted control, as the shared hold cases drive it. */
export interface HeldMount {
  /** Every element that takes focus. */
  targets(): HTMLElement[];
  /** Those that say the reason; default `targets()`. */
  described?(): HTMLElement[];
  /** Every input path that would change the value: drags, key steps, presses, context-menu edits. */
  tryAll(): void;
  /** Whether any of them reached the control's callbacks. */
  changed(): boolean;
}

/** A control under test: it hands `mount` the control with `own`, its own hold props, spread on. */
export type HoldSubject = (mount: (node: ReactElement) => void, own: HoldProps) => HeldMount;

/** Whether focus can reach `el`: not natively disabled, not out of the tab order, not inside an inert subtree. */
function reachable(el: HTMLElement): boolean {
  if ((el as HTMLButtonElement).disabled) return false;
  if (el.getAttribute('tabindex') === '-1') return false;
  return el.closest('[inert]') === null;
}

function run(subject: HoldSubject, wrap: (node: ReactNode) => ReactNode, own: HoldProps = {}): HeldMount {
  return subject((node) => { renderWithIcons(<>{wrap(node)}</>); }, own);
}

const bare = (n: ReactNode) => n;

/**
 * The cases every held control answers alike: an unheld one takes every input; disabled with no reason refuses them
 * and leaves the tab order; disabled for a reason, or read-only, refuses them, stays reachable, and says why; and
 * nested scopes hold it with the nearest reason.
 */
export function describeHold(
  name: string,
  subject: HoldSubject,
  /** Whether each target carries `aria-disabled` or `aria-readonly` itself; a React Aria field says so its own way. */
  { ariaHeld = true }: { ariaHeld?: boolean } = {},
): void {
  describe(`${name} held`, () => {
    it('unheld, takes its input and is reachable', () => {
      const m = run(subject, bare);
      expect(m.targets().length).toBeGreaterThan(0);
      expect(m.targets().some(reachable)).toBe(true);
      for (const t of m.targets()) expect(t.hasAttribute('aria-disabled')).toBe(false);
      m.tryAll();
      expect(m.changed()).toBe(true);
    });

    it('disabled with no reason refuses its input and leaves the tab order', () => {
      const m = run(subject, bare, { disabled: true });
      m.tryAll();
      expect(m.changed()).toBe(false);
      for (const t of m.targets()) expect(reachable(t)).toBe(false);
    });

    it('disabled for a reason refuses its input, stays reachable, and says why', () => {
      const m = run(subject, bare, { disabled: true, disabledReason: 'Nothing selected' });
      m.tryAll();
      expect(m.changed()).toBe(false);
      if (ariaHeld) for (const t of m.targets()) expect(t.getAttribute('aria-disabled')).toBe('true');
      expect(m.targets().some(reachable)).toBe(true);
      const described = m.described?.() ?? m.targets();
      for (const t of described) expect(t).toHaveAccessibleDescription('Nothing selected');
      act(() => described[0]!.focus());
      expect(screen.getByRole('tooltip').textContent).toBe('Nothing selected');
    });

    it('read-only refuses its input, stays reachable, and says why', () => {
      const m = run(subject, (n) => <ReadOnly reason="Shared">{n}</ReadOnly>);
      m.tryAll();
      expect(m.changed()).toBe(false);
      expect(m.targets().some(reachable)).toBe(true);
      if (ariaHeld) for (const t of m.targets()) expect(t.getAttribute('aria-readonly')).toBe('true');
      for (const t of m.described?.() ?? m.targets()) expect(t).toHaveAccessibleDescription('Shared');
    });

    it('nested scopes hold it, the nearest reason wins, and disabled={false} adds nothing', () => {
      const m = run(subject, (n) => <Disabled reason="Locked"><Disabled reason="Busy">{n}</Disabled></Disabled>, { disabled: false });
      m.tryAll();
      expect(m.changed()).toBe(false);
      for (const t of m.described?.() ?? m.targets()) expect(t).toHaveAccessibleDescription('Busy');
    });
  });
}

/** Fires `fire` at `el` unless it is natively disabled: what a test cannot trust jsdom to refuse the way a browser does. */
export function unlessDisabled(el: HTMLElement, fire: (el: HTMLElement) => void): void {
  if (!(el as HTMLButtonElement).disabled) fire(el);
}
