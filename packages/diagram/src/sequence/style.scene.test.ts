import { createScene, type RectPose } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { withDiagramRegistry } from '../edge';
import { diagramStyleOf, setDiagramColor, setDiagramStyle } from '../theme/applyTheme';
import { SEQ_FIXTURE as data } from './fixture';
import { sequenceSpecs } from './specs';

const sceneOf = () => createScene<unknown, 'main', RectPose>({
  systemLayers: [{ id: 'main' }], initial: sequenceSpecs(data, { id: 'seq', at: { x: 0, y: 0 } }) as never, registry: withDiagramRegistry(),
});

describe('a sequence and its parts', () => {
  it('are not styleable shapes, so a role or a hand color makes no edit the next redraw would lose', () => {
    const scene = sceneOf();
    const ids = scene.renderOrderNodes().map((n) => n.id);
    expect(ids.filter((id) => diagramStyleOf(scene.get(id as never)!) !== null)).toEqual([]);
    setDiagramStyle(scene, ids, 'accent');
    setDiagramColor(scene, ids, 'fill', '#123456');
    expect(scene.canUndo()).toBe(false);
  });
});
