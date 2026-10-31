import { act, screen } from '@testing-library/react';
import type { PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { PrefSchemaEditor } from '@weasel-js/ui/components/PrefSchemaEditor';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { f } from './builder';
import { configFromPrefs } from './fromPrefs';
import { resolveConfigSchema } from './resolve';
import { prefsFromConfig } from './toPrefs';
import type { ControlRenderer } from './types';

const swatch: ControlRenderer = () => null;
const listBody: ControlRenderer = () => null;
const wide = (config: Record<string, unknown>) => (config.cell as number) > 10;

const schema = f.schema({
  showGrid: f.boolean(true).section('Grid', { collapsed: true }),
  cell: f.number(20).range(5, 80).section('Grid'),
  tint: f.color('#ffffff').render(swatch).showIf({ path: 'showGrid' }),
  names: f.value<string[]>([]).dialog(listBody).showIf(wide),
  view: f
    .group({
      zoom: f.number(1).section('Camera'),
      spin: f.boolean(false),
    })
    .resettable()
    .label('View'),
});
const resolved = resolveConfigSchema(schema, []);
const prefs = prefsFromConfig(resolved);

describe('prefsFromConfig', () => {
  it('heads each section with a `PrefSection` over its nodes, and makes a group an `object` leaf at its key', () => {
    const grid = prefs.members.grid as PrefSection;
    expect(grid.name).toBe('Grid');
    expect(Object.keys(grid.members)).toEqual(['showGrid', 'cell']);
    const view = prefs.members.view as PrefLeaf & {
      children: Record<string, unknown>;
      group: unknown;
    };
    expect(view.kind).toBe('object');
    expect(view.group).toEqual({ resettable: true });
    expect(Object.keys((view.children.camera as PrefSection).members)).toEqual(['zoom']);
  });

  it('reads back through `f.prefs` as the schema it came from', () => {
    const again = resolveConfigSchema(configFromPrefs(prefs), []);
    expect(again.group).toEqual(resolved.group);
    expect(again.sections).toEqual(resolved.sections);
    expect([...again.showIf]).toEqual([...resolved.showIf]);
    expect(again.renderers).toEqual(resolved.renderers);
    expect(again.dialogs).toEqual(resolved.dialogs);
    expect(again.resettable).toEqual(resolved.resettable);
    expect(configFromPrefs(prefs).defaults()).toEqual(schema.defaults());
  });
});

function Live() {
  const [edited, setEdited] = useState(prefs);
  return <PrefSchemaEditor schema={edited} onChange={setEdited} />;
}

describe('a sectioned config in PrefSchemaEditor', () => {
  it('shows its sections in the structure tree', () => {
    renderWithIcons(<Live />);
    const tree = screen.getByRole('tree', { name: 'Schema structure' });
    const row = (id: string) => tree.querySelector(`[data-tree-id="${id}"]`);
    for (const id of ['grid', 'grid/showGrid', 'grid/cell', 'tint', 'view'])
      expect(row(id)).not.toBeNull();
  });

  it('exports its sections, conditions, renderers, and dialog rows', async () => {
    renderWithIcons(<Live />);
    await act(async () => {});
    const literal = screen.getByTestId('schema-literal').textContent ?? '';
    expect(literal).toMatch(/grid: \{\s*name: 'Grid',\s*collapsed: true,\s*members: \{/);
    expect(literal).toMatch(/showIf: \{\s*path: 'showGrid',\s*\}/);
    expect(literal).toMatch(/render: KEEP_FROM_SOURCE/);
    expect(literal).toMatch(/dialog: KEEP_FROM_SOURCE/);
    expect(literal).toMatch(/showWhen: KEEP_FROM_SOURCE/);
    expect(literal).toMatch(/camera: \{\s*name: 'Camera',\s*members: \{/);
  });
});
