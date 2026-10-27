import type { ClockedMix } from './types';

/** Keeps `mix` at the clock's time: its host clock only goes forward, by what
 *  the clock moved forward, and it seeks back when the clock does. */
export function followMix(mix: ClockedMix | null): (elapsed: number) => void {
  let host = 0;
  mix?.sync(host);
  return (elapsed) => {
    if (!mix) return;
    const ahead = elapsed - mix.now;
    if (ahead > 0) {
      host += ahead;
      mix.sync(host);
    } else if (ahead < 0) mix.seek(elapsed);
  };
}
