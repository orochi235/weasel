import { describe, expect, it } from 'vitest';
import { COMPOSITE_FRAG_SRC } from './effectPrelude';
import { COMPOSITE_WGSL } from '../gpu/webgpu/wgsl/composite';

describe('the composite pass', () => {
  it('clamps all four mapped channels before premultiplying, as every fill shader does', () => {
    expect(COMPOSITE_FRAG_SRC).toContain('clamp(u_colorMatrix * vec4(rgb, a) + u_colorBias, 0.0, 1.0)');
    expect(COMPOSITE_WGSL).toContain('saturate(u.u_colorMatrix * vec4f(rgb, a) + u.u_colorBias)');
  });
});
