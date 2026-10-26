import { cleanup, render, screen } from '@testing-library/react';
import { IDENTITY_POSE_COMPOSITION, asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry } from '@weasel-js/core';
import type { PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { afterEach, describe, expect, it } from 'vitest';
import { SelectionPanel } from './SelectionPanel';

afterEach(cleanup);

const flag = (name: string, more: Partial<PrefLeaf> = {}): PrefLeaf =>
  ({ kind: 'boolean', name, description: '', default: false, control: 'switch', ...more }) as PrefLeaf;
const num = (name: string): PrefLeaf => ({ kind: 'number', name, description: '', default: 0 }) as PrefLeaf;

const routing: NodeRoutingEntry[] = [{ name: 'thing', matches: () => true }];

function mount(schema: PrefSection, data: Record<string, unknown>) {
  const scene = createScene<unknown, 'default', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('n'), kind: 'mark', layer: 'default', pose: {}, data });
  const properties: NodePropertiesEntry[] = [{ name: 'thing', schema }];
  return render(<SelectionPanel scene={scene} selection={{ current: [asNodeId('n')] }} properties={properties} routing={routing} />);
}

// The classes are a proxy: the CSS-module proxy answers any key, so these show only that a title asked to dim.
const dimmed = (el: Element): boolean => el.closest('[class*="_off_"], [class*="_titleOff_"]') !== null;

const switched = (as?: PrefSection['as']): PrefSection => ({
  name: 'Thing',
  members: {
    shadow: {
      name: 'Shadow',
      ...(as ? { as } : {}),
      ...(as === 'bar' ? { lead: 'label' as const } : {}),
      enableIf: { path: 'data.shadow' },
      members: { 'data.shadow': flag('Shadow on', { heading: true }), 'data.blur': num('Blur') },
    },
  },
});

describe("a section its enableIf turns off, in SelectionPanel", () => {
  it('dims its title and leaves its switch live', () => {
    mount(switched(), { shadow: false, blur: 4 });
    expect(dimmed(screen.getByText('Shadow'))).toBe(true);
    expect(screen.getByRole('switch', { name: 'Shadow' })).toBeEnabled();
    expect(screen.getByRole('spinbutton', { name: 'Blur' })).toBeDisabled();
  });

  it('does not dim it while the condition holds', () => {
    mount(switched(), { shadow: true, blur: 4 });
    expect(dimmed(screen.getByText('Shadow'))).toBe(false);
  });

  it('dims a panel section’s title and marks its frame', () => {
    mount(switched('panel'), { shadow: false, blur: 4 });
    expect(dimmed(screen.getByText('Shadow'))).toBe(true);
    expect(screen.getByText('Shadow').closest('[data-disabled]')).not.toBeNull();
    expect(screen.getByRole('switch', { name: 'Shadow' })).toBeEnabled();
  });

  it("dims the title of a section inside an object leaf, and the leaf's switch field stays live", () => {
    const schema: PrefSection = {
      name: 'Thing',
      members: {
        'data.stroke': {
          kind: 'object',
          name: 'Stroke',
          description: '',
          default: {},
          children: { edge: { name: 'Edge', enableIf: { path: 'data.stroke.on' }, members: { on: flag('Edge on'), width: num('Width') } } },
        } as PrefLeaf,
      },
    };
    mount(schema, { stroke: { on: false, width: 1 } });
    expect(dimmed(screen.getByText('Edge'))).toBe(true);
    expect(screen.getByRole('switch', { name: 'Edge on' })).toBeEnabled();
    cleanup();
    mount(schema, { stroke: { on: true, width: 1 } });
    expect(dimmed(screen.getByText('Edge'))).toBe(false);
  });

  it.each(['tab', 'bar'] as const)('as %s: dims its name only while off', (as) => {
    mount(switched(as), { shadow: false, blur: 4 });
    expect(dimmed(screen.getByText('Shadow'))).toBe(true);
    cleanup();
    mount(switched(as), { shadow: true, blur: 4 });
    expect(dimmed(screen.getByText('Shadow'))).toBe(false);
  });

  it.each(['tab', 'bar'] as const)('as %s inside an object leaf: dims its name only while off', (as) => {
    const schema = (on: boolean): [PrefSection, Record<string, unknown>] => [{
      name: 'Thing',
      members: {
        'data.stroke': {
          kind: 'object',
          name: 'Stroke',
          description: '',
          default: {},
          children: {
            on: flag('Edge on'),
            edge: { name: 'Edge', as, ...(as === 'bar' ? { lead: 'label' as const } : {}), enableIf: { path: 'data.stroke.on' }, members: { width: num('Width') } },
          },
        } as PrefLeaf,
      },
    }, { stroke: { on, width: 1 } }];
    mount(...schema(false));
    expect(dimmed(screen.getByText('Edge'))).toBe(true);
    cleanup();
    mount(...schema(true));
    expect(dimmed(screen.getByText('Edge'))).toBe(false);
  });
});
