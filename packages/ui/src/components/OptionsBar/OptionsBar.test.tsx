import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { OptionsBar } from './OptionsBar';

function items(onChange: (next: boolean) => void = () => {}) {
  return [
    { value: 'grid', label: 'Grid', selected: true, onChange },
    { value: 'snap', label: 'Snap', selected: false, onChange },
    { value: 'rulers', label: 'Rulers', selected: false, onChange },
  ];
}

describe('OptionsBar', () => {
  it('renders a group of toggle buttons carrying their pressed state', () => {
    const { container } = render(<OptionsBar items={items()} ariaLabel="View" />);
    expect(container.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('View');
    const btns = container.querySelectorAll('button');
    expect(btns[0].getAttribute('aria-pressed')).toBe('true');
    expect(btns[1].getAttribute('aria-pressed')).toBe('false');
  });

  it('reports the flipped value on click', () => {
    const onChange = vi.fn();
    const { container } = render(<OptionsBar items={items(onChange)} />);
    fireEvent.click(container.querySelectorAll('button')[0]);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  // The bar's half of the roving-tabindex wiring: the hook finds its items by
  // the segment class, so a class rename here would silently kill arrow nav.
  it('moves focus with the arrow keys without changing any value', () => {
    const onChange = vi.fn();
    const { container } = render(<OptionsBar items={items(onChange)} />);
    const btns = container.querySelectorAll<HTMLButtonElement>('button');
    expect(btns[0].tabIndex).toBe(0);
    fireEvent.keyDown(btns[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(btns[1]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('toggles on Space', () => {
    const onChange = vi.fn();
    const { container } = render(<OptionsBar items={items(onChange)} />);
    fireEvent.keyDown(container.querySelectorAll('button')[1], { key: ' ' });
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('skips a disabled item when navigating', () => {
    const all = items();
    const { container } = render(
      <OptionsBar items={[all[0], { ...all[1], disabled: true }, all[2]]} />,
    );
    const btns = container.querySelectorAll<HTMLButtonElement>('button');
    fireEvent.keyDown(btns[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(btns[2]);
  });
});
