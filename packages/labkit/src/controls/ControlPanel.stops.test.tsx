import { fireEvent, render, screen, within } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlMatrix } from './ControlMatrix';
import { ControlPanel } from './ControlPanel';

/** jsdom lays nothing out: 200px of track puts the 8px pull at 4% of the range either side of a stop. */
function stubRect(el: HTMLElement, rect: { width: number }) {
  el.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, right: rect.width, bottom: 24, height: 24, width: rect.width, toJSON: () => ({}) });
}

const PERCENT = { suffix: '%', scale: 0.01, precision: 0 };
const schema = resolveConfigSchema(
  f.schema({
    level: f.number(0.2).range(-1, 1).step(0.01).stops([0]).label('Level'),
    mix: f.number(0.4).range(0, 1).step(0.01).unit(PERCENT).stops([0.5]).label('Mix'),
  }),
);

/** A panel holding its drafts the way a lab does, so the track follows the drag. */
function Lab({ setConfig, draftConfig }: {
  setConfig: (path: string, value: unknown) => void;
  draftConfig: (path: string, value: unknown) => void;
}) {
  const [config, setValues] = useState<Record<string, unknown>>({ level: 0.2, mix: 0.4 });
  return (
    <ControlPanel
      schema={schema}
      config={config}
      setConfig={(path, value) => {
        setValues((c) => ({ ...c, [path]: value }));
        setConfig(path, value);
      }}
      draftConfig={(path, value) => {
        setValues((c) => ({ ...c, [path]: value }));
        draftConfig(path, value);
      }}
    />
  );
}

function track(name: string): HTMLInputElement {
  const el = screen.getByRole('slider', { name }) as HTMLInputElement;
  stubRect(el, { width: 200 });
  return el;
}

describe('a schema number with stops', () => {
  it('carries them onto the leaf', () => {
    const leaf = schema.group.children.level as { stops?: readonly number[] };
    expect(leaf.stops).toEqual([0]);
  });

  it('drafts a drag, catches it on a stop, and writes it once on release', () => {
    const setConfig = vi.fn();
    const draftConfig = vi.fn();
    renderWithIcons(<Lab setConfig={setConfig} draftConfig={draftConfig} />);
    const el = track('Level');
    fireEvent.pointerDown(el);
    for (const at of ['0.1', '0.03', '-0.02']) fireEvent.input(el, { target: { value: at } });
    expect(setConfig).not.toHaveBeenCalled();
    fireEvent.pointerUp(window);
    fireEvent.change(el);
    expect(draftConfig.mock.calls).toEqual([['level', 0.1], ['level', 0], ['level', 0]]);
    expect(setConfig.mock.calls).toEqual([['level', 0]]);
  });

  it('declares them in the stored unit and catches them in the shown one', () => {
    const setConfig = vi.fn();
    renderWithIcons(<Lab setConfig={setConfig} draftConfig={() => {}} />);
    const el = track('Mix');
    expect(el.max).toBe('100');
    fireEvent.pointerDown(el);
    fireEvent.input(el, { target: { value: '53' } });
    fireEvent.change(el);
    expect(setConfig.mock.calls).toEqual([['mix', 0.5]]);
  });

  it('catches a ControlMatrix cell on them too', () => {
    const setConfig = vi.fn();
    const looks = resolveConfigSchema(
      f.schema({ a: f.group({ level: f.number(0.2).range(-1, 1).step(0.01).stops([0]).label('Level') }) }),
      [],
    );
    render(
      <ControlMatrix
        schema={looks}
        columns={[{ key: 'a', label: 'A' }]}
        rows={[{ key: 'level' }]}
        config={{ a: { level: 0.2 } }}
        setConfig={setConfig}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'A Level' }));
    const el = within(screen.getByRole('dialog', { name: 'A Level' })).getByRole('slider') as HTMLInputElement;
    stubRect(el, { width: 200 });
    fireEvent.pointerDown(el);
    fireEvent.input(el, { target: { value: '0.03' } });
    expect(setConfig).toHaveBeenLastCalledWith('a.level', 0);
  });
});
