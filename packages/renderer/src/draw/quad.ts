import type { GpuGeometry } from '../gpu/types';
import type { ShaderProgram } from '../shaders/ShaderProgram';
import type { DrawContext } from './drawContext';
import { createPart } from '@weasel-js/registry';

/** The kit quad's geometry for each attribute layout a program links, per
 *  quad: most programs link `a_position` and `a_uv` alike, so a handful serve
 *  every shader command and effect pass. */
const layoutsOf = createPart<object, Map<string, GpuGeometry>>(() => new Map());

/** `QUAD_VERTICES` and `QUAD_INDICES` as `program` reads them: `a_position`
 *  and `a_uv` from one interleaved vertex of four floats. `null` without a quad. */
export function quadGeometry(ctx: DrawContext, program: ShaderProgram): GpuGeometry | null {
  const quad = ctx.quad;
  if (!quad) return null;
  const aPos = program.attribute('a_position');
  const aUv = program.attribute('a_uv');
  const key = `${aPos ?? -1},${aUv ?? -1}`;
  const byLayout = layoutsOf(quad);
  let geometry = byLayout.get(key);
  if (!geometry) {
    const attributes = [];
    if (aPos !== undefined) attributes.push({ location: aPos, components: 2 as const, offset: 0 });
    if (aUv !== undefined) attributes.push({ location: aUv, components: 2 as const, offset: 8 });
    geometry = ctx.gpu.createGeometry({
      vertexBuffers: [{ buffer: quad.vertices, stride: 16, attributes }],
      indexBuffer: quad.indices,
      indexFormat: 'uint16',
    });
    byLayout.set(key, geometry);
  }
  return geometry;
}
