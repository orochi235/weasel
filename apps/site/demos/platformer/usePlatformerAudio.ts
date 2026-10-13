import { useCallback, useEffect, useRef, useState } from 'react';
import { useLatest } from '@weasel-js/core';
import { bindClip } from '@weasel-js/animator';
import type { Animator, EventBookingHandle, TimelineHandle } from '@weasel-js/animator';
import { createAudioEngine, createPatternPlayer } from '@weasel-js/audio';
import type { AudioEngine, PatternPlayer } from '@weasel-js/audio';
import { MOVE_SPEED } from './physics';
import { playSound, type SoundName } from './sfx';
import { BED_BUS, BED_STEPS, BED_TEMPO, bedDetune, bedEvents } from './bed';
import { CLIPS } from './clips';
import { FOOTSTEPS, STEP } from './footsteps';
import type { GameRefs, WorldHooks } from './world';

/** A footfall pair spanning a time-scale change is still accelerating, not
 *  steady — the gap would measure speed change, not scheduling jitter. */
const JITTER_SCALE_TOLERANCE = 0.02;

/** Voices per bus. The bed's busiest moment has to fit under it, or its hits
 *  steal each other's tails. */
export const VOICE_LIMIT = 48;
/** The music bus's level under the one-shots. */
export const MUSIC_GAIN = 0.325;

type Audio = { engine: AudioEngine; bed: PatternPlayer | null };

export interface PlatformerAudio {
  /** What the world calls for sound and impact. Read it through the ref from
   *  inside the frame loop; it is rebuilt every render so it is never stale. */
  hooks: { readonly current: WorldHooks };
  audioState: 'off' | 'suspended' | 'running';
  musicOn: boolean;
  /** Build and unlock the engine. Must run from a user gesture. */
  enableAudio: () => void;
  toggleMusic: () => void;
  /** Call at the top of every frame, simulating or not: moves the listener to
   *  the player and runs the flag impact's delayed music cut. */
  beginFrame: (g: GameRefs) => void;
  /** Call after the frame's simulation step. Paces the run cycle — and so the
   *  footsteps it books — from the player's ground speed, and pauses it
   *  whenever the world is not simulating. */
  endFrame: (g: GameRefs, simulating: boolean) => void;
  /** One stomp per point, staggered, so a crowd arriving is audible. */
  swarm: (points: readonly { x: number; y: number }[]) => void;
  /** Readouts, polled rather than rendered per frame. `hooks`, `beginFrame`,
   *  `endFrame`, `swarm` and `stats` keep their identity across renders, so a
   *  frame loop can list them as dependencies without resubscribing. */
  stats: () => { voices: number; steps: number; spread: number };
}

/**
 * The platformer's audio: the engine, the music bed, the run-cycle timeline
 * whose playhead books footsteps against the audio clock, and the
 * {@link WorldHooks} that turn world events into sound. Nothing here draws;
 * `onBonk` is how a head knock or the flag impact reaches the picture.
 */
export function usePlatformerAudio(animator: Animator, onBonk: () => void): PlatformerAudio {
  const audio = useRef<Audio | null>(null);
  const [audioState, setAudioState] = useState<'off' | 'suspended' | 'running'>('off');
  const [musicOn, setMusicOn] = useState(true);

  /** Frames left before the music stops; -1 once it has. */
  const cutMusicIn = useRef(-1);
  const runCycle = useRef<TimelineHandle | null>(null);
  // What the loop writes and the footstep handler reads back to know the
  // interval a given tick implies.
  const runScale = useRef(1);
  const stepStats = useRef({ count: 0, lastAt: 0, lastScale: 1, spread: 0 });

  // Built on the unlock gesture, not at mount: jsdom has no AudioContext, and a
  // context created before a gesture starts suspended anyway.
  const enableAudio = () => {
    if (typeof AudioContext === 'undefined') return;
    if (!audio.current) {
      const engine = createAudioEngine({ buses: ['sfx', BED_BUS], voiceLimit: VOICE_LIMIT });
      engine.bus(BED_BUS).setGain(MUSIC_GAIN);
      audio.current = { engine, bed: null };
    }
    const { engine } = audio.current;
    void engine.unlock().then(() => {
      setAudioState(engine.state() === 'running' ? 'running' : 'suspended');
      if (!audio.current!.bed) {
        engine.bus(BED_BUS).mute(!musicOn);
        const bed = createPatternPlayer(engine, {
          tempo: BED_TEMPO, events: bedEvents(), length: BED_STEPS, detune: bedDetune,
        });
        bed.start();
        audio.current!.bed = bed;
      }
    });
  };

  /** The bed is the only sound that runs on its own — everything else is a
   *  one-shot that stops when you do — so it gets a switch of its own. */
  const toggleMusic = () => {
    const next = !musicOn;
    audio.current?.engine.bus(BED_BUS).mute(!next);
    setMusicOn(next);
  };

  useEffect(() => () => {
    audio.current?.engine.dispose();
    audio.current = null;
  }, []);

  useEffect(() => {
    // Booked ahead of its frame, at the time on the engine's clock the foot lands. Returning the
    // voices lets a pause or a change of run speed retract a step that has not sounded yet.
    const step = (when: number): EventBookingHandle | void => {
      const a = audio.current;
      const s = stepStats.current;
      const scale = runScale.current;
      s.count++;
      if (!a || a.engine.state() !== 'running') {
        s.lastAt = 0;
        return;
      }
      // While the player is still accelerating, the scale at this footfall
      // differs from the one recorded at the last — skip those pairs so the
      // spread reflects steady-state scheduling, not a changing run speed.
      if (s.lastAt && Math.abs(scale - s.lastScale) <= JITTER_SCALE_TOLERANCE) {
        const expected = (CLIPS.run.duration / 2) / Math.max(scale, 0.01);
        s.spread = Math.max(s.spread, Math.abs(when - s.lastAt - expected));
      }
      const prev = { lastAt: s.lastAt, lastScale: s.lastScale };
      s.lastAt = when;
      s.lastScale = scale;
      const voices = playSound(a.engine, 'step', { bus: 'sfx', gain: 0.35, when });
      // A jump or a change of run speed retracts a step that has not
      // sounded; it is booked again wherever the cycle next reaches it.
      return {
        stop: () => {
          for (const v of voices) v.stop();
          s.count--;
          Object.assign(s, prev);
        },
      };
    };
    const handle = animator.timeline({
      ...bindClip(FOOTSTEPS, { event: (name) => (name === STEP ? { book: step } : undefined) }),
      loop: true,
      autoplay: true,
      // Steps book against the engine's clock once there is one. Before the
      // unlock gesture nothing sounds, and the timeline resyncs when it swaps.
      booking: { clock: { now: () => audio.current?.engine.now() ?? performance.now() } },
    });
    runCycle.current = handle;
    handle.pause();
    return () => {
      handle.cancel();
      runCycle.current = null;
    };
  }, [animator]);

  const fire = (name: SoundName, gain = 0.8) => {
    const a = audio.current;
    if (!a || a.engine.state() !== 'running') return;
    playSound(a.engine, name, { bus: 'sfx', gain });
  };

  /** For sounds with a place in the world — the engine spatializes against the
   *  listener set from the player each frame. */
  const fireAt = (name: SoundName, position: { x: number; y: number }, gain = 0.8) => {
    const a = audio.current;
    if (!a || a.engine.state() !== 'running') return;
    playSound(a.engine, name, { bus: 'sfx', gain, position });
  };

  /** A hit drops the music under the hurt sound and brings it back. */
  const duckMusic = () => {
    const a = audio.current;
    if (!a) return;
    a.engine.bus(BED_BUS).setGain(MUSIC_GAIN * 0.3, 60);
    window.setTimeout(() => a.engine.bus(BED_BUS).setGain(MUSIC_GAIN, 400), 260);
  };

  const hooks = useLatest<WorldHooks>({
    sound: fire,
    soundAt: (name, at, gain) => fireAt(name, at, gain),
    duck: duckMusic,
    bonk: onBonk,
    flagImpact: () => {
      fire('hurt', 0.9);
      onBonk();
      // Cut the bed a couple of frames later, so the thwack lands into silence.
      cutMusicIn.current = 2;
    },
  });

  const beginFrame = useCallback((g: GameRefs) => {
    audio.current?.engine.setListener({ x: g.player.body.x, y: g.player.body.y });
    if (cutMusicIn.current >= 0 && cutMusicIn.current-- === 0) {
      audio.current?.bed?.stop();
    }
  }, []);

  const endFrame = useCallback((g: GameRefs, simulating: boolean) => {
    const cycle = runCycle.current;
    if (!cycle) return;
    const speed = Math.abs(g.player.body.vx);
    if (simulating && g.player.body.onGround && speed > 1) {
      runScale.current = Math.max(speed / MOVE_SPEED, 0.2);
      cycle.setTimeScale(runScale.current);
      if (cycle.isPaused()) cycle.resume();
    } else if (!cycle.isPaused()) {
      // The animator ticks the cycle independently of the world, so it has to
      // be stopped here or footsteps keep firing after a pause or a death.
      cycle.pause();
    }
  }, []);

  const swarm = useCallback((points: readonly { x: number; y: number }[]) => {
    const a = audio.current;
    if (!a || a.engine.state() !== 'running') return;
    points.forEach((p, i) =>
      playSound(a.engine, 'stomp', {
        bus: 'sfx',
        gain: 0.2,
        position: p,
        when: a.engine.now() + i * 15,
      }),
    );
  }, []);

  const stats = useCallback(() => ({
    voices: audio.current?.engine.activeVoices() ?? 0,
    steps: stepStats.current.count,
    spread: stepStats.current.spread,
  }), []);

  return { hooks, audioState, musicOn, enableAudio, toggleMusic, beginFrame, endFrame, swarm, stats };
}
