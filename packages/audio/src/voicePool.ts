export type StealPolicy = 'oldest' | 'quietest';

export interface VoicePoolOptions {
  /** Maximum concurrent voices, at least 1. Beyond this, `acquire` steals. */
  limit: number;
  /** Default 'oldest'. */
  steal?: StealPolicy;
}

export interface VoiceRecord {
  /** Engine time the voice started, in ms. */
  startedAt: number;
  /** Current gain, consulted by the 'quietest' steal policy. */
  gain: number;
}

export interface Acquisition {
  slot: number;
  /** Identifies this voice, not its slot: a stolen slot is reissued at once,
   *  so `release` and `setGain` take the token and ignore a stale one. */
  token: number;
  /** Token of the voice evicted to make room, or null. The caller is
   *  responsible for actually stopping that voice's nodes. */
  stolen: number | null;
}

export interface VoicePool {
  acquire(record: VoiceRecord): Acquisition;
  release(slot: number, token: number): void;
  setGain(slot: number, token: number, gain: number): void;
  active(): number;
}

/**
 * Slot bookkeeping for concurrent voices, with a steal policy for when the
 * limit is reached.
 *
 * This is pure accounting — it owns no audio nodes. The caller pools the
 * `GainNode`/`StereoPannerNode` chain per slot and mints a fresh
 * `AudioBufferSourceNode` per play, because a source node is single-use by
 * specification and cannot be restarted once stopped.
 */
export function createVoicePool(opts: VoicePoolOptions): VoicePool {
  if (!(opts.limit >= 1)) {
    throw new RangeError(`@weasel-js/audio: voice pool limit must be at least 1, got ${opts.limit}`);
  }
  const steal = opts.steal ?? 'oldest';
  const live = new Map<number, VoiceRecord & { token: number }>();
  const free: number[] = [];
  let nextSlot = 0;
  let nextToken = 1;

  const victim = (): number => {
    let worst = -1;
    let worstScore = Infinity;
    for (const [slot, rec] of live) {
      const score = steal === 'quietest' ? rec.gain : rec.startedAt;
      if (score < worstScore) { worstScore = score; worst = slot; }
    }
    return worst;
  };

  return {
    acquire(record) {
      const token = nextToken++;
      if (live.size < opts.limit) {
        const slot = free.length > 0 ? free.pop()! : nextSlot++;
        live.set(slot, { ...record, token });
        return { slot, token, stolen: null };
      }
      const slot = victim();
      const stolen = live.get(slot)!.token;
      // Re-inserting moves the slot to the back of the iteration order, so
      // voices tied on score take turns being the victim.
      live.delete(slot);
      live.set(slot, { ...record, token });
      return { slot, token, stolen };
    },
    release(slot, token) {
      if (live.get(slot)?.token !== token) return;
      live.delete(slot);
      free.push(slot);
    },
    setGain(slot, token, gain) {
      const rec = live.get(slot);
      if (rec?.token === token) rec.gain = gain;
    },
    active: () => live.size,
  };
}
