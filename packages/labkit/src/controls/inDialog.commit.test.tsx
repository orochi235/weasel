import { fireEvent, screen } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { useEffect, useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import type { ControlRenderer, InDialogOptions } from '../config/types';
import { ControlPanel } from './ControlPanel';

type PrefRenderContext = Parameters<ControlRenderer>[0];

const shout = ({ value, setValue }: PrefRenderContext) => (
  <button type="button" onClick={() => setValue(`${String(value)}!`)}>
    shout
  </button>
);

/** A body that keeps its own state and writes it only as it unmounts. */
function WritesOnClose({ value, setValue }: PrefRenderContext) {
  const [text, setText] = useState(String(value));
  const latest = useRef(text);
  latest.current = text;
  const write = useRef(setValue);
  write.current = setValue;
  useEffect(() => () => write.current(latest.current), []);
  return (
    <button type="button" onClick={() => setText((t) => `${t}?`)}>
      ask
    </button>
  );
}

function mount(body: ControlRenderer, opts?: InDialogOptions) {
  const setConfig = vi.fn();
  const schema = resolveConfigSchema(f.schema({ note: f.string('hi').dialog(body, opts) }));
  renderWithIcons(<ControlPanel schema={schema} config={{ note: 'hi' }} setConfig={setConfig} />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit Note' }));
  return setConfig;
}

const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

describe('a write from a .dialog body after its dialog closed', () => {
  let warn: MockInstance<typeof console.warn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it.each(['Done', 'Cancel'])('is dropped with a warning naming the row, after %s', (button) => {
    const setConfig = mount((ctx) => <WritesOnClose {...ctx} />);
    press('ask');
    press(button);
    expect(setConfig).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(/"Note".*closed.*dropped/);
  });

  it('does not warn for writes while the dialog is open, nor for Done writing them', () => {
    const setConfig = mount(shout);
    press('shout');
    press('Done');
    expect(setConfig.mock.calls).toEqual([['note', 'hi!']]);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('a .dialog commit', () => {
  it('runs once on the draft at Done, and its result is what is written', () => {
    const commit = vi.fn((draft: unknown) => String(draft).toUpperCase());
    const setConfig = mount(shout, { commit });
    press('shout');
    press('shout');
    expect(commit).not.toHaveBeenCalled();
    press('Done');
    expect(commit.mock.calls).toEqual([['hi!!']]);
    expect(setConfig.mock.calls).toEqual([['note', 'HI!!']]);
  });

  it('never runs on Cancel', () => {
    const commit = vi.fn((draft: unknown) => draft);
    const setConfig = mount(shout, { commit });
    press('shout');
    press('Cancel');
    expect(commit).not.toHaveBeenCalled();
    expect(setConfig).not.toHaveBeenCalled();
  });

  it('does not run when nothing was edited, and nothing is written', () => {
    const commit = vi.fn((draft: unknown) => draft);
    const setConfig = mount(shout, { commit });
    press('Done');
    expect(commit).not.toHaveBeenCalled();
    expect(setConfig).not.toHaveBeenCalled();
  });
});
