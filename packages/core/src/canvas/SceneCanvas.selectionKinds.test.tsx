/**
 * Two things on a canvas name a node's kind, and they disagree: the label
 * published with the selection (`SelectionContextValue.kinds`), and the
 * routing kind a binding's `kind:` target and `Hit.kind` speak. This pins
 * both answers for the same nodes. They agree only on a container, `'group'`.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { SelectionContextProvider, useSelectionContext } from '@weasel-js/routing/react';
import { SceneCanvas } from './SceneCanvas';
import { useOptionalViewInputs } from './viewInputs';
import { createScene } from 'core/scene/scene';
import { asNodeId, type Node, type NodeId, type Scene } from 'core/scene/types';
import type { NodeRoutingEntry } from 'core/scene/NodeRouting';

type D = Record<string, unknown>;
type L = 'main';
type P = Record<string, unknown>;

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
});

const BOX = { x: 0, y: 0, width: 10, height: 10 };
const NODES: Record<string, { kind: 'leaf' | 'container'; pose: P; data: D }> = {
  pathData: { kind: 'leaf', pose: BOX, data: { path: { kind: 'rect', ...BOX } } },
  pathPose: { kind: 'leaf', pose: { kind: 'rect', ...BOX }, data: { kind: 'rect' } },
  rect: { kind: 'leaf', pose: BOX, data: { kind: 'rect' } },
  text: { kind: 'leaf', pose: BOX, data: { text: 'hi' } },
  image: { kind: 'leaf', pose: BOX, data: { image: { src: 'a.png' } } },
  card: { kind: 'leaf', pose: BOX, data: { card: true } },
  group: { kind: 'container', pose: BOX, data: {} },
};
const IDS = Object.keys(NODES).map(asNodeId);

function makeScene(): Scene<D, L, P> {
  const s = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  for (const [id, n] of Object.entries(NODES)) {
    s.add({ id: asNodeId(id), layer: 'main', ...n } as Parameters<typeof s.add>[0]);
  }
  return s;
}

interface Seen {
  label?: readonly (string | undefined)[];
  ids?: readonly NodeId[];
  routing?: (id: string) => string | undefined;
}

function Inside({ seen }: { seen: Seen }) {
  seen.routing = useOptionalViewInputs()!.kindOfNode;
  return null;
}
function Outside({ seen }: { seen: Seen }) {
  const ctx = useSelectionContext();
  seen.label = ctx?.kinds;
  seen.ids = ctx?.selection;
  return null;
}

function answers(props: {
  routing?: readonly NodeRoutingEntry[];
  describeKind?: (node: Node<D, L, P>) => string | undefined;
} = {}) {
  const scene = makeScene();
  const seen: Seen = {};
  render(
    <SelectionContextProvider>
      <SceneCanvas<D, L, P> scene={scene} width={200} height={200} {...props}>
        <Inside seen={seen} />
      </SceneCanvas>
      <Outside seen={seen} />
    </SelectionContextProvider>,
  );
  act(() => scene.setSelection([...IDS]));
  expect(seen.ids).toEqual(IDS);
  const table: Record<string, { label: string | undefined; routing: string | undefined }> = {};
  IDS.forEach((id, i) => {
    table[id] = { label: seen.label?.[i], routing: seen.routing?.(id) };
  });
  return { table, seen, scene };
}

describe('the two kind classifiers on one canvas', () => {
  it('the published label reads the node and its pose; the routing kind reads the data, and a container', () => {
    expect(answers().table).toEqual({
      pathData: { label: undefined, routing: 'path' },
      pathPose: { label: 'path', routing: 'unknown' },
      rect: { label: undefined, routing: 'unknown' },
      text: { label: undefined, routing: 'text' },
      image: { label: undefined, routing: 'image' },
      card: { label: undefined, routing: 'unknown' },
      group: { label: 'group', routing: 'group' },
    });
  });

  it('a registered routing kind changes the routing answer and not the label', () => {
    const routing = [{ name: 'card', matches: (d: unknown) => (d as D).card === true }];
    const { table } = answers({ routing });
    expect(table.card).toEqual({ label: undefined, routing: 'card' });
    expect(table.pathData).toEqual({ label: undefined, routing: 'unknown' });
    // A routing table without the group entry leaves a container unrouted.
    expect(table.group).toEqual({ label: 'group', routing: 'unknown' });
  });

  it('describeKind replaces the label heuristic outright, containers included', () => {
    const { table } = answers({ describeKind: (n) => (n.kind === 'container' ? undefined : 'thing') });
    expect(table.group.label).toBeUndefined();
    expect(table.pathPose.label).toBe('thing');
    expect(table.rect.label).toBe('thing');
    expect(table.rect.routing).toBe('unknown');
  });

  it('publishes no labels for an empty selection, and undefined for an id the scene lacks', () => {
    const { seen, scene } = answers();
    act(() => scene.setSelection([]));
    expect(seen.label).toBeUndefined();
    act(() => scene.setSelection([asNodeId('gone'), asNodeId('group')]));
    expect(seen.label).toEqual([undefined, 'group']);
  });
});
