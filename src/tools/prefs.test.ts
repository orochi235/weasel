import { describe, it, expect } from 'vitest';
import type {
  ToolPrefColor,
  ToolPrefCustom,
  ToolPrefGroup,
  ToolPrefLeaf,
  ToolPrefNumber,
} from './prefs';

describe('ToolPref schema additions', () => {
  it('accepts color, custom, pair, and unit fields', () => {
    const fill: ToolPrefColor = {
      kind: 'color',
      name: 'Fill',
      description: 'Fill color.',
      default: '#000000ff',
      alpha: true,
    };
    const x: ToolPrefNumber = {
      kind: 'number',
      name: 'X',
      description: 'Left edge.',
      default: 0,
      pair: 'Position',
    };
    const rotation: ToolPrefNumber = {
      kind: 'number',
      name: 'Rotation',
      description: 'Rotation about center.',
      default: 0,
      unit: {
        toDisplay: (rad) => (rad * 180) / Math.PI,
        fromDisplay: (deg) => (deg * Math.PI) / 180,
        suffix: '°',
      },
    };
    const custom: ToolPrefCustom = {
      kind: 'my-app-kind',
      name: 'Special',
      description: 'App-defined leaf.',
      default: null,
    };
    const group: ToolPrefGroup = {
      name: 'Layout',
      children: { 'pose.x': x, 'pose.rotation': rotation, 'data.fill': fill, 'data.special': custom },
    };
    const leaves: ToolPrefLeaf[] = [fill, x, rotation, custom];
    expect(Object.keys(group.children)).toHaveLength(4);
    expect(leaves).toHaveLength(4);
  });
});
