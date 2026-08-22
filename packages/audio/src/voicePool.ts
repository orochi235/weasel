export type StealPolicy = 'oldest' | 'quietest';

export interface VoicePoolOptions {
  /** Maximum concurrent voices. Beyond this, `acquire` steals. */
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
  /** Slot whose voice was evicted to make room, or null. The caller is
   *  responsible for actually stopping that voice's nodes. */
  stolen: number | null;
}

export interface VoicePool {
  acquire(record: VoiceRecord): Acquisition;
  release(slot: number): void;
  setGain(slot: number, gain: number): void;
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
  const steal = opts.steal ?? 'oldest';
  const live = new Map<number, VoiceRecord>();
  const free: number[] = [];
  let nextSlot = 0;

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
      if (live.size < opts.limit) {
        const slot = free.length > 0 ? free.pop()! : nextSlot++;
        live.set(slot, { ...record });
        return { slot, stolen: null };
      }
      const slot = victim();
      live.set(slot, { ...record });
      return { slot, stolen: slot };
    },
    release(slot) {
      if (!live.delete(slot)) return;
      free.push(slot);
    },
    setGain(slot, gain) {
      const rec = live.get(slot);
      if (rec) rec.gain = gain;
    },
    active: () => live.size,
  };
}
