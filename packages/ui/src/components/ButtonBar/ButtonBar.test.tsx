import { describe, it, expect, vi } from 'vitest';
import { act, render, fireEvent, screen } from '@testing-library/react';
import { ButtonBar } from './ButtonBar';

function items(onAction = () => {}) {
  return [
    { value: 'cut', label: 'Cut', onAction },
    { value: 'copy', label: 'Copy', onAction },
    { value: 'paste', label: 'Paste', onAction },
  ];
}

describe('ButtonBar', () => {
  it('renders one button per item under a toolbar role', () => {
    const { container } = render(<ButtonBar items={items()} ariaLabel="Edit" />);
    expect(container.querySelector('[role="toolbar"]')?.getAttribute('aria-label')).toBe('Edit');
    expect(container.querySelectorAll('button')).toHaveLength(3);
  });

  it('fires the item action on click', () => {
    const onAction = vi.fn();
    const { container } = render(<ButtonBar items={items(onAction)} />);
    fireEvent.click(container.querySelectorAll('button')[1]);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  // The bar's half of the roving-tabindex wiring: the hook finds its items by
  // the segment class, so a class rename here would silently kill arrow nav.
  it('moves focus with the arrow keys', () => {
    const { container } = render(<ButtonBar items={items()} />);
    const btns = container.querySelectorAll<HTMLButtonElement>('button');
    expect(btns[0].tabIndex).toBe(0);
    fireEvent.keyDown(btns[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(btns[1]);
  });

  it('fires the action on Space', () => {
    const onAction = vi.fn();
    const { container } = render(<ButtonBar items={items(onAction)} />);
    fireEvent.keyDown(container.querySelectorAll('button')[2], { key: ' ' });
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('skips a disabled item when navigating', () => {
    const all = items();
    const { container } = render(
      <ButtonBar items={[all[0], { ...all[1], disabled: true }, all[2]]} />,
    );
    const btns = container.querySelectorAll<HTMLButtonElement>('button');
    fireEvent.keyDown(btns[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(btns[2]);
  });
});

describe('ButtonBar tooltips', () => {
  it('shows an item tooltip on keyboard focus and keeps arrow navigation', () => {
    const onAction = vi.fn();
    const { container } = render(
      <ButtonBar items={[
        { value: 'undo', label: 'U', ariaLabel: 'Undo', tooltip: 'Undo (⌘Z)', onAction },
        { value: 'redo', label: 'R', ariaLabel: 'Redo', tooltip: 'Redo (⇧⌘Z)', onAction },
      ]} />,
    );
    const btns = container.querySelectorAll<HTMLButtonElement>('button');
    expect(btns[1].tabIndex).toBe(-1);
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => btns[0].focus());
    expect(screen.getByRole('tooltip').textContent).toBe('Undo (⌘Z)');
    fireEvent.keyDown(btns[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(btns[1]);
    fireEvent.click(btns[1]);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders no tooltip for an item without one', () => {
    const { container } = render(<ButtonBar items={items()} />);
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => container.querySelector('button')!.focus());
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
