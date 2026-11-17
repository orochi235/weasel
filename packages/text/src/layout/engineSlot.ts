import { bumpTextEngineGeneration } from './engineGeneration';

/** Options for `registerShaper` and `registerBidi`. */
export interface RegisterEngineOptions {
  /** Take the place of a different engine already registered, which otherwise throws. */
  replace?: boolean;
}

/** One registered layout engine, shared by every layout. Each registration of the engine
 *  holds it, and it leaves once every holder has released; `null` or a replacement clears it. */
export function engineSlot<E extends object>(fn: string, what: string) {
  let registered: E | null = null;
  let holders = new Set<object>();
  return {
    get: (): E | null => registered,
    register(engine: E | null, opts: RegisterEngineOptions = {}): () => void {
      if (engine !== null && registered !== null && registered !== engine && !opts.replace) {
        throw new Error(
          `weasel ${fn}: a different ${what} is already registered. Call the function its ` +
          `registration returned first, or pass { replace: true } to take its place.`,
        );
      }
      if (registered !== engine) {
        bumpTextEngineGeneration();
        holders = new Set();
      }
      registered = engine;
      if (engine === null) return () => {};
      const holder = {};
      const held = holders;
      held.add(holder);
      return () => {
        if (!held.delete(holder) || held.size > 0 || holders !== held) return;
        registered = null;
        bumpTextEngineGeneration();
      };
    },
  };
}
