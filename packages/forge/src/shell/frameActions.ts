import type { ConfigActionContext } from '@weasel-js/labkit/config';

/** Where the action buttons of one story's rebuilt schema send their presses: the frame of the trial pressing one. */
export interface FrameActions {
  run(path: string, ctx: ConfigActionContext): void;
  /** Sends the presses made with the trial writer `setConfig` to `send` until the returned release runs. */
  attach(setConfig: ConfigActionContext['setConfig'], send: (path: string) => void): () => void;
}

/** A press is matched to its trial by the writer the panel hands the action, which is the trial's own `setConfig`. */
export function createFrameActions(): FrameActions {
  const frames = new Map<ConfigActionContext['setConfig'], (path: string) => void>();
  return {
    run(path, ctx) {
      frames.get(ctx.setConfig)?.(path);
    },
    attach(setConfig, send) {
      frames.set(setConfig, send);
      return () => {
        if (frames.get(setConfig) === send) frames.delete(setConfig);
      };
    },
  };
}
