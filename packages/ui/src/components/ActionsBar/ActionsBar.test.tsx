import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ActionsBar } from './ActionsBar';

function items(onAction = () => {}) {
  return [
    { value: 'cut', label: 'Cut', onAction },
    { value: 'copy', label: 'Copy', onAction },
    { value: 'paste', label: 'Paste', onAction },
  ];
}

describe('ActionsBar', () => {
  it('renders one button per item under a toolbar role', () => {
    const { container } = render(<ActionsBar items={items()} ariaLabel="Edit" />);
    expect(container.querySelector('[role="toolbar"]')?.getAttribute('aria-label')).toBe('Edit');
    expect(container.querySelectorAll('button')).toHaveLength(3);
  });

  it('fires the item action on click', () => {
    const onAction = vi.fn();
    const { container } = render(<ActionsBar items={items(onAction)} />);
    fireEvent.click(container.querySelectorAll('button')[1]);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  // The bar's half of the roving-tabindex wiring: the hook finds its items by
  // the segment class, so a class rename here would silently kill arrow nav.
  it('moves focus with the arrow keys', () => {
    const { container } = render(<ActionsBar items={items()} />);
    const btns = container.querySelectorAll<HTMLButtonElement>('button');
    expect(btns[0].tabIndex).toBe(0);
    fireEvent.keyDown(btns[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(btns[1]);
  });

  it('fires the action on Space', () => {
    const onAction = vi.fn();
    const { container } = render(<ActionsBar items={items(onAction)} />);
    fireEvent.keyDown(container.querySelectorAll('button')[2], { key: ' ' });
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('skips a disabled item when navigating', () => {
    const all = items();
    const { container } = render(
      <ActionsBar items={[all[0], { ...all[1], disabled: true }, all[2]]} />,
    );
    const btns = container.querySelectorAll<HTMLButtonElement>('button');
    fireEvent.keyDown(btns[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(btns[2]);
  });
});
