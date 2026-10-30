import { act, fireEvent, screen } from '@testing-library/react';
import { KitSettingsProvider } from '@weasel-js/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const schema = resolveConfigSchema(
  f.schema({
    count: f.number(1),
    title: f.string('old'),
    x: f.number(0).pair({ with: ['y'], label: 'Offset' }),
    y: f.number(0),
  }),
);
const config = { count: 1, title: 'old', x: 0, y: 0 };
const IDLE_MS = 500;

function mount(draftConfig?: (path: string, value: unknown) => void, settleWhenIdle = false) {
  const setConfig = vi.fn();
  renderWithIcons(
    <KitSettingsProvider value={{ typing: { settleWhenIdle, idleMs: IDLE_MS } }}>
      <ControlPanel
        schema={schema}
        config={config}
        setConfig={setConfig}
        draftConfig={draftConfig}
      />
    </KitSettingsProvider>,
  );
  return setConfig;
}

function type(input: HTMLElement, ...texts: string[]) {
  input.focus();
  for (const text of texts) fireEvent.change(input, { target: { value: text } });
}

describe('<ControlPanel> typed fields with no draftConfig', () => {
  it('write a number once, when the edit settles', () => {
    const setConfig = mount();
    const input = screen.getByRole('spinbutton', { name: 'Count' });
    type(input, '1', '12', '123');
    expect(setConfig).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(setConfig.mock.calls).toEqual([['count', 123]]);
  });

  it('write text once, when the edit settles, with idle commits off', () => {
    const setConfig = mount();
    const input = screen.getByRole('textbox', { name: 'Title' });
    type(input, 'n', 'ne', 'new');
    act(() => vi.advanceTimersByTime(1000));
    expect(setConfig).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(setConfig.mock.calls).toEqual([['title', 'new']]);
  });

  it('write nothing for text the edit ends with Escape on', () => {
    const setConfig = mount();
    const input = screen.getByRole('textbox', { name: 'Title' });
    type(input, 'new');
    fireEvent.keyDown(input, { key: 'Escape' });
    act(() => vi.advanceTimersByTime(1000));
    expect(setConfig).not.toHaveBeenCalled();
    expect(input).toHaveValue('old');
  });

  it('write a paired cell once too', () => {
    const setConfig = mount();
    const input = screen.getByRole('spinbutton', { name: 'X' });
    type(input, '4', '45');
    fireEvent.blur(input);
    expect(setConfig.mock.calls).toEqual([['x', 45]]);
  });
});

describe('<ControlPanel> typed fields with a draftConfig', () => {
  it('draft each keystroke there, and write the settled value once', () => {
    const draftConfig = vi.fn();
    const setConfig = mount(draftConfig);
    const input = screen.getByRole('spinbutton', { name: 'Count' });
    type(input, '2', '23');
    expect(draftConfig.mock.calls).toEqual([
      ['count', 2],
      ['count', 23],
    ]);
    expect(setConfig).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(setConfig.mock.calls).toEqual([['count', 23]]);
  });

  it('draft text there, and take the drafts back on Escape', () => {
    const draftConfig = vi.fn();
    const setConfig = mount(draftConfig);
    const input = screen.getByRole('textbox', { name: 'Title' });
    type(input, 'new');
    act(() => vi.advanceTimersByTime(1000));
    expect(draftConfig.mock.calls).toEqual([['title', 'new']]);
    fireEvent.keyDown(input, { key: 'Escape' });
    act(() => vi.advanceTimersByTime(1000));
    expect(draftConfig.mock.calls.at(-1)).toEqual(['title', 'old']);
    expect(setConfig).not.toHaveBeenCalled();
  });
});

describe('<ControlPanel> typed fields under typing.settleWhenIdle', () => {
  it('write a number once typing rests', () => {
    const setConfig = mount(undefined, true);
    const input = screen.getByRole('spinbutton', { name: 'Count' });
    type(input, '1', '15', '150', '1500');
    act(() => vi.advanceTimersByTime(IDLE_MS - 1));
    expect(setConfig).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(setConfig.mock.calls).toEqual([['count', 1500]]);
  });

  it('write text once typing rests, with a draftConfig as well', () => {
    const draftConfig = vi.fn();
    const setConfig = mount(draftConfig, true);
    const input = screen.getByRole('textbox', { name: 'Title' });
    type(input, 'new');
    act(() => vi.advanceTimersByTime(IDLE_MS));
    expect(setConfig.mock.calls).toEqual([['title', 'new']]);
  });
});
