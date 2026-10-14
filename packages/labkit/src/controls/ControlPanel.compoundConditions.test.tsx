import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

const phase = () =>
  f.object({
    length: f.number(1),
    ease: f.number(0).showIf({ path: 'eased' }),
    hold: f.number(0).enableIf({ path: 'holds' }),
  });
const schema = f.schema({
  eased: f.boolean(false),
  holds: f.boolean(false),
  phases: f.list(
    [
      { length: 1, ease: 0, hold: 0 },
      { length: 2, ease: 0, hold: 0 },
    ],
    phase(),
  ),
  stop: f.object({
    on: f.boolean(false),
    at: f.number(1).enableIf({ path: 'stop.on' }),
    soft: f.number(0).showIf({ path: 'stop.on' }),
  }),
});
const resolved = resolveConfigSchema(schema);

function open(label: string, config: Record<string, unknown>): void {
  render(
    <ControlPanel
      schema={resolved}
      config={{ ...(schema.defaults() as Record<string, unknown>), ...config }}
      setConfig={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: `Edit ${label}` }));
}

describe('conditions inside a leaf a control panel opens in a dialog', () => {
  it("hide and disable an object leaf's fields", () => {
    open('Stop', { stop: { on: false, at: 1 } });
    expect(screen.getByRole('spinbutton', { name: 'At' })).toBeDisabled();
    expect(screen.queryByRole('spinbutton', { name: 'Soft' })).toBeNull();
  });

  it("draw an object leaf's fields while they hold", () => {
    open('Stop', { stop: { on: true, at: 1 } });
    expect(screen.getByRole('spinbutton', { name: 'At' })).toBeEnabled();
    expect(screen.getByRole('spinbutton', { name: 'Soft' })).toBeInTheDocument();
  });

  it("hide and disable the fields of every entry by the list's item", () => {
    open('Phases', {});
    expect(screen.getAllByRole('spinbutton', { name: 'Length' })).toHaveLength(2);
    expect(screen.queryByRole('spinbutton', { name: 'Ease' })).toBeNull();
    for (const hold of screen.getAllByRole('spinbutton', { name: 'Hold' }))
      expect(hold).toBeDisabled();
  });

  it("draw the fields of every entry while the item's conditions hold", () => {
    open('Phases', { eased: true, holds: true });
    expect(screen.getAllByRole('spinbutton', { name: 'Ease' })).toHaveLength(2);
    for (const hold of screen.getAllByRole('spinbutton', { name: 'Hold' }))
      expect(hold).toBeEnabled();
  });
});

describe('a condition that reads the entry, in a list a control panel opens in a dialog', () => {
  const stop = () =>
    f.object({
      held: f.boolean(false),
      hold: f.number(0).showIf({ from: 'item', path: 'held' }),
      gain: f.number(0).enableIf({ from: 'item', path: 'held' }),
    });
  const entries = f.schema({
    held: f.boolean(false),
    stops: f.list(
      [
        { held: true, hold: 0, gain: 0 },
        { held: false, hold: 0, gain: 0 },
      ],
      stop(),
    ),
  });

  it('hides and disables a field in each entry by that entry', () => {
    render(
      <ControlPanel
        schema={resolveConfigSchema(entries)}
        config={entries.defaults() as Record<string, unknown>}
        setConfig={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit Stops' }));
    expect(screen.getAllByRole('spinbutton', { name: 'Hold' })).toHaveLength(1);
    const gains = screen.getAllByRole('spinbutton', { name: 'Gain' });
    expect(gains.map((g) => (g as HTMLInputElement).disabled)).toEqual([false, true]);
  });
});

describe('a condition that reads the entry, in a list of plain text a control panel opens in a dialog', () => {
  const tags = f.schema({
    tags: f.list(
      ['fixed', 'free'],
      f.string('').enableIf({ from: 'item', path: '', isNot: 'fixed' }),
    ),
  });

  it('disables one entry by that entry, leaves the next, and still lets it be removed', () => {
    render(
      <ControlPanel
        schema={resolveConfigSchema(tags)}
        config={tags.defaults() as Record<string, unknown>}
        setConfig={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit Tags' }));
    const [first, second] = screen.getAllByRole('textbox');
    expect(first).toBeDisabled();
    expect(second).toBeEnabled();
    expect(screen.getAllByRole('button', { name: /^Remove/ })[0]).toBeEnabled();
  });
});
