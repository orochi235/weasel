import { fireEvent, screen } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { withValueAtPath } from '../config/path';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';
import { summarizeLeaf, summarizeValue } from './inDialog';

function Panel({ schema }: { schema: Parameters<typeof resolveConfigSchema>[0] }) {
  const resolved = resolveConfigSchema(schema);
  const [config, setConfig] = useState<Record<string, unknown>>(
    schema.defaults() as Record<string, unknown>,
  );
  return (
    <>
      <ControlPanel
        schema={resolved}
        config={config}
        setConfig={(path, value) => setConfig((prev) => withValueAtPath(prev, path, value))}
      />
      <output data-testid="config">{JSON.stringify(config)}</output>
    </>
  );
}

describe('f.list', () => {
  it('summarizes the list on the row and edits it in a dialog', () => {
    const schema = f.schema({
      icons: f.list(['**/node_modules/**', 'dist']).label('Draw as icons'),
    });
    renderWithIcons(<Panel schema={schema} />);
    const trigger = screen.getByRole('button', { name: 'Edit Draw as icons' });
    expect(trigger.textContent).toContain('**/node_modules/**, dist');

    fireEvent.click(trigger);
    const entry = screen.getByRole('textbox', { name: 'Draw as icons 2' });
    fireEvent.change(entry, { target: { value: 'build' } });
    fireEvent.blur(entry);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByTestId('config').textContent).toBe(
      JSON.stringify({ icons: ['**/node_modules/**', 'build'] }),
    );
  });

  it('is the kind an f.value with a string-array default takes', () => {
    const resolved = resolveConfigSchema(f.schema({ names: f.value(['a']) }));
    expect(resolved.group.children.names).toMatchObject({ kind: 'list' });
  });
});

describe('.dialog', () => {
  it('hosts any renderer in the dialog, handed the row context', () => {
    const schema = f.schema({
      note: f.string('hi').dialog(({ value, setValue }) => (
        <button type="button" onClick={() => setValue(`${value}!`)}>
          shout
        </button>
      )),
    });
    renderWithIcons(<Panel schema={schema} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Note' }));
    fireEvent.click(screen.getByRole('button', { name: 'shout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByTestId('config').textContent).toBe(JSON.stringify({ note: 'hi!' }));
  });

  it('takes a summary of its own', () => {
    const summary = vi.fn((v: unknown) => `${(v as number[]).length} points`);
    const schema = f.schema({ pts: f.custom('points', [1, 2, 3]).dialog(() => null, { summary }) });
    renderWithIcons(<Panel schema={schema} />);
    expect(screen.getByRole('button', { name: 'Edit Pts' }).textContent).toContain('3 points');
  });

  it('gives way to a later .render, and takes over from an earlier one', () => {
    const schema = f.schema({
      a: f
        .string('x')
        .dialog(() => null)
        .render(() => <span>row a</span>),
      b: f
        .string('y')
        .render(() => <span>row b</span>)
        .dialog(() => null),
    });
    renderWithIcons(<Panel schema={schema} />);
    expect(screen.getByText('row a')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit A' })).toBeNull();
    expect(screen.queryByText('row b')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit B' })).toBeTruthy();
  });
});

describe('summarizeValue', () => {
  it('joins lists and names emptiness', () => {
    expect(summarizeValue(['a', 'b'])).toBe('a, b');
    expect(summarizeValue([])).toBe('None');
    expect(summarizeValue('')).toBe('None');
    expect(summarizeValue(3)).toBe('3');
    expect(summarizeValue({ a: 1 })).toBe('{"a":1}');
  });
});

describe('summarizeLeaf', () => {
  const deg = { scale: Math.PI / 180, precision: 0, suffix: '°' };
  const angle = { kind: 'number', name: 'Angle', description: '', default: 0, unit: deg } as const;
  const plain = { kind: 'number', name: 'Count', description: '', default: 0 } as const;

  it('writes a number with a unit as its field shows it', () => {
    expect(summarizeLeaf(angle, Math.PI)).toBe('180°');
    expect(summarizeLeaf(plain, 3)).toBe('3');
  });

  it("writes an object's fields that have a unit so, and leaves the rest", () => {
    const arc = {
      kind: 'object',
      name: 'Arc',
      description: '',
      default: {},
      children: { sweep: angle, shape: { name: 'Shape', members: { turn: angle } }, count: plain },
    } as const;
    expect(summarizeLeaf(arc, { sweep: Math.PI / 2, turn: Math.PI, count: 2 })).toBe(
      '{"sweep":"90°","turn":"180°","count":2}',
    );
  });

  it("writes the entries of a list and a map by the item's unit, and a union by its variant's", () => {
    const stops = {
      kind: 'list',
      name: 'Stops',
      description: '',
      default: [],
      item: angle,
    } as const;
    expect(summarizeLeaf(stops, [0, Math.PI / 2])).toBe('0°, 90°');
    const named = {
      kind: 'map',
      name: 'Named',
      description: '',
      default: {},
      item: angle,
    } as const;
    expect(summarizeLeaf(named, { half: Math.PI })).toBe('{"half":"180°"}');
    const shape = {
      kind: 'union',
      name: 'Shape',
      description: '',
      default: {},
      tag: 'type',
      variants: {
        arc: {
          kind: 'object',
          name: 'Arc',
          description: '',
          default: {},
          children: { sweep: angle },
        },
      },
    } as const;
    expect(summarizeLeaf(shape, { type: 'arc', sweep: Math.PI })).toBe(
      '{"type":"arc","sweep":"180°"}',
    );
  });

  it('writes a list of objects entry by entry', () => {
    const arcs = {
      kind: 'list',
      name: 'Arcs',
      description: '',
      default: [],
      item: {
        kind: 'object',
        name: 'Arc',
        description: '',
        default: {},
        children: { sweep: angle },
      },
    } as const;
    expect(summarizeLeaf(arcs, [{ sweep: Math.PI }])).toBe('{"sweep":"180°"}');
  });
});
