import { describe, expect, it } from 'vitest';
import { plainScene } from './testing/plainScene';
import { regionRenderArgs } from './regionRenderArgs';
import type { ExportScene } from './exportTypes';

describe('regionRenderArgs', () => {
  it('reads a background function from the document it draws, not the shown scene', () => {
    const { scene } = plainScene();
    const heard: ExportScene[] = [];
    const args = regionRenderArgs(scene, { x: 0, y: 0, width: 10, height: 10 }, {
      scale: 1, background: (doc) => { heard.push(doc); return '#ffffff'; },
    });
    expect(args.background).toBe('#ffffff');
    expect(heard).toHaveLength(1);
    expect(heard[0]).toBe(args.scene);
  });
});
