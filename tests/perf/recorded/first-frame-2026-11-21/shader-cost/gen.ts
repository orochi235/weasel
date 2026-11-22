import { writeFileSync } from 'node:fs';
import { BATCH_VERT_SRC, BATCH_AREA_VERT_SRC, BATCH_FRAG_SRC, batchAreaFragSrc } from '../../../../../packages/renderer/src/shaders/batchFill';
import { withIdOutput } from '../../../../../packages/renderer/src/shaders/idOutput';

function tree(lo: number, hi: number, fetch: string, indent = '  '): string {
  if (lo === hi) return `${indent}return ${fetch.replace('%s', `u_samplers[${lo}]`)};`;
  const mid = (lo + hi + 1) >> 1;
  return [`${indent}if (slot < ${mid}) {`, tree(lo, mid - 1, fetch, `${indent}  `), `${indent}} else {`, tree(mid, hi, fetch, `${indent}  `), `${indent}}`].join('\n');
}
/** Replace the body of the function whose header is `head` with `body`. */
function body(src: string, head: string, inner: string): string {
  const a = src.indexOf(head);
  if (a < 0) throw new Error(`no ${head}`);
  let i = src.indexOf('{', a) + 1, depth = 1;
  for (; depth > 0; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') depth--; }
  return `${src.slice(0, src.indexOf('{', a) + 1)}\n${inner}\n}${src.slice(i)}`;
}
const area = batchAreaFragSrc(false, false);
const v: Record<string, { vert: string; frag: string }> = {
  'batch': { vert: BATCH_VERT_SRC, frag: BATCH_FRAG_SRC },
  'batch slots=8': { vert: BATCH_VERT_SRC, frag: body(BATCH_FRAG_SRC, 'vec4 sampleSlot(', tree(0, 7, 'texture(%s, uv)') + '\n  return vec4(0.0);') },
  'batch slots=4': { vert: BATCH_VERT_SRC, frag: body(BATCH_FRAG_SRC, 'vec4 sampleSlot(', tree(0, 3, 'texture(%s, uv)') + '\n  return vec4(0.0);') },
  'batch slots=1': { vert: BATCH_VERT_SRC, frag: body(BATCH_FRAG_SRC, 'vec4 sampleSlot(', '  return texture(u_samplers[0], uv);') },
  'batch no-glyph': { vert: BATCH_VERT_SRC, frag: BATCH_FRAG_SRC.replace(/float coverage = glyphCoverage\([^;]*\);/, 'float coverage = 1.0;') },
  'batch no-ids': { vert: BATCH_VERT_SRC, frag: BATCH_FRAG_SRC },
  'area': { vert: BATCH_AREA_VERT_SRC, frag: area },
  'area taps=1': { vert: BATCH_AREA_VERT_SRC, frag: body(area, 'vec4 glyphTap(', '  return textureLod(u_samplers[1], uv, 0.0);') },
  'area slots=1 taps=1': { vert: BATCH_AREA_VERT_SRC, frag: body(body(area, 'vec4 glyphTap(', '  return textureLod(u_samplers[1], uv, 0.0);'), 'vec4 sampleSlot(', '  return texture(u_samplers[0], uv);') },
};
const SIMPLE_VERT = `#version 300 es
layout(location = 0) in vec2 a_position;
uniform mat3 u_proj;
out vec4 v_vertexColor;
out vec2 v_uv;
out float v_post;
flat out int v_texSlot;
flat out float v_paintMode;
flat out int v_matrix;
void main() {
  gl_Position = vec4((u_proj * vec3(a_position, 1.0)).xy, 0.0, 1.0);
  v_vertexColor = vec4(1.0); v_uv = a_position; v_post = 1.0; v_texSlot = 0; v_paintMode = 0.0; v_matrix = 0;
}
`;
const SIMPLE_FRAG = (decl: number) => `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_samplers[${decl}];
uniform vec4 u_color;
out vec4 outColor;
void main() { outColor = texture(u_samplers[0], v_uv) * u_color; }
`;
v['simple vert + batch frag'] = { vert: SIMPLE_VERT, frag: BATCH_FRAG_SRC };
v['batch vert + simple frag'] = { vert: BATCH_VERT_SRC, frag: SIMPLE_FRAG(1).replace('in vec2 v_uv;', 'in vec2 v_uv;') };
v['simple, 1 sampler'] = { vert: SIMPLE_VERT, frag: SIMPLE_FRAG(1) };
v['simple, 16 samplers'] = { vert: SIMPLE_VERT, frag: SIMPLE_FRAG(16) };
v['batch, 4 samplers'] = { vert: BATCH_VERT_SRC, frag: body(BATCH_FRAG_SRC, 'vec4 sampleSlot(', tree(0, 3, 'texture(%s, uv)') + '\n  return vec4(0.0);').replace('uniform sampler2D u_samplers[16];', 'uniform sampler2D u_samplers[4];').replace('u_samplers[15]', 'u_samplers[3]') };
const out: Record<string, { vert: string; frag: string }> = {};
for (const [k, s] of Object.entries(v)) out[k] = k.endsWith('no-ids') ? s : (withIdOutput(s.vert, s.frag) ?? s);
writeFileSync(process.argv[2], JSON.stringify(out));
console.log(Object.entries(out).map(([k, s]) => `${k}: frag ${s.frag.length}`).join('\n'));
