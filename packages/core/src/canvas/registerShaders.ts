import type { ShaderProgramHandle, WeaselRenderer } from '@weasel-js/renderer';

/** Compile `shaders` on `renderer`, warning past one that fails: the rest of the scene still paints. */
export function registerShaders(renderer: WeaselRenderer, shaders: readonly ShaderProgramHandle[] | undefined): void {
  if (!shaders) return;
  for (const handle of shaders) {
    try {
      renderer.registerProgram(handle);
    } catch (e) {
      console.warn(`weasel: failed to register shader "${handle.id}":`, e);
    }
  }
}
