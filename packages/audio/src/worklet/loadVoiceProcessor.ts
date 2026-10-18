import { voiceProcessorSource } from './voiceProcessor.gen';

const loads = new WeakMap<BaseAudioContext, Promise<void>>();

/** Add the voice processor to a context's worklet scope, once per context.
 *  Rejects where there is no `audioWorklet` (an insecure page), or where the
 *  page's CSP refuses a `blob:` script. */
export function loadVoiceProcessor(ctx: BaseAudioContext): Promise<void> {
  let load = loads.get(ctx);
  if (!load) {
    load = (async () => {
      if (!ctx.audioWorklet) throw new Error('@weasel-js/audio: this context has no audioWorklet');
      const url = URL.createObjectURL(new Blob([voiceProcessorSource], { type: 'text/javascript' }));
      try {
        await ctx.audioWorklet.addModule(url);
      } finally {
        URL.revokeObjectURL(url);
      }
    })();
    loads.set(ctx, load);
  }
  return load;
}
