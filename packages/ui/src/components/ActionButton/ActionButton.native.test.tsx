import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, expectTypeOf, test, vi } from 'vitest';
import { ActionButton, type ActionButtonProps } from './ActionButton';

describe('ActionButton forwards the native <button> contract', () => {
  test('passes native attributes through and forwards its ref', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <ActionButton
        ref={ref}
        label="Flip"
        onPress={() => {}}
        aria-describedby="hint"
        aria-controls="panel"
        aria-expanded={false}
        tabIndex={-1}
        data-slot="flip"
      />,
    );
    const flip = screen.getByRole('button', { name: 'Flip' });
    expect(ref.current).toBe(flip);
    expect(flip).toHaveAttribute('aria-describedby', 'hint');
    expect(flip).toHaveAttribute('aria-controls', 'panel');
    expect(flip).toHaveAttribute('aria-expanded', 'false');
    expect(flip).toHaveAttribute('tabindex', '-1');
    expect(flip).toHaveAttribute('data-slot', 'flip');
  });

  test("runs a caller's onClick before onPress, and a prevented one skips it", () => {
    const order: string[] = [];
    const { rerender } = render(
      <ActionButton label="Flip" onClick={() => order.push('click')} onPress={() => order.push('press')} />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(order).toEqual(['click', 'press']);
    rerender(
      <ActionButton label="Flip" onClick={(e) => { order.push('click'); e.preventDefault(); }} onPress={() => order.push('press')} />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(order).toEqual(['click', 'press', 'click']);
  });

  test('composes focus and pointer handlers with its preview', () => {
    const onFocus = vi.fn();
    const onPointerEnter = vi.fn();
    const down = vi.fn();
    const preview = vi.fn(() => down);
    render(<ActionButton label="Flip" preview={preview} onPress={() => {}} onFocus={onFocus} onPointerEnter={onPointerEnter} />);
    const flip = screen.getByRole('button');
    fireEvent.focus(flip);
    expect(onFocus).toHaveBeenCalledOnce();
    expect(preview).toHaveBeenCalledOnce();
    fireEvent.blur(flip);
    fireEvent.pointerEnter(flip);
    expect(onPointerEnter).toHaveBeenCalledOnce();
    expect(preview).toHaveBeenCalledTimes(2);
  });

  test("runs a caller's onPointerDown before a menu popup's, which a prevented one skips", () => {
    const own = vi.fn();
    const menu = vi.fn();
    const { rerender } = render(
      <ActionButton label="Shapes" onPress={() => {}} onPointerDown={own} popup={{ type: 'menu', expanded: false, onPointerDown: menu }} />,
    );
    fireEvent.pointerDown(screen.getByRole('button'));
    expect([own.mock.calls.length, menu.mock.calls.length]).toEqual([1, 1]);
    rerender(
      <ActionButton
        label="Shapes"
        onPress={() => {}}
        onPointerDown={(e) => { own(); e.preventDefault(); }}
        popup={{ type: 'menu', expanded: false, onPointerDown: menu }}
      />,
    );
    fireEvent.pointerDown(screen.getByRole('button'));
    expect([own.mock.calls.length, menu.mock.calls.length]).toEqual([2, 1]);
  });

  test('ignores a press while disabled for a reason, and keeps its key handlers', () => {
    const onClick = vi.fn();
    const onPress = vi.fn();
    const onKeyDown = vi.fn();
    render(<ActionButton label="Flip" disabled disabledReason="Nothing selected" onClick={onClick} onPress={onPress} onKeyDown={onKeyDown} />);
    const flip = screen.getByRole('button', { name: 'Flip' });
    expect(flip).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(flip);
    fireEvent.keyDown(flip, { key: 'ArrowDown' });
    expect(onClick).not.toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
    expect(onKeyDown).toHaveBeenCalledOnce();
  });

  test('ignores a press while dead for a missing key, as one disabled for a reason does', () => {
    const onClick = vi.fn();
    const onPress = vi.fn();
    const onPointerDown = vi.fn();
    render(<ActionButton label="Flatten" missing="layers.flatten" onClick={onClick} onPointerDown={onPointerDown} onPress={onPress} />);
    const dead = screen.getByRole('button', { name: 'Flatten' });
    expect(dead).toHaveAttribute('aria-disabled', 'true');
    expect(dead).not.toBeDisabled();
    fireEvent.pointerDown(dead);
    fireEvent.click(dead);
    expect(onClick).not.toHaveBeenCalled();
    expect(onPointerDown).not.toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
  });

  test('types its props from the native button, less what it writes itself', () => {
    expectTypeOf<ActionButtonProps>().toHaveProperty('aria-expanded');
    expectTypeOf<ActionButtonProps>().toHaveProperty('onKeyDown');
    // @ts-expect-error an action button never submits a form
    void (<ActionButton label="x" type="submit" onPress={() => {}} />);
    // `label` and `active` own these; JSX lets any hyphenated name through, so the type is what says it.
    expectTypeOf<ActionButtonProps>().not.toHaveProperty('aria-label');
    expectTypeOf<ActionButtonProps>().not.toHaveProperty('aria-pressed');
  });
});
