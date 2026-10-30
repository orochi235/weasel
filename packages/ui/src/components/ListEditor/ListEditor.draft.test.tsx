import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { KitSettingsProvider } from '@weasel-js/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDLE_SETTLE_MS } from '../../useIdleSettle';
import { ListEditor } from './ListEditor';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Controlled({ initial, onChange, settleWhenIdle }: { initial: string[]; onChange: (v: string[]) => void; settleWhenIdle?: boolean }) {
  const [value, setValue] = useState(initial);
  return (
    <ListEditor
      aria-label="Glob"
      value={value}
      reorder
      settleWhenIdle={settleWhenIdle}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

function setup(initial: string[], { kit = false, settleWhenIdle }: { kit?: boolean; settleWhenIdle?: boolean } = {}) {
  const onChange = vi.fn();
  render(
    <KitSettingsProvider value={{ typing: { settleWhenIdle: kit } }}>
      <Controlled initial={initial} onChange={onChange} settleWhenIdle={settleWhenIdle} />
    </KitSettingsProvider>,
  );
  const entry = (n: number) => screen.getByRole('textbox', { name: `Glob ${n}` }) as HTMLInputElement;
  return { onChange, entry };
}

const type = (field: HTMLElement, ...texts: string[]) => {
  field.focus();
  for (const text of texts) fireEvent.change(field, { target: { value: text } });
};
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('ListEditor text entries hold a draft', () => {
  it('writes nothing per keystroke, and the whole list once on blur', () => {
    const { onChange, entry } = setup(['a', 'b']);
    type(entry(2), 'bx', 'bxy', 'bxyz');
    expect(onChange).not.toHaveBeenCalled();
    expect(entry(2)).toHaveValue('bxyz');
    fireEvent.blur(entry(2));
    expect(onChange.mock.calls).toEqual([[['a', 'bxyz']]]);
  });

  it('Enter writes the typed entry and the inserted one as one change', () => {
    const { onChange, entry } = setup(['a', 'b']);
    type(entry(1), 'ab');
    fireEvent.keyDown(entry(1), { key: 'Enter' });
    expect(onChange.mock.calls).toEqual([[['ab', '', 'b']]]);
    expect(document.activeElement).toBe(entry(2));
    expect(entry(1)).toHaveValue('ab');
  });

  it('Backspace in an entry typed empty removes it, without first writing it empty', () => {
    const { onChange, entry } = setup(['a', 'b']);
    type(entry(2), '');
    fireEvent.keyDown(entry(2), { key: 'Backspace' });
    expect(onChange.mock.calls).toEqual([[['a']]]);
  });

  it('Backspace in an entry typed non-empty keeps it', () => {
    const { onChange, entry } = setup(['a', '']);
    type(entry(2), 'c');
    fireEvent.keyDown(entry(2), { key: 'Backspace' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Escape drops the draft', () => {
    const { onChange, entry } = setup(['a']);
    type(entry(1), 'zz');
    fireEvent.keyDown(entry(1), { key: 'Escape' });
    fireEvent.blur(entry(1));
    expect(onChange).not.toHaveBeenCalled();
    expect(entry(1)).toHaveValue('a');
  });

  it('a move carries the typed text with its entry', () => {
    const { onChange, entry } = setup(['a', 'b']);
    type(entry(1), 'ax');
    fireEvent.keyDown(entry(1), { key: 'ArrowDown', altKey: true });
    expect(onChange.mock.calls).toEqual([[['b', 'ax']]]);
    expect(entry(1)).toHaveValue('b');
    expect(entry(2)).toHaveValue('ax');
  });

  it('commits once typing rests where typing.settleWhenIdle is on', () => {
    const { onChange, entry } = setup(['a'], { kit: true });
    type(entry(1), 'ab', 'abc');
    wait(IDLE_SETTLE_MS - 1);
    expect(onChange).not.toHaveBeenCalled();
    wait(1);
    expect(onChange.mock.calls).toEqual([[['abc']]]);
    expect(entry(1)).toHaveValue('abc');
    fireEvent.blur(entry(1));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('waits for blur where typing.settleWhenIdle is off', () => {
    const { onChange, entry } = setup(['a']);
    type(entry(1), 'ab');
    wait(IDLE_SETTLE_MS * 4);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('takes its own settleWhenIdle over the kit setting', () => {
    const { onChange, entry } = setup(['a'], { kit: true, settleWhenIdle: false });
    type(entry(1), 'ab');
    wait(IDLE_SETTLE_MS * 4);
    expect(onChange).not.toHaveBeenCalled();
  });
});
