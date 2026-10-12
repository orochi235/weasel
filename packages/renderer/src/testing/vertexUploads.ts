/**
 * Read vertex geometry back out of a `GLRecorder`, with each upload's
 * floats-per-vertex taken from the `vertexAttribPointer` recorded for that same
 * buffer object.
 *
 * A ring slot configures its attributes once, so a frame after the first
 * records no pointer calls at all — hence a tracker that remembers what it has
 * learned. Ask it for `uploads()` after each frame and it carries the strides
 * across `recorder.reset()`.
 */

import type { GLCall, GLRecorder } from './glRecorder';

const ARRAY_BUFFER = 0x8892;

/** One vertex buffer upload. */
export interface VertexUpload {
  /** Floats per vertex. */
  stride: number;
  data: Float32Array;
}

/** Reads vertex uploads out of a recorder, remembering each buffer's stride. */
export interface UploadTracker {
  /** Every vertex upload recorded since the last `recorder.reset()`. */
  uploads(): VertexUpload[];
}

/**
 * The floats an upload actually sent. `bufferSubData(target, offset, src,
 * srcOffset, length)` hands GL a *window* into a scratch array the batch
 * reuses across frames, so reading the recorded argument whole compares live
 * vertices against stale ones.
 */
function payload(call: GLCall): Float32Array | null {
  const data = call.name === 'bufferData' ? call.args[1] : call.args[2];
  if (!(data instanceof Float32Array)) return null;
  if (call.name !== 'bufferSubData') return data;
  const srcOffset = typeof call.args[3] === 'number' ? call.args[3] : 0;
  const length = typeof call.args[4] === 'number' ? call.args[4] : data.length - srcOffset;
  return data.subarray(srcOffset, srcOffset + length);
}

/** A tracker over `recorder`; keep one across frames. */
export function makeUploadTracker(recorder: GLRecorder): UploadTracker {
  // Keyed on the recorder's synthetic buffer handle, which is a stable object.
  const strides = new Map<unknown, number>();

  return {
    uploads(): VertexUpload[] {
      const out: VertexUpload[] = [];
      const pending: { buffer: unknown; data: Float32Array }[] = [];
      let bound: unknown = null;

      // Two passes: a buffer's attribute layout can be recorded either before
      // its first upload (the ring) or after it (every other draw path).
      for (const call of recorder.calls) {
        if (call.name === 'bindBuffer') {
          if (call.args[0] === ARRAY_BUFFER) bound = call.args[1];
          continue;
        }
        if (call.name === 'vertexAttribPointer') {
          // Byte stride; 0 means tightly packed, which for a_position is a vec2.
          const bytes = call.args[4] as number;
          strides.set(bound, bytes === 0 ? 2 : bytes / 4);
          continue;
        }
        if (call.name !== 'bufferData' && call.name !== 'bufferSubData') continue;
        const data = payload(call);
        if (data) pending.push({ buffer: bound, data });
      }

      for (const { buffer, data } of pending) {
        const stride = strides.get(buffer);
        if (stride === undefined) {
          throw new Error(
            'vertexUploads: a vertex buffer was written with no vertexAttribPointer ' +
            'ever recorded for it — call uploads() on the frame that creates the ' +
            'buffer, before resetting the recorder.',
          );
        }
        out.push({ stride, data });
      }
      return out;
    },
  };
}
