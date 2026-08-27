/**
 * Proxy-based recording WebGL2 context for unit tests.
 *
 * Records every method call as { name, args, result } so tests can assert
 * against the call sequence. Returns synthetic handles for object creation
 * (createShader/Program/Buffer/etc.); reports truthy for *Parameter status
 * queries (i.e. assumes shader/program compilation succeeded).
 *
 * NOT a renderer correctness check — pixel-level correctness is verified
 * end-to-end by the smoke test in dev/smoke.spec.ts. This recorder catches
 * "did the dispatcher emit the right call sequence" bugs only.
 */

export interface GLCall {
  readonly name: string;
  readonly args: readonly unknown[];
  readonly result: unknown;
}

export interface GLRecorder {
  readonly gl: WebGL2RenderingContext;
  readonly calls: GLCall[];
  reset(): void;
}

const GL_CONSTANTS: Readonly<Record<string, number>> = {
  // Shader / program
  VERTEX_SHADER: 0x8B31,
  FRAGMENT_SHADER: 0x8B30,
  COMPILE_STATUS: 0x8B81,
  LINK_STATUS: 0x8B82,
  // Buffer targets
  ARRAY_BUFFER: 0x8892,
  ELEMENT_ARRAY_BUFFER: 0x8893,
  STATIC_DRAW: 0x88E4,
  // Types
  FLOAT: 0x1406,
  UNSIGNED_INT: 0x1405,
  // Primitives
  TRIANGLES: 0x0004,
  // Errors / state
  NO_ERROR: 0,
  DEPTH_TEST: 0x0B71,
  BLEND: 0x0BE2,
  STENCIL_TEST: 0x0B90,
  CULL_FACE: 0x0B44,
  // Blend factors
  SRC_ALPHA: 0x0302,
  ONE_MINUS_SRC_ALPHA: 0x0303,
  ZERO: 0,
  ONE: 1,
  // Buffer bits
  COLOR_BUFFER_BIT: 0x00004000,
  STENCIL_BUFFER_BIT: 0x00000400,
  DEPTH_BUFFER_BIT: 0x00000100,
  // Stencil ops
  KEEP: 0x1E00,
  REPLACE: 0x1E01,
  INVERT: 0x150A,
  // Compare funcs
  ALWAYS: 0x0207,
  NEVER: 0x0200,
  EQUAL: 0x0202,
  NOTEQUAL: 0x0205,
  // Color masks
  FRONT_AND_BACK: 0x0408,
  // Misc constants used in step 1
  COLOR_WRITEMASK: 0x0C23,
  // Textures (step 3)
  TEXTURE_2D: 0x0DE1,
  TEXTURE0: 0x84C0,
  RGBA: 0x1908,
  UNSIGNED_BYTE: 0x1401,
  TEXTURE_MIN_FILTER: 0x2801,
  TEXTURE_MAG_FILTER: 0x2800,
  LINEAR: 0x2601,
  NEAREST: 0x2600,
  TEXTURE_WRAP_S: 0x2802,
  TEXTURE_WRAP_T: 0x2803,
  CLAMP_TO_EDGE: 0x812F,
  // Wrap modes (step 4)
  REPEAT: 0x2901,
  MIRRORED_REPEAT: 0x8370,
  // Mipmap minification filter
  LINEAR_MIPMAP_LINEAR: 0x2703,
};

function syntheticHandle(name: string, seq: number): { __id: string } {
  return { __id: `${name}_${seq}` };
}

/**
 * Copy typed-array arguments as they are recorded.
 *
 * A caller is entitled to reuse the array it uploads from — the text ring
 * packs every draw through one scratch buffer — so storing the reference
 * records a value that later frames overwrite. A test reading it back then
 * compares two frames and sees the same numbers twice, which passes.
 */
function snapshot(value: unknown): unknown {
  return ArrayBuffer.isView(value) && !(value instanceof DataView)
    ? (value as unknown as { slice(): unknown }).slice()
    : value;
}

export function makeGLRecorder(): GLRecorder {
  const calls: GLCall[] = [];

  const handler = (name: string) => (...args: unknown[]) => {
    let result: unknown = undefined;
    switch (name) {
      case 'createShader':
      case 'createProgram':
      case 'createBuffer':
      case 'createVertexArray':
      case 'createTexture':
      case 'createFramebuffer':
      case 'createRenderbuffer':
        result = syntheticHandle(name, calls.length);
        break;
      case 'getUniformLocation':
      case 'getAttribLocation':
        result = calls.length;
        break;
      case 'getShaderParameter':
      case 'getProgramParameter':
        result = true;
        break;
      case 'getShaderInfoLog':
      case 'getProgramInfoLog':
        result = '';
        break;
      case 'getError':
        result = 0;
        break;
      default:
        result = undefined;
    }
    calls.push({ name, args: args.map(snapshot), result });
    return result;
  };

  const gl = new Proxy(
    {},
    {
      get(_, prop: string | symbol) {
        if (typeof prop !== 'string') return undefined;
        if (prop in GL_CONSTANTS) return GL_CONSTANTS[prop];
        if (/^[A-Z_0-9]+$/.test(prop)) return 0; // unknown all-caps constant → 0
        return handler(prop);
      },
    },
  ) as unknown as WebGL2RenderingContext;

  return {
    gl,
    calls,
    reset() {
      calls.length = 0;
    },
  };
}
