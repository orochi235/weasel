import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

afterEach(cleanup);

// `PropertyRow` marks a changed row with `data-changed`, which is what its accent label is styled from.
const changedRows = (root: HTMLElement): string[] =>
  [...root.querySelectorAll('[data-changed]')].map((row) => row.textContent ?? '');

describe('<ControlPanel> changed', () => {
  it('marks the rows of the paths it names, and no others, whatever control draws them', () => {
    const schema = f.schema({
      size: f.number(1).label('Size'),
      blur: f.number(0.5).range(0, 1).label('Blur'),
      title: f.string('x').label('Title'),
      tags: f.list<string>([], f.string('')).label('Tags'),
      mode: f.enum('a', ['a', 'b']).label('Mode'),
      look: f.group({ tint: f.color('#ffffff').label('Tint') }),
      alias: f.alias('size').label('Size again'),
    });
    const { container } = render(
      <ControlPanel
        schema={resolveConfigSchema(schema, [])}
        config={schema.defaults()}
        setConfig={() => {}}
        changed={new Set(['size', 'blur', 'title', 'tags', 'look.tint'])}
      />,
    );
    const marked = changedRows(container);
    for (const label of ['Size', 'Blur', 'Title', 'Tags', 'Tint', 'Size again'])
      expect(marked.some((text) => text.startsWith(label))).toBe(true);
    expect(marked.some((text) => text.startsWith('Mode'))).toBe(false);
  });

  it('marks a paired row when any of its cells changed', () => {
    const schema = f.schema({
      x: f.number(0).label('X').pair({ with: ['y'], label: 'Offset' }),
      y: f.number(0).label('Y'),
    });
    const { container } = render(
      <ControlPanel
        schema={resolveConfigSchema(schema, [])}
        config={schema.defaults()}
        setConfig={() => {}}
        changed={new Set(['y'])}
      />,
    );
    expect(changedRows(container)).toHaveLength(1);
  });

  it('tells a custom renderer its row is changed, and marks a .dialog row', () => {
    const seen: (boolean | undefined)[] = [];
    const schema = f.schema({
      own: f.number(1).render((ctx) => (seen.push(ctx.changed), <span>own</span>)),
      plain: f.number(1).render((ctx) => (seen.push(ctx.changed), <span>plain</span>)),
      notes: f
        .list<string>([], f.string(''))
        .label('Notes')
        .dialog(() => null),
    });
    const { container } = render(
      <ControlPanel
        schema={resolveConfigSchema(schema, [])}
        config={schema.defaults()}
        setConfig={() => {}}
        changed={new Set(['own', 'notes'])}
      />,
    );
    expect(seen.slice(0, 2)).toEqual([true, false]);
    expect(changedRows(container).some((text) => text.startsWith('Notes'))).toBe(true);
  });

  it('marks nothing without a changed set', () => {
    const schema = f.schema({ size: f.number(1) });
    const { container } = render(
      <ControlPanel schema={resolveConfigSchema(schema, [])} config={{ size: 3 }} setConfig={() => {}} />,
    );
    expect(changedRows(container)).toEqual([]);
  });
});
