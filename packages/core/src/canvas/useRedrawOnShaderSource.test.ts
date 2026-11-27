import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { registerProgram } from '@weasel-js/renderer';
import { useRedrawOnShaderSource } from './useCanvasRenderer';

const frag = (body: string) => `#version 300 es\nprecision highp float;\nout vec4 o;\nvoid main() { ${body} }`;

describe('useRedrawOnShaderSource', () => {
  it("repaints when a program whose id contains '|' gets new source", () => {
    const handle = registerProgram('pipe|id', { glsl: { frag: frag('o = vec4(0.0);') } });
    const redraw = vi.fn();
    renderHook(() => useRedrawOnShaderSource([handle], redraw));
    act(() => { registerProgram('pipe|id', { glsl: { frag: frag('o = vec4(1.0);') } }, { replace: true }); });
    expect(redraw).toHaveBeenCalled();
  });
});
