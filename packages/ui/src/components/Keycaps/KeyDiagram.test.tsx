import { act, cleanup, fireEvent, renderHook } from '@testing-library/react';
import { renderWithIcons as render } from '../../testing/withIcons';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeyDiagram } from './KeyDiagram';
import { KEYBOARD_LAYOUTS } from './keyboardLayout';
import { useHeldKeys } from './useHeldKeys';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const slot = (root: HTMLElement, code: string) => root.querySelector<HTMLElement>(`[data-code="${code}"]`);

describe('KeyDiagram', () => {
  it('draws every key of a layout, grouped into its banks, in the platform\'s legends', () => {
    const { container } = render(<KeyDiagram layout={KEYBOARD_LAYOUTS.windows} />);
    expect(container.querySelectorAll('kbd')).toHaveLength(87);
    expect(slot(container, 'MetaLeft')!.textContent).toBe('⊞');
    expect(slot(container, 'Escape')!.textContent).toBe('Esc');
  });

  it('draws only the keys asked for', () => {
    const { container } = render(<KeyDiagram layout={KEYBOARD_LAYOUTS.macos} keys={['KeyW', 'KeyA', 'KeyS', 'KeyD']} />);
    expect([...container.querySelectorAll('[data-code]')].map((e) => e.getAttribute('data-code'))).toEqual(['KeyW', 'KeyA', 'KeyS', 'KeyD']);
  });

  it('draws the keys in a row without a layout, taking a label of their own', () => {
    const { container } = render(<KeyDiagram keys={['Escape', { code: 'KeyZ', label: 'Undo' }]} platform="macos" />);
    expect([...container.querySelectorAll('kbd')].map((k) => k.textContent)).toEqual(['⎋', 'Undo']);
  });

  it('lights the keys held, and marks the keys it is given', () => {
    const { container } = render(
      <KeyDiagram
        layout={KEYBOARD_LAYOUTS.macos}
        held={new Set(['KeyW'])}
        marks={{ KeyW: { caption: 'fwd', tint: 'red' }, KeyF: { dimmed: true } }}
      />,
    );
    expect(slot(container, 'KeyW')!.dataset).toMatchObject({ held: 'true', tinted: 'true' });
    expect(slot(container, 'KeyW')!.textContent).toBe('Wfwd');
    expect(slot(container, 'KeyF')!.dataset.dimmed).toBe('true');
    expect(slot(container, 'KeyS')!.dataset.held).toBeUndefined();
  });

  it('with a linger, is up only while a key is held and that long after', () => {
    vi.useFakeTimers();
    const root = (c: HTMLElement) => c.firstElementChild as HTMLElement;
    const { container, rerender } = render(<KeyDiagram layout={KEYBOARD_LAYOUTS.macos} linger={2} />);
    expect(root(container).dataset.up).toBeUndefined();
    rerender(<KeyDiagram layout={KEYBOARD_LAYOUTS.macos} linger={2} held={new Set(['KeyA'])} />);
    expect(root(container).dataset.up).toBe('true');
    rerender(<KeyDiagram layout={KEYBOARD_LAYOUTS.macos} linger={2} />);
    act(() => vi.advanceTimersByTime(1900));
    expect(root(container).dataset.up).toBe('true');
    act(() => vi.advanceTimersByTime(200));
    expect(root(container).dataset.up).toBeUndefined();
  });
});

describe('useHeldKeys', () => {
  it('holds a key from its key-down to its key-up', () => {
    const { result } = renderHook(() => useHeldKeys());
    act(() => { fireEvent.keyDown(window, { code: 'KeyA' }); });
    expect([...result.current]).toEqual(['KeyA']);
    act(() => { fireEvent.keyUp(window, { code: 'KeyA' }); });
    expect(result.current.size).toBe(0);
  });

  it('lets go of every key but the modifiers when Command is let go', () => {
    const { result } = renderHook(() => useHeldKeys());
    for (const code of ['MetaLeft', 'ShiftLeft', 'KeyK']) act(() => { fireEvent.keyDown(window, { code }); });
    act(() => { fireEvent.keyUp(window, { code: 'MetaLeft' }); });
    expect([...result.current]).toEqual(['ShiftLeft']);
  });

  it('lets go of everything when the window loses focus', () => {
    const { result } = renderHook(() => useHeldKeys());
    act(() => { fireEvent.keyDown(window, { code: 'KeyA' }); });
    act(() => { fireEvent.blur(window); });
    expect(result.current.size).toBe(0);
  });
});
