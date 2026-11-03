/**
 * The id output every program writes beside its color, for an id frame
 * (`WeaselRenderer.renderIds`).
 *
 * Each program's sources are rewritten at compile time rather than each
 * shader declaring the output itself, so a consumer's custom shader and
 * effect write ids with no change to their source. The user's `main` is
 * renamed and called from a `main` that then writes the id: a `discard`
 * still discards both outputs, and an early `return` still reaches the write.
 *
 * The id rides a generic vertex attribute at a fixed location rather than a
 * uniform: a generic attribute's value is context state, so one call sets it
 * for every program a run of draws uses. Its `rgb` is the id's three bytes,
 * its `a` the least alpha a fragment claims its pixel with. A fragment that
 * claims writes `(rgb, 1)` to color attachment 1, one that does not writes
 * zero. Under the renderer's premultiplied blend that is a replace or a no-op,
 * so the one blend state WebGL2 gives every attachment serves both.
 *
 * Outside an id frame nothing is attached at location 1 and GL drops the write.
 */

/** Where every program links the id attribute. 15 is the last of the 16
 *  attributes WebGL2 guarantees, so no program's own are displaced. */
export const ID_ATTRIBUTE_LOCATION = 15;

/** The highest id an id frame can carry: three bytes of one RGBA8 texel. */
export const MAX_PICK_ID = 0xffffff;

const ID_ATTRIBUTE = 'a_weaselId';

const MAIN = /\bvoid\s+main\s*\(\s*(?:void\s*)?\)/g;
/** A color output at global scope: `out vec4 name;`, with or without
 *  `layout(location = 0)` and a precision. */
const COLOR_OUT = /^([ \t]*)(layout\s*\(\s*location\s*=\s*0\s*\)\s*)?out\s+((?:lowp|mediump|highp)\s+)?vec4\s+([A-Za-z_]\w*)\s*;/gm;
/** Any output at global scope, the color one included. */
const ANY_OUT = /^[ \t]*(?:layout\s*\([^)]*\)\s*)?(?:flat\s+|smooth\s+)?out\s+/gm;

function count(re: RegExp, src: string): number {
  return src.match(re)?.length ?? 0;
}

/**
 * `vert` and `frag` with the id output added, or `null` where `frag` is not
 * the shape the rewrite understands: one `main`, one `vec4` output at
 * location 0 or none named, and no other output. A program built from `null`
 * writes no ids, and an id frame draws it with attachment 1 switched off.
 */
export function withIdOutput(vert: string, frag: string): { vert: string; frag: string } | null {
  if (count(MAIN, vert) !== 1 || count(MAIN, frag) !== 1) return null;
  if (count(COLOR_OUT, frag) !== 1 || count(ANY_OUT, frag) !== 1) return null;
  if (vert.includes(ID_ATTRIBUTE) || frag.includes('weasel_idOut')) return null;
  let color = '';
  const placed = frag.replace(COLOR_OUT, (_m, indent: string, _layout, precision: string | undefined, name: string) => {
    color = name;
    return `${indent}layout(location = 0) out ${precision ?? ''}vec4 ${name};`;
  });
  return {
    vert: `${vert.replace(MAIN, 'void weasel_main()')}
in vec4 ${ID_ATTRIBUTE};
flat out highp vec4 v_weaselId;
void main() {
  weasel_main();
  v_weaselId = ${ID_ATTRIBUTE};
}
`,
    frag: `${placed.replace(MAIN, 'void weasel_main()')}
flat in highp vec4 v_weaselId;
layout(location = 1) out highp vec4 weasel_idOut;
void main() {
  weasel_main();
  weasel_idOut = ${color}.a > 0.0 && ${color}.a >= v_weaselId.a ? vec4(v_weaselId.rgb, 1.0) : vec4(0.0);
}
`,
  };
}

/** Link the id attribute where `withIdOutput` expects it. */
export function bindIdAttribute(gl: WebGL2RenderingContext, program: WebGLProgram): void {
  gl.bindAttribLocation(program, ID_ATTRIBUTE_LOCATION, ID_ATTRIBUTE);
}

/** Throws unless `id` is one an id frame can carry. */
export function checkPickId(id: number): void {
  if (!Number.isInteger(id) || id < 0 || id > MAX_PICK_ID) {
    throw new RangeError(`weasel: pickId must be an integer from 0 to ${MAX_PICK_ID}, got ${id}`);
  }
}

/** `id`'s three bytes as the 0–1 channels the attribute carries. */
export function idChannels(id: number): [number, number, number] {
  return [(id & 0xff) / 255, ((id >> 8) & 0xff) / 255, ((id >> 16) & 0xff) / 255];
}

/** The id one RGBA8 texel of an id attachment holds; 0 where nothing claimed it. */
export function idOfTexel(bytes: Uint8Array, i: number): number {
  return bytes[i + 3] >= 128 ? bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) : 0;
}
