import { describe, expect, it, vi } from 'vitest';
import { outlinePath } from '../outline';

const NAMES = [
  'server', 'router', 'switch', 'firewall', 'laptop', 'desktop', 'phone', 'printer', 'user', 'globe', 'disk',
  'event', 'intermediateEvent', 'exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventGateway', 'subprocess',
];

describe('the network and BPMN outlines', () => {
  it('resolve with no stencil group imported, so a saved chart naming one paints as itself', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const box = { x: 0, y: 0, width: 96, height: 88 };
    const rect = outlinePath('rect', box);
    for (const name of NAMES) expect(outlinePath(name, box), name).not.toEqual(rect);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
