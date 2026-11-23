import { WebGLDevice } from './gpu/webgl/WebGLDevice';
import { FIRST_FRAME_SPECS, buildProgram } from './shaders/builtinPrograms';
import type { ShaderProgram } from './shaders/ShaderProgram';

/** How often the warm context asks whether its programs are done, to let it go. */
const POLL_MS = 50;
let started = false;

/**
 * Start compiling, on a WebGL2 context of its own, the programs a renderer's first frame of shapes and text
 * draws with (`FIRST_FRAME_SPECS`), so a renderer made soon after finds them compiled or compiling: the
 * browser hands a second context the compile already under way. Call it at startup, before the data a canvas
 * waits on has arrived; later calls do nothing. It also does nothing without WebGL2 or
 * `KHR_parallel_shader_compile`, where compiling would hold the main thread. The context is let go once
 * every program has finished.
 */
export function warmPrograms(): void {
  if (started || typeof document === 'undefined') return;
  started = true;
  try {
    start();
  } catch {
    // A warm-up that cannot run leaves the renderer to compile as it would have.
  }
}

function start(): void {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return;
  const release = () => gl.getExtension('WEBGL_lose_context')?.loseContext();
  let programs: ShaderProgram[];
  try {
    const device = new WebGLDevice(gl);
    if (!device.compilesInBackground) {
      release();
      return;
    }
    programs = FIRST_FRAME_SPECS.map((spec) => buildProgram(device, spec));
  } catch (err) {
    release();
    throw err;
  }
  const poll = (): void => {
    let done = true;
    try {
      done = programs.every((program) => program.ready());
    } catch {
      // A source that fails here fails again in the renderer that draws with it, which reports it.
    }
    if (done) release();
    else setTimeout(poll, POLL_MS);
  };
  setTimeout(poll, POLL_MS);
}

/** Let `warmPrograms` run again, for a test. */
export function _resetWarmProgramsForTests(): void {
  started = false;
}
