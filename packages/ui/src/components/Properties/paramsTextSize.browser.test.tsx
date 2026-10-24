import '@weasel-js/theme/tokens.css';
import { Fragment, type ReactNode } from 'react';
import { cleanup } from '@testing-library/react';
import { asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry } from '@weasel-js/core';
import { PREF_KINDS, type PrefLeaf, type PrefSection } from '@weasel-js/prefs';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { DetailList, DetailRow } from '../DetailList';
import { PrefsForm } from '../Prefs/PrefsForm';
import { SelectionPanel } from '../SelectionPanel';
import { PropertyField } from './PropertyField';
import type { PropertyFieldKind } from './fieldTypes';
import type { PropertyRowLayout } from './PropertyRow';
import { PropertyList } from './PropertyList';
import { PropertyPanel } from './PropertyPanel';
import { renderWithIcons } from '../../testing/withIcons';
import { EVERY_KIND, LEAVES_BY_KIND, mismatches, notAt, rowTexts } from '../../testing/paramsText';

// A row's label and its value are set at one size, `--wzl-params-text-size`, on every params surface and for
// every kind of field. Computed sizes are a browser's to answer: jsdom resolves no `var()`.

afterEach(cleanup);

beforeAll(() => {
  const style = document.createElement('style');
  // Far from every type-scale step, so a size taken from anywhere but the property shows.
  style.textContent = '.big { --wzl-params-text-size: 18px; }';
  document.head.append(style);
});

const noop = () => {};

/** One field of every kind `PropertyField` draws. A `Record`, so a new kind does not compile until it is here. */
const FIELDS: Record<PropertyFieldKind, (layout: PropertyRowLayout) => ReactNode> = {
  boolean: (layout) => (
    <>
      <PropertyField layout={layout} kind="boolean" label="Visible" value onChange={noop} />
      <PropertyField layout={layout} kind="boolean" control="switch" label="Snap" value={false} onChange={noop} />
      <PropertyField layout={layout} kind="boolean" control="toggle" label="Bold" value={false} onChange={noop} />
    </>
  ),
  number: (layout) => (
    <>
      <PropertyField layout={layout} kind="number" label="Count" value={4} onChange={noop} />
      <PropertyField layout={layout} kind="number" label="Width" value={12} unit="px" onChange={noop} />
      <PropertyField layout={layout} kind="number" control="slider" label="Gain" value={3} min={0} max={10} onChange={noop} />
      <PropertyField layout={layout} kind="number" label="Depth" value={2} readOnly onChange={noop} />
    </>
  ),
  string: (layout) => (
    <>
      <PropertyField layout={layout} kind="string" label="Title" value="Untitled" onChange={noop} />
      <PropertyField layout={layout} kind="string" control="textarea" label="Notes" value="Two words" onChange={noop} />
    </>
  ),
  enum: (layout) => (
    <>
      {(['select', 'toggle', 'radio'] as const).map((control) => (
        <PropertyField
          key={control}
          layout={layout}
          kind="enum"
          control={control}
          label={`Mode ${control}`}
          value="fill"
          options={[
            { value: 'fill', label: 'Fill' },
            { value: 'fit', label: 'Fit' },
          ]}
          onChange={noop}
        />
      ))}
    </>
  ),
  color: (layout) => <PropertyField layout={layout} kind="color" label="Tint" value="#336699" onChange={noop} />,
  paint: (layout) => (
    <>
      <PropertyField layout={layout} kind="paint" label="Ground" value={{ color: '#cc8844' }} onChange={noop} />
      <PropertyField layout={layout} kind="paint" control="inline" label="Fill" value={{ color: '#cc8844' }} onChange={noop} />
    </>
  ),
  'font-family': (layout) => <PropertyField layout={layout} kind="font-family" label="Face" value="Inter" onChange={noop} />,
  'font-weight': (layout) => <PropertyField layout={layout} kind="font-weight" label="Weight" value={400} onChange={noop} />,
};

const fields = (layout: PropertyRowLayout) => Object.values(FIELDS).map((draw, i) => <Fragment key={i}>{draw(layout)}</Fragment>);

/** Every kind's leaves, keyed at `data.<key>` as a node's properties read them. */
function asSection(): PrefSection {
  const at = (path: string) => `data.${path}`;
  const members: Record<string, PrefLeaf> = {};
  for (const leaves of Object.values(LEAVES_BY_KIND)) {
    for (const [key, leaf] of Object.entries(leaves)) {
      let moved: PrefLeaf = leaf;
      if (leaf.kind === 'alias') moved = { ...leaf, of: at((leaf as { of: string }).of) } as PrefLeaf;
      if (leaf.pair) moved = { ...leaf, pair: { ...leaf.pair, with: at(leaf.pair.with as string) } };
      members[at(key)] = moved;
    }
  }
  return { name: 'Every kind', members };
}

function Selection() {
  const scene = createScene<unknown, 'default', unknown>({ systemLayers: [{ id: 'default' }] });
  const data = Object.fromEntries(
    Object.values(LEAVES_BY_KIND).flatMap((leaves) => Object.entries(leaves).map(([k, l]) => [k, l.default])),
  );
  scene.add({ id: asNodeId('n'), kind: 'mark', layer: 'default', pose: {}, data });
  const properties: NodePropertiesEntry[] = [{ name: 'every', schema: asSection() }];
  const routing: NodeRoutingEntry[] = [{ name: 'every', matches: () => true }];
  return <SelectionPanel scene={scene} selection={{ current: [asNodeId('n')] }} properties={properties} routing={routing} />;
}

const SURFACES: Record<string, () => ReactNode> = {
  'PropertyList, stacked': () => <PropertyList>{fields('block')}</PropertyList>,
  'PropertyList, inline': () => <PropertyList>{fields('inline')}</PropertyList>,
  PropertyPanel: () => (
    <PropertyPanel title="Every kind">
      <PropertyList>{fields('inline')}</PropertyList>
    </PropertyPanel>
  ),
  'Prefs, form': () => <PrefsForm schema={EVERY_KIND} values={{}} onChange={noop} />,
  'Prefs, rail': () => (
    <div style={{ width: 820, height: 1600, display: 'flex' }}>
      <PrefsForm layout="rail" schema={EVERY_KIND} values={{}} onChange={noop} />
    </div>
  ),
  SelectionPanel: () => <Selection />,
  DetailList: () => (
    <DetailList title="Details">
      <DetailRow label="Name">Untitled</DetailRow>
      <DetailRow label="Size" values="figures">12.50</DetailRow>
      <DetailRow label="State" grade="success">Ready</DetailRow>
      <DetailRow label="Empty" />
    </DetailList>
  ),
};

test('every built-in pref kind has leaves to draw', () => {
  expect(Object.keys(LEAVES_BY_KIND).sort()).toEqual(Object.keys(PREF_KINDS).sort());
});

describe.each(Object.entries(SURFACES))('%s', (_, surface) => {
  test('sets every value at its row label’s size', () => {
    const { container } = renderWithIcons(<div style={{ width: 420 }}>{surface()}</div>);
    const rows = rowTexts(container);
    expect(rows.length).toBeGreaterThan(3);
    expect(mismatches(rows).join('\n')).toBe('');
  });

  test('sets every label and value at the size an ancestor gives --wzl-params-text-size', () => {
    const { container } = renderWithIcons(<div className="big" style={{ width: 420 }}>{surface()}</div>);
    expect(notAt(rowTexts(container), '18px').join('\n')).toBe('');
  });
});
