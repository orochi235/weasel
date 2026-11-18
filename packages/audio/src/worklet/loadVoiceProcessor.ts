import { createPart } from '@weasel-js/registry';

/** Add the voice processor to a context's worklet scope, once per context.
 *  Rejects where there is no `audioWorklet` (an insecure page), or where the
 *  page's CSP refuses a `blob:` script. */
export const loadVoiceProcessor: (ctx: BaseAudioContext) => Promise<void> = createPart(async (ctx: BaseAudioContext) => {
  if (!ctx.audioWorklet) throw new Error('@weasel-js/audio: this context has no audioWorklet');
  // Imported here, so an engine that never asks for worklet voices does not carry the source.
  const { voiceProcessorSource } = await import('./voiceProcessor.gen');
  const url = URL.createObjectURL(new Blob([voiceProcessorSource], { type: 'text/javascript' }));
  try {
    await ctx.audioWorklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }
});
