import { describe, it, expect } from 'vitest';
import { formatRouteResolved, type RouteResolvedInfo } from './route-resolved';
import { asNodeId } from '../../../core/scene/types';

describe('formatRouteResolved', () => {
  it('formats a default-modifier hit', () => {
    const info: RouteResolvedInfo = {
      toolId: 'select',
      phase: 'initial',
      gesture: 'click',
      arg: undefined,
      matchedKey: 'rect',
      modifiers: 'default',
      target: { category: 'node', kind: 'rect', id: asNodeId('a'), pose: {}, data: {} },
      timestamp: 1000,
    };
    expect(formatRouteResolved(info)).toBe('select [initial] click → rect');
  });

  it('appends modifier info when non-default', () => {
    const info: RouteResolvedInfo = {
      toolId: 'select',
      phase: 'initial',
      gesture: 'click',
      arg: undefined,
      matchedKey: 'rect',
      modifiers: 'shift',
      target: { category: 'node', kind: 'rect', id: asNodeId('a'), pose: {}, data: {} },
      timestamp: 1000,
    };
    expect(formatRouteResolved(info)).toBe('select [initial] click → rect mods=shift');
  });
});
