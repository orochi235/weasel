import { describe, it, expect } from 'vitest';
import { defaultDrawOne } from '@weasel-js/core';
import type { AddNodeSpec, PathDrawCommand, RectPose, SceneNode } from '@weasel-js/core';
import { INITIAL_NODES as WEASEL_LAB } from './weasel-lab/SceneInstrument';
import { INITIAL_NODES as MINIMAL } from './minimal/StubInstrument';
import { INITIAL_NODES as DRAG_LAB } from './drag-lab/GardenInstrument';

/** The fill the kit's default painter gives a node, or `undefined`. */
function paintedFill(spec: AddNodeSpec<unknown, 'default', RectPose>) {
  const node = { id: 'n', parent: null, ...spec } as unknown as SceneNode<unknown, 'default', RectPose>;
  const cmd = defaultDrawOne(node, spec.pose as RectPose)[0] as PathDrawCommand | undefined;
  return cmd?.fill;
}

const EXAMPLES = { 'weasel-lab': WEASEL_LAB, minimal: MINIMAL, 'drag-lab': DRAG_LAB };

describe.each(Object.entries(EXAMPLES))('%s initial nodes', (_name, nodes) => {
  it('paint in distinct colors rather than the painter fallback gray', () => {
    const fills = (nodes as readonly AddNodeSpec<unknown, 'default', RectPose>[]).map(paintedFill);
    for (const fill of fills) expect(fill).not.toEqual({ color: '#888' });
    expect(new Set(fills.map((f) => JSON.stringify(f))).size).toBe(fills.length);
  });
});
