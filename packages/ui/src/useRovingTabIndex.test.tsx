import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useRovingTabIndex, type UseRovingTabIndexOptions } from './useRovingTabIndex';

type BarProps = Omit<UseRovingTabIndexOptions, 'itemClassName' | 'items'> & {
  items: readonly { label: string; disabled?: boolean }[];
};

function Bar(props: BarProps) {
  const { items } = props;
  const roving = useRovingTabIndex({ ...props, itemClassName: 'seg' });
  return (
    <div ref={roving.rootRef} role="toolbar">
      {items.map((item, i) => (
        <button
          key={item.label}
          type="button"
          className="seg"
          disabled={item.disabled}
          tabIndex={roving.tabIndexFor(i)}
          onKeyDown={roving.onKeyDown(i)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

const items = [{ label: 'a' }, { label: 'b' }, { label: 'c' }];

function renderBar(props: Partial<BarProps> = {}) {
  const { container } = render(<Bar items={items} {...props} />);
  return container.querySelectorAll<HTMLButtonElement>('.seg');
}

describe('useRovingTabIndex — tab stop', () => {
  it('puts the first enabled item in the tab order and nothing else', () => {
    const segs = renderBar();
    expect([...segs].map(b => b.tabIndex)).toEqual([0, -1, -1]);
  });

  it('skips a disabled first item', () => {
    const segs = renderBar({ items: [{ label: 'a', disabled: true }, { label: 'b' }, { label: 'c' }] });
    expect([...segs].map(b => b.tabIndex)).toEqual([-1, 0, -1]);
  });

  it('honors an explicit tabStopIndex', () => {
    const segs = renderBar({ tabStopIndex: 2 });
    expect([...segs].map(b => b.tabIndex)).toEqual([-1, -1, 0]);
  });

  it('leaves the bar out of the tab order when every item is disabled', () => {
    const segs = renderBar({ items: items.map(it => ({ ...it, disabled: true })) });
    expect([...segs].map(b => b.tabIndex)).toEqual([-1, -1, -1]);
  });
});

describe('useRovingTabIndex — arrow navigation', () => {
  it('moves focus forward and backward on both axes', () => {
    const segs = renderBar();
    fireEvent.keyDown(segs[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(segs[1]);
    fireEvent.keyDown(segs[1], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(segs[2]);
    fireEvent.keyDown(segs[2], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(segs[1]);
    fireEvent.keyDown(segs[1], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(segs[0]);
  });

  it('wraps at both ends', () => {
    const segs = renderBar();
    fireEvent.keyDown(segs[0], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(segs[2]);
    fireEvent.keyDown(segs[2], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(segs[0]);
  });

  it('skips disabled items', () => {
    const segs = renderBar({ items: [{ label: 'a' }, { label: 'b', disabled: true }, { label: 'c' }] });
    fireEvent.keyDown(segs[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(segs[2]);
  });

  it('Home and End go to the first and last enabled item', () => {
    const segs = renderBar({ items: [{ label: 'a' }, { label: 'b' }, { label: 'c', disabled: true }] });
    fireEvent.keyDown(segs[0], { key: 'End' });
    expect(document.activeElement).toBe(segs[1]);
    fireEvent.keyDown(segs[1], { key: 'Home' });
    expect(document.activeElement).toBe(segs[0]);
  });

  it('reports the destination to onNavigate before focus moves', () => {
    const onNavigate = vi.fn();
    const segs = renderBar({ onNavigate });
    fireEvent.keyDown(segs[0], { key: 'ArrowRight' });
    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  it('does nothing when the only enabled item is the focused one', () => {
    const onNavigate = vi.fn();
    const segs = renderBar({
      items: [{ label: 'a' }, { label: 'b', disabled: true }, { label: 'c', disabled: true }],
      onNavigate,
    });
    const e = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    segs[0].dispatchEvent(e);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
  });

  it('leaves other keys to the browser', () => {
    const segs = renderBar();
    const e = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    segs[0].dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });
});

describe('useRovingTabIndex — activation', () => {
  it('Space and Enter call onActivate and suppress the native click', () => {
    const onActivate = vi.fn();
    const segs = renderBar({ onActivate });
    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    segs[1].dispatchEvent(space);
    expect(onActivate).toHaveBeenCalledWith(1);
    expect(space.defaultPrevented).toBe(true);
    fireEvent.keyDown(segs[2], { key: 'Enter' });
    expect(onActivate).toHaveBeenLastCalledWith(2);
  });

  it('leaves Space and Enter alone without onActivate, so a button clicks normally', () => {
    const segs = renderBar();
    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    segs[1].dispatchEvent(space);
    expect(space.defaultPrevented).toBe(false);
  });
});
