import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  createScene,
  asNodeId,
  type NodePropertiesEntry,
  type NodeRoutingEntry,
} from '@weasel-js/core';
import { SelectionPanel } from './SelectionPanel';
import {
  type Layer,
  type Pose,
  routing,
  properties,
  makeScene,
  selectionOf,
} from './testing/rectScene';

/**
 * A leaf is handed one field, so a control whose subject spans several — a
 * font picker naming the variant that will actually paint — could not see the
 * rest of the node.
 */
describe('SelectionPanel — valueAt', () => {
  interface SpanData { kind: string; a?: unknown; b?: unknown }

  const spanRouting: NodeRoutingEntry[] = [
    { name: 'span', matches: (d) => (d as SpanData)?.kind === 'span' },
  ];
  const spanProperties: NodePropertiesEntry[] = [
    {
      name: 'span',
      schema: {
        name: 'Properties',
        members: {
          group: {
            name: 'Group',
            members: {
              'data.a': { kind: 'string', name: 'A', description: '', default: '' },
              'data.b': { kind: 'string', name: 'B', description: '', default: '' },
            },
          },
        },
      },
    },
  ];

  function sceneOf(rows: { id: string; a: unknown; b: unknown }[]) {
    const scene = createScene<SpanData, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
    for (const r of rows) {
      scene.add({
        id: asNodeId(r.id),
        kind: 'mark',
        layer: 'default',
        pose: { x: 0, y: 0, width: 10, height: 10 },
        data: { kind: 'span', a: r.a, b: r.b },
      });
    }
    return scene;
  }

  function renderSpan(rows: { id: string; a: unknown; b: unknown }[], seen: unknown[]) {
    render(
      <SelectionPanel
        scene={sceneOf(rows)}
        selection={selectionOf(rows.map((r) => r.id))}
        properties={spanProperties}
        routing={spanRouting}
        renderers={{
          'data.a': (ctx) => {
            seen.push(ctx.valueAt('data.b'));
            return <span>a</span>;
          },
        }}
      />,
    );
  }

  it("hands a renderer another leaf's aggregated value", () => {
    const seen: unknown[] = [];
    renderSpan([{ id: 'n1', a: 'x', b: 700 }], seen);
    expect(seen[0]).toEqual({ value: 700, mixed: false });
  });

  it('reports a disagreeing selection as mixed, not as one node\'s value', () => {
    const seen: unknown[] = [];
    renderSpan([{ id: 'n1', a: 'x', b: 700 }, { id: 'n2', a: 'x', b: 400 }], seen);
    expect(seen[0]).toEqual({ value: undefined, mixed: true });
  });

  it('reports a path no node carries as an undefined value, not as mixed', () => {
    const seen: unknown[] = [];
    renderSpan([{ id: 'n1', a: 'x', b: undefined }], seen);
    expect(seen[0]).toEqual({ value: undefined, mixed: false });
  });
});

describe('SelectionPanel — selectionKey', () => {
  it('hands a renderer the selected ids, joined, as the selection key', () => {
    const seen: (string | undefined)[] = [];
    render(
      <SelectionPanel
        scene={makeScene()}
        selection={selectionOf(['a', 'b'])}
        properties={properties}
        routing={routing}
        renderers={{ 'data.label': (ctx) => { seen.push(ctx.selectionKey); return <span>label</span>; } }}
      />,
    );
    expect(seen[0]).toBe('a,b');
  });

  it('skips dead ids, so the key names only the nodes the values came from', () => {
    const seen: (string | undefined)[] = [];
    render(
      <SelectionPanel
        scene={makeScene()}
        selection={selectionOf(['gone', 'a'])}
        properties={properties}
        routing={routing}
        renderers={{ 'data.label': (ctx) => { seen.push(ctx.selectionKey); return <span>label</span>; } }}
      />,
    );
    expect(seen[0]).toBe('a');
  });
});
