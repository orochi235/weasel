import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { INSERT_REPOSITION_BINDING } from 'interactions/actions/insert/repositionAction';
import { solid } from '../../../util/paint';
import { STICKY_DEFAULTS } from './stickyNode';
import { useStickyTool } from './useStickyTool';

const bindingFor = (tool: ReturnType<typeof useStickyTool>, kind: string, target?: string) =>
  tool.bindings!.find((b) => b.spec.kind === kind && (b.spec as { target?: string }).target === target);

describe('useStickyTool', () => {
  it('is the sticky tool, bound to S', () => {
    const { result } = renderHook(() => useStickyTool());
    expect(result.current.id).toBe('sticky');
    expect(result.current.keybinding).toEqual({ key: 'S' });
    expect(result.current.presentation?.label).toBe('Sticky note');
  });

  it('draws a sticky with a drag, through insert', () => {
    const { result } = renderHook(() => useStickyTool());
    expect(bindingFor(result.current, 'drag')).toEqual({
      spec: { kind: 'drag' }, actionId: 'insert', opts: { params: { kind: 'sticky' } },
    });
  });

  it('places a default-size sticky with a click, through place', () => {
    const { result } = renderHook(() => useStickyTool());
    expect(bindingFor(result.current, 'click')).toEqual({
      spec: { kind: 'click' }, actionId: 'place', opts: { params: { kind: 'sticky', size: STICKY_DEFAULTS.size } },
    });
  });

  it('edits the selected sticky on a click on it', () => {
    const { result } = renderHook(() => useStickyTool());
    expect(bindingFor(result.current, 'click', 'selected-body')?.actionId).toBe('enterTextEdit');
  });

  it('repositions a sticky mid-draw, as the shape tools do', () => {
    const { result } = renderHook(() => useStickyTool());
    expect(result.current.bindings).toContain(INSERT_REPOSITION_BINDING);
  });

  it('carries the look it is given onto both inserts', () => {
    const background = { paint: solid('#a6e1ff') };
    const size = { width: 90, height: 60 };
    const { result } = renderHook(() => useStickyTool({ background, padding: 6, size }));
    expect(bindingFor(result.current, 'drag')?.opts?.params).toEqual({ kind: 'sticky', background, padding: 6 });
    expect(bindingFor(result.current, 'click')?.opts?.params).toEqual({ kind: 'sticky', background, padding: 6, size });
  });

  it('passes insert behaviors to the drag', () => {
    const behaviors = [{ id: 'b' }] as never[];
    const { result } = renderHook(() => useStickyTool({ behaviors }));
    expect(bindingFor(result.current, 'drag')?.opts?.behaviors).toEqual(behaviors);
  });
});
