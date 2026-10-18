import type { Scheduler } from './scheduler';
import { spatialize, type SpatialOptions, type Vec2 } from './spatialize';
import type { VoiceDropReason, VoiceHandle } from './types';
import type { ChainPool } from './voiceChains';
import { reportDrop, type DropWarnings } from './voiceDrops';
import type { LiveVoice, Slots, SourceLike, Starter, VoiceOptions } from './liveVoice';

/** Every voice the engine has booked or is playing, whatever makes its node. */
export interface Voices {
  /**
   * Everything a voice does apart from making its node: the lock and dispose
   * checks, the output, the booking, the stale-backlog check, the slot and any
   * steal, and the handle.
   */
  launch(common: VoiceOptions, starter: Starter): VoiceHandle;
  stopAll(reason: VoiceDropReason): void;
  /** Stop every voice booked under `key`. */
  stopKey(key: string): void;
  /** Re-spatialize every voice with a position, after the listener moved. */
  respatialize(): void;
}

export interface VoicesDeps {
  ctx: BaseAudioContext;
  scheduler: Pick<Scheduler, 'schedule'>;
  chains: ChainPool;
  busInput(bus: string): AudioNode;
  slotsFor(bus: string): Slots;
  defaultBus: string;
  warn: DropWarnings;
  staleFloor(): number;
  disposed(): boolean;
  listener(): { at: Vec2; opts: SpatialOptions };
}

interface VoiceOps {
  teardown(voice: LiveVoice, reason?: VoiceDropReason): void;
  applySpatial(voice: LiveVoice): void;
  poolGain(voice: LiveVoice): void;
}

const dropped = (id: number): VoiceHandle => ({
  id,
  stop: () => {}, release: () => {}, setGain: () => {}, setRate: () => {}, setDetune: () => {},
  setPan: () => {}, setPosition: () => {}, isPlaying: () => false,
});

function teardownVoice(voice: LiveVoice, reason: VoiceDropReason, live: Map<number, LiveVoice>): void {
  // First, and never at a call site: teardown is what makes a voice dead, and
  // a queued callback that outlives it must find it canceled. The steal path
  // has no other place to set this.
  voice.canceled = true;
  if (!voice.playing && voice.source === null) return;
  voice.playing = false;
  if (voice.source === null) {
    voice.unbook?.();
    reportDrop(voice.onDrop, reason);
  }
  voice.unbook = null;
  if (voice.source) {
    try { voice.source.stop(); } catch { /* already stopped */ }
    voice.source.disconnect();
  }
  voice.source = null;
  voice.retune = null;
  voice.release = null;
  voice.env?.disconnect();
  voice.env = null;
  voice.out?.free();
  voice.out = null;
  live.delete(voice.id);
  if (voice.slot !== null) {
    voice.slots.byToken.delete(voice.token);
    // Safe on the steal path too: the pool has already reissued this slot
    // under a new token, and it ignores a release carrying the old one.
    voice.slots.pool.release(voice.slot, voice.token);
  }
}

/** The scheduler's half of a voice: it came due at `scheduledWhen`. */
function startVoice(
  voice: LiveVoice,
  starter: Starter,
  bookedAt: number,
  scheduledWhen: number,
  onDone: (() => void) | undefined,
  staleFloor: number,
  teardown: VoiceOps['teardown'],
): void {
  // A source already: `catchUp` started it ahead of this pass.
  if (voice.canceled || voice.source !== null) return;
  // Came due while the context was suspended: starting it now would play
  // a backlog at once, which is what dropping a locked play avoids. A voice
  // played since the resume is no backlog, however early its `when`. Nor is a
  // booked voice: the audio thread holds it, and its clock stopped too.
  const booked = voice.unbook !== null;
  if (!booked && bookedAt < staleFloor && scheduledWhen < staleFloor) {
    teardown(voice, 'stale');
    return;
  }
  if (!starter.ready()) {
    teardown(voice, 'unready');
    return;
  }

  // The slot is taken here, not at booking time. A voice booked a bar out
  // would otherwise hold one while silent — and, its `startedAt` being in
  // the future, be the last thing the 'oldest' policy evicts, so booking
  // a bar of events would evict everything currently audible.
  const { slots } = voice;
  const acquired = slots.pool.acquire({
    startedAt: scheduledWhen,
    gain: voice.baseGain * voice.spatialGain,
  });
  voice.slot = acquired.slot;
  voice.token = acquired.token;
  slots.byToken.set(acquired.token, voice);
  if (acquired.stolen !== null) {
    const victim = slots.byToken.get(acquired.stolen);
    if (victim) teardown(victim);
  }

  let source: SourceLike;
  try {
    source = starter.start(voice, scheduledWhen);
  } catch (err) {
    // Not back to the idle chains: whatever the starter built before it threw is still wired into this one.
    voice.out?.abandon();
    voice.out = null;
    teardown(voice, 'failed');
    throw err;
  }
  voice.unbook = null;
  voice.catchUp = null;
  source.onended = () => { teardown(voice); onDone?.(); };
  voice.source = source;
}

function voiceHandle(ctx: BaseAudioContext, voice: LiveVoice, ops: VoiceOps): VoiceHandle {
  const { teardown, applySpatial, poolGain } = ops;
  return {
    id: voice.id,
    stop(fadeMs) {
      voice.catchUp?.();
      if (fadeMs && fadeMs > 0 && voice.source && voice.out && !voice.canceled) {
        // Canceled but not torn down: the fade is what ends this voice, and
        // stopping the source now would cut the ramp scheduled a line above
        // it — which is the click `fadeMs` exists to avoid. `onended` does
        // the bookkeeping when the fade reaches the end.
        voice.canceled = true;
        voice.fading = true;
        voice.out.level(0, fadeMs);
        try { voice.source.stop(ctx.currentTime + fadeMs / 1000); } catch { /* ended */ }
        return;
      }
      teardown(voice);
    },
    release() {
      if (voice.releasing) return;
      voice.catchUp?.();
      if (voice.release && voice.source && !voice.canceled) {
        // Like a fade: `onended` tears the voice down once the release is out.
        voice.releasing = true;
        voice.canceled = true;
        voice.release();
        return;
      }
      teardown(voice);
    },
    setGain(value, rampMs) {
      voice.baseGain = value;
      if (!voice.out || voice.fading) return;
      voice.rampEnd = rampMs && rampMs > 0 ? ctx.currentTime + rampMs / 1000 : 0;
      voice.out.level(value * voice.spatialGain, rampMs);
      poolGain(voice);
    },
    setRate(value) {
      voice.rate = value;
      voice.retune?.();
    },
    setDetune(cents) {
      voice.detune = cents;
      voice.retune?.();
    },
    setPan(value) {
      voice.position = undefined;
      voice.out?.pan(value);
    },
    setPosition(p) {
      voice.position = p;
      applySpatial(voice);
    },
    isPlaying: () => voice.playing,
  };
}

export function createVoices(deps: VoicesDeps): Voices {
  const { ctx, chains, warn } = deps;
  const live = new Map<number, LiveVoice>();
  let nextVoiceId = 1;

  const spatialOf = (p: Vec2) => {
    const l = deps.listener();
    return spatialize(p, l.at, l.opts);
  };

  const poolGain = (voice: LiveVoice): void => {
    if (voice.slot === null) return;
    voice.slots.pool.setGain(voice.slot, voice.token, voice.baseGain * voice.spatialGain);
  };

  const applySpatial = (voice: LiveVoice): void => {
    if (!voice.position || !voice.out) return;
    const s = spatialOf(voice.position);
    voice.spatialGain = s.gain;
    voice.out.pan(s.pan);
    if (!voice.fading) {
      // A level write cancels what is scheduled, so a ramp still running is rescheduled to the same end.
      const left = (voice.rampEnd - ctx.currentTime) * 1000;
      voice.out.level(voice.baseGain * s.gain, left > 0 ? left : undefined);
    }
    poolGain(voice);
  };

  const teardown = (voice: LiveVoice, reason: VoiceDropReason = 'stopped'): void => {
    teardownVoice(voice, reason, live);
  };
  const ops: VoiceOps = { teardown, applySpatial, poolGain };

  return {
    launch(common, starter) {
      const id = nextVoiceId++;

      if (deps.disposed()) {
        warn.disposed();
        reportDrop(common.onDrop, 'disposed');
        return dropped(id);
      }
      if (ctx.state !== 'running') {
        warn.locked();
        reportDrop(common.onDrop, 'locked');
        return dropped(id);
      }

      const busName = common.bus ?? deps.defaultBus;
      const slots = deps.slotsFor(busName);
      const bookedAt = ctx.currentTime * 1000;
      const when = common.when ?? bookedAt;
      const baseGain = common.gain ?? 1;
      const spatial = common.position ? spatialOf(common.position) : { gain: 1, pan: common.pan ?? 0 };
      const level = baseGain * spatial.gain;

      const voice: LiveVoice = {
        id, slots, slot: null, token: 0, key: common.cancelKey, onDrop: common.onDrop,
        source: null, env: null, retune: null, release: null, releasing: false,
        out: null, unbook: null, catchUp: null,
        baseGain, spatialGain: spatial.gain,
        rate: common.rate ?? 1, detune: common.detune ?? 0,
        position: common.position,
        playing: true, canceled: false, fading: false, rampEnd: 0,
      };
      if (starter.book) {
        const booking = starter.book(voice, { bus: busName, when, level, pan: spatial.pan });
        voice.out = booking.out;
        voice.unbook = booking.cancel;
      } else {
        voice.out = chains.take(deps.busInput(busName), level, spatial.pan);
      }
      live.set(id, voice);
      const begin = (): void => {
        startVoice(voice, starter, bookedAt, when, common.onDone, deps.staleFloor(), teardown);
      };
      if (starter.book) {
        voice.catchUp = () => { if (ctx.currentTime * 1000 >= when) begin(); };
      }
      // A booked voice already sounds at its time, however late this runs.
      deps.scheduler.schedule(when, begin, common.cancelKey, { reportLate: !starter.book });
      return voiceHandle(ctx, voice, ops);
    },
    stopAll(reason) {
      for (const voice of [...live.values()]) teardown(voice, reason);
    },
    stopKey(key) {
      for (const voice of [...live.values()]) {
        if (voice.key !== key) continue;
        voice.catchUp?.();
        teardown(voice);
      }
    },
    respatialize() {
      for (const voice of live.values()) applySpatial(voice);
    },
  };
}
