// src/tools/routing/reflection/ToolDebugOverlay.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ToolDebugOverlay } from './ToolDebugOverlay';
import type { RouteResolvedInfo } from './route-resolved';
import { asNodeId } from '../../../core/scene/types';

describe('ToolDebugOverlay', () => {
  it('shows the empty placeholder when info is null', () => {
    render(<ToolDebugOverlay info={null} />);
    expect(screen.getByText('No route resolved yet')).toBeDefined();
  });

  it('honors a custom emptyLabel', () => {
    render(<ToolDebugOverlay info={null} emptyLabel="Idle" />);
    expect(screen.getByText('Idle')).toBeDefined();
  });

  it('renders all six rows when info is resolved', () => {
    const info: RouteResolvedInfo = {
      toolId: 'select', phase: 'initial', gesture: 'click',
      matchedKey: 'rect', modifiers: 'shift',
      target: { category: 'node', kind: 'rect', id: asNodeId('node-42'), pose: {}, data: {} },
      timestamp: 1000,
    };
    render(<ToolDebugOverlay info={info} />);
    expect(screen.getByText('select')).toBeDefined();
    expect(screen.getByText('initial')).toBeDefined();
    expect(screen.getByText('click')).toBeDefined();
    expect(screen.getByText('rect')).toBeDefined();
    expect(screen.getByText('rect(node-42)')).toBeDefined();
    expect(screen.getByText('shift')).toBeDefined();
  });

  it('formats empty-target rows as "empty"', () => {
    const info: RouteResolvedInfo = {
      toolId: 'select', phase: 'initial', gesture: 'click',
      matchedKey: 'empty', modifiers: 'default',
      target: { category: 'empty', kind: 'empty' },
      timestamp: 1000,
    };
    const { container } = render(<ToolDebugOverlay info={info} />);
    // Both matchedKey and target render as the literal text "empty"; just
    // confirm the value cells contain it (one for matched, one for target).
    const values = within(container).getAllByText('empty');
    expect(values.length).toBe(2);
  });
});
