import { bumpTextEngineGeneration } from './engineGeneration';

/** Options for `registerShaper` and `registerBidi`. */
export interface RegisterEngineOptions {
  /** Take the place of a different engine already registered, which otherwise throws. */
  replace?: boolean;
}

/** One registered layout engine, shared by every layout. */
export function engineSlot<E extends object>(fn: string, what: string) {
  let registered: E | null = null;
  return {
    get: (): E | null => registered,
    register(engine: E | null, opts: RegisterEngineOptions = {}): () => void {
      if (engine !== null && registered !== null && registered !== engine && !opts.replace) {
        throw new Error(
          `weasel ${fn}: a different ${what} is already registered. Call the function its ` +
          `registration returned first, or pass { replace: true } to take its place.`,
        );
      }
      if (registered !== engine) bumpTextEngineGeneration();
      registered = engine;
      return () => {
        if (registered !== engine) return;
        registered = null;
        bumpTextEngineGeneration();
      };
    },
  };
}
