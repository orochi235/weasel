import { describe, expect, it } from 'vitest';
import type { DrawCommand, GroupDrawCommand } from '@weasel-js/renderer';
import { drawLayers, type LayerCommandCache, type LayerRetainPolicy, type RenderLayer } from './render';
import type { View } from 'core/viewport/view';

const DIMS = { width: 100, height: 100, dpr: 1 };
const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const POLICY: LayerRetainPolicy = { minCommands: 3 };

function rects(n: number): DrawCommand[] {
  return Array.from({ length: n }, (_, i) => ({
    kind: 'path' as const,
    path: { kind: 'rect' as const, x: i, y: 0, width: 1, height: 1 },
    fill: { paint: { kind: 'solid' as const, color: '#fff' } },
  }));
}

function layer(over: Partial<RenderLayer<number>> = {}, size = 4): RenderLayer<number> {
  const cmds = rects(size);
  return { id: 'big', label: 'Big', draw: () => cmds, deps: (d) => [d], ...over };
}

/** The `retain` each frame's top-level groups carried, frame by frame. */
function frames(
  l: RenderLayer<number>, inputs: { data: number; view?: View }[], policy: LayerRetainPolicy | false = POLICY,
): (string | undefined)[] {
  const cache: LayerCommandCache = new Map();
  return inputs.map(({ data, view }) => {
    const out = drawLayers([l], data, {}, undefined, view ?? VIEW, DIMS, cache, undefined, undefined, undefined, policy);
    return out[0]?.kind === 'group' ? (out[0] as GroupDrawCommand).retain : undefined;
  });
}

describe('drawLayers retaining a layer', () => {
  it('retains a layer from the frame after its deps last changed', () => {
    expect(frames(layer(), [{ data: 1 }, { data: 1 }, { data: 1 }, { data: 2 }, { data: 2 }]))
      .toEqual([undefined, 'big', 'big', undefined, 'big']);
  });

  it('does not retain a world layer while the view moves under it', () => {
    const moved = { x: 5, y: 0, scale: { x: 1, y: 1 } };
    expect(frames(layer(), [{ data: 1 }, { data: 1 }, { data: 1, view: moved }, { data: 1, view: moved }]))
      .toEqual([undefined, 'big', undefined, 'big']);
  });

  it('retains a screen layer through a moving view, wrapping its commands to carry the id', () => {
    const moved = { x: 5, y: 0, scale: { x: 1, y: 1 } };
    expect(frames(layer({ space: 'screen' }), [{ data: 1 }, { data: 1, view: moved }]))
      .toEqual([undefined, 'big']);
  });

  it('leaves a layer below the threshold, unless it asks', () => {
    expect(frames(layer({}, 2), [{ data: 1 }, { data: 1 }])).toEqual([undefined, undefined]);
    expect(frames(layer({ retain: true }, 2), [{ data: 1 }, { data: 1 }])).toEqual([undefined, 'big']);
  });

  it('counts commands inside groups, not the groups', () => {
    const nested: DrawCommand[] = [{ kind: 'group', children: [{ kind: 'group', children: rects(3) }] }];
    expect(frames(layer({ draw: () => nested }), [{ data: 1 }, { data: 1 }])).toEqual([undefined, 'big']);
  });

  it('never retains a layer that opts out, has no deps, or carries effects, or under a false policy', () => {
    const effect = { program: { id: 'fx' } };
    expect(frames(layer({ retain: false }), [{ data: 1 }, { data: 1 }])).toEqual([undefined, undefined]);
    expect(frames(layer({ deps: undefined }), [{ data: 1 }, { data: 1 }])).toEqual([undefined, undefined]);
    expect(frames(layer({ effects: [effect] }), [{ data: 1 }, { data: 1 }])).toEqual([undefined, undefined]);
    expect(frames(layer(), [{ data: 1 }, { data: 1 }], false)).toEqual([undefined, undefined]);
  });

  it('hands the renderer the cached array itself, so its identity names the pixels', () => {
    const l = layer();
    const cache: LayerCommandCache = new Map();
    const draw = () => drawLayers([l], 1, {}, undefined, VIEW, DIMS, cache, undefined, undefined, undefined, POLICY);
    const first = draw()[0] as GroupDrawCommand;
    const second = draw()[0] as GroupDrawCommand;
    expect(second.retain).toBe('big');
    expect(second.children).toBe(first.children);
  });
});
