import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ToggleBar } from './ToggleBar';

const items = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

describe('ToggleBar single mode', () => {
  it('renders one segment per item with radiogroup role', () => {
    const { container } = render(
      <ToggleBar items={items} value="center" onChange={() => {}} />,
    );
    expect(container.querySelector('[role="radiogroup"]')).not.toBeNull();
    const segs = container.querySelectorAll('[role="radio"]');
    expect(segs).toHaveLength(3);
  });

  it('marks the selected segment with aria-checked=true', () => {
    const { container } = render(
      <ToggleBar items={items} value="center" onChange={() => {}} />,
    );
    const segs = container.querySelectorAll<HTMLElement>('[role="radio"]');
    expect(segs[0].getAttribute('aria-checked')).toBe('false');
    expect(segs[1].getAttribute('aria-checked')).toBe('true');
    expect(segs[2].getAttribute('aria-checked')).toBe('false');
  });

  it('calls onChange with clicked value', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ToggleBar items={items} value="center" onChange={onChange} />,
    );
    const segs = container.querySelectorAll<HTMLElement>('[role="radio"]');
    fireEvent.click(segs[2]);
    expect(onChange).toHaveBeenCalledWith('right');
  });

  it('does not call onChange when clicking the already-selected segment (default)', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ToggleBar items={items} value="center" onChange={onChange} />,
    );
    const segs = container.querySelectorAll<HTMLElement>('[role="radio"]');
    fireEvent.click(segs[1]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('calls onChange(null) when clicking selected segment with allowDeselect', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ToggleBar items={items} value="center" onChange={onChange} allowDeselect />,
    );
    const segs = container.querySelectorAll<HTMLElement>('[role="radio"]');
    fireEvent.click(segs[1]);
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe('ToggleBar multiple mode', () => {
  const triItems = [
    { value: 'b', label: 'B' },
    { value: 'i', label: 'I' },
    { value: 'u', label: 'U' },
  ];

  it('uses role=group and aria-pressed', () => {
    const { container } = render(
      <ToggleBar mode="multiple" items={triItems} value={['b']} onChange={() => {}} />,
    );
    expect(container.querySelector('[role="group"]')).not.toBeNull();
    const btns = container.querySelectorAll<HTMLElement>('button');
    expect(btns[0].getAttribute('aria-pressed')).toBe('true');
    expect(btns[1].getAttribute('aria-pressed')).toBe('false');
    expect(btns[2].getAttribute('aria-pressed')).toBe('false');
  });

  it('adds value to array when clicking an unselected segment', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ToggleBar mode="multiple" items={triItems} value={['b']} onChange={onChange} />,
    );
    fireEvent.click(container.querySelectorAll('button')[2]);
    expect(onChange).toHaveBeenCalledWith(['b', 'u']);
  });

  it('removes value from array when clicking a selected segment', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ToggleBar mode="multiple" items={triItems} value={['b', 'u']} onChange={onChange} />,
    );
    fireEvent.click(container.querySelectorAll('button')[0]);
    expect(onChange).toHaveBeenCalledWith(['u']);
  });
});

describe('ToggleBar multiple mode — mixed segments', () => {
  const triItems = [
    { value: 'b', label: 'B' },
    { value: 'i', label: 'I' },
    { value: 'u', label: 'U' },
  ];

  it('renders a mixed segment as aria-pressed="mixed"', () => {
    const { container } = render(
      <ToggleBar
        mode="multiple"
        items={triItems}
        value={['b']}
        mixedValues={['i']}
        onChange={() => {}}
      />,
    );
    const btns = container.querySelectorAll<HTMLElement>('button');
    expect(btns[0].getAttribute('aria-pressed')).toBe('true');
    expect(btns[1].getAttribute('aria-pressed')).toBe('mixed');
    expect(btns[2].getAttribute('aria-pressed')).toBe('false');
  });

  it('turns a mixed segment fully on when clicked', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ToggleBar
        mode="multiple"
        items={triItems}
        value={['b']}
        mixedValues={['i']}
        onChange={onChange}
      />,
    );
    fireEvent.click(container.querySelectorAll('button')[1]);
    expect(onChange).toHaveBeenCalledWith(['b', 'i']);
  });

  it('treats `value` as authoritative when a value is in both lists', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ToggleBar
        mode="multiple"
        items={triItems}
        value={['b']}
        mixedValues={['b']}
        onChange={onChange}
      />,
    );
    const btn = container.querySelectorAll<HTMLElement>('button')[0];
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(btn);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  // `mixedValues` belongs to the multiple-mode union member, but TypeScript's
  // excess-property check against a union accepts any key declared on *some*
  // member — so single mode has to reject it at runtime rather than at the
  // type level. Single mode has nothing to be mixed about: its aggregate is
  // one value or none.
  it('ignores mixedValues in single mode', () => {
    const { container } = render(
      <ToggleBar
        items={items}
        value="center"
        mixedValues={['left']}
        onChange={() => {}}
      />,
    );
    const segs = container.querySelectorAll<HTMLElement>('[role="radio"]');
    expect(segs[0].getAttribute('aria-pressed')).toBeNull();
    expect(segs[0].getAttribute('aria-checked')).toBe('false');
  });
});

describe('ToggleBar keyboard — single mode', () => {
  it('ArrowRight moves selection forward', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ToggleBar items={items} value="left" onChange={onChange} />,
    );
    const segs = container.querySelectorAll<HTMLElement>('[role="radio"]');
    fireEvent.keyDown(segs[0], { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('center');
  });

  it('ArrowLeft wraps from first to last', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ToggleBar items={items} value="left" onChange={onChange} />,
    );
    const segs = container.querySelectorAll<HTMLElement>('[role="radio"]');
    fireEvent.keyDown(segs[0], { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('right');
  });

  it('Home jumps to first, End to last', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ToggleBar items={items} value="center" onChange={onChange} />,
    );
    const segs = container.querySelectorAll<HTMLElement>('[role="radio"]');
    fireEvent.keyDown(segs[1], { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('left');
    fireEvent.keyDown(segs[1], { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('right');
  });

  it('roving tabindex: selected segment is tab stop', () => {
    const { container } = render(
      <ToggleBar items={items} value="center" onChange={() => {}} />,
    );
    const segs = container.querySelectorAll<HTMLElement>('[role="radio"]');
    expect(segs[0].tabIndex).toBe(-1);
    expect(segs[1].tabIndex).toBe(0);
    expect(segs[2].tabIndex).toBe(-1);
  });
});

describe('ToggleBar keyboard — multiple mode', () => {
  const triItems = [
    { value: 'b', label: 'B' },
    { value: 'i', label: 'I' },
    { value: 'u', label: 'U' },
  ];

  it('Space toggles focused segment', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ToggleBar mode="multiple" items={triItems} value={[]} onChange={onChange} />,
    );
    const btns = container.querySelectorAll<HTMLElement>('button');
    fireEvent.keyDown(btns[1], { key: ' ' });
    expect(onChange).toHaveBeenCalledWith(['i']);
  });

  it('ArrowRight does not mutate selection in multiple mode', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ToggleBar mode="multiple" items={triItems} value={['b']} onChange={onChange} />,
    );
    const btns = container.querySelectorAll<HTMLElement>('button');
    fireEvent.keyDown(btns[0], { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('ToggleBar disabled segments', () => {
  const mixed = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B', disabled: true },
    { value: 'c', label: 'C' },
  ];

  it('does not call onChange when clicking a disabled segment', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ToggleBar items={mixed} value="a" onChange={onChange} />,
    );
    const segs = container.querySelectorAll<HTMLElement>('[role="radio"]');
    fireEvent.click(segs[1]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('arrow nav skips disabled segments', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ToggleBar items={mixed} value="a" onChange={onChange} />,
    );
    const segs = container.querySelectorAll<HTMLElement>('[role="radio"]');
    fireEvent.keyDown(segs[0], { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('c');
  });
});
