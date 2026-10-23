import { describe, it, expect } from 'vitest';
import { createDispatchTrace, createTraceRing } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import type { NodeId } from 'core/scene/types';
import type { DevtoolsArea } from './protocol';
import { createDevtoolsRoot, type DevtoolsRootSource } from './root';

function setup() {
  const scene = createScene<unknown, string>({ systemLayers: [{ id: 'main' }] });
  const a = scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
  const source = {
    scene: () => scene as never,
    trace: createDispatchTrace(10, false),
    coords: createTraceRing(10, false),
  } as unknown as DevtoolsRootSource;
  const root = createDevtoolsRoot(source);
  const heard: DevtoolsArea[] = [];
  root.subscribe((area) => heard.push(area));
  return { scene, a, heard };
}

describe('a devtools root following its scene', () => {
  it('reports no scene change for a change of selection alone', () => {
    const { scene, a, heard } = setup();
    scene.setSelection([a]);
    scene.setSelection([]);
    expect(heard).not.toContain('scene');
  });

  it('reports an edit, and an edit that also drops a selected node', () => {
    const { scene, a, heard } = setup();
    scene.setPose(a as NodeId, { x: 5, y: 5, width: 10, height: 10 });
    expect(heard.filter((x) => x === 'scene')).toHaveLength(1);
    scene.setSelection([a]);
    scene.remove(a as NodeId);
    expect(heard.filter((x) => x === 'scene')).toHaveLength(2);
    expect(scene.getSelection()).toEqual([]);
  });
});
