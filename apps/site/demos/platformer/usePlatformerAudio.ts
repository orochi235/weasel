import { useEffect, useRef, useState } from 'react';
import type { Animator, TimelineHandle } from '@weasel-js/core';
import { createAudioEngine } from '@weasel-js/audio';
import type { AudioEngine, SoundHandle, VoiceHandle } from '@weasel-js/audio';
import { MOVE_SPEED } from './physics';
import { registerSounds, type SoundName } from './sfx';
import { CLIPS } from './clips';
import { footstepTrack } from './footsteps';
import type { GameRefs, WorldHooks } from './world';

/** A footfall pair spanning a time-scale change is still accelerating, not
 *  steady — the gap would measure speed change, not scheduling jitter. */
const JITTER_SCALE_TOLERANCE = 0.02;

type Audio = { engine: AudioEngine; sounds: Record<SoundName, SoundHandle>; bed: VoiceHandle | null };

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
  /** Readouts, polled rather than rendered per frame. */
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
      const engine = createAudioEngine({ buses: ['sfx', 'music'], voiceLimit: 24 });
      audio.current = { engine, sounds: registerSounds(engine), bed: null };
    }
    const { engine } = audio.current;
    void engine.unlock().then(() => {
      setAudioState(engine.state() === 'running' ? 'running' : 'suspended');
      if (!audio.current!.bed) {
        engine.bus('music').mute(!musicOn);
        audio.current!.bed = engine.play(audio.current!.sounds.bed, { bus: 'music', loop: true, gain: 0.5 });
      }
    });
  };

  /** The bed is the only sound that runs on its own — everything else is a
   *  one-shot that stops when you do — so it gets a switch of its own. */
  const toggleMusic = () => {
    const next = !musicOn;
    audio.current?.engine.bus('music').mute(!next);
    setMusicOn(next);
  };

  useEffect(() => () => {
    audio.current?.engine.dispose();
    audio.current = null;
  }, []);

  useEffect(() => {
    const handle = animator.timeline({
      loop: true,
      autoplay: true,
      // Steps book against the engine's clock once there is one. Before the
      // unlock gesture nothing sounds, and the timeline resyncs when it swaps.
      booking: { clock: { now: () => audio.current?.engine.now() ?? performance.now() } },
      tracks: [
        footstepTrack((_authoredT, when) => {
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
          const voice = a.engine.play(a.sounds.step, { bus: 'sfx', gain: 0.35, when });
          // A jump or a change of run speed retracts a step that has not
          // sounded; it is booked again wherever the cycle next reaches it.
          return {
            stop: () => {
              voice.stop();
              s.count--;
              Object.assign(s, prev);
            },
          };
        }),
      ],
      duration: CLIPS.run.duration,
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
    a.engine.play(a.sounds[name], { bus: 'sfx', gain });
  };

  /** For sounds with a place in the world — the engine spatializes against the
   *  listener set from the player each frame. */
  const fireAt = (name: SoundName, position: { x: number; y: number }, gain = 0.8) => {
    const a = audio.current;
    if (!a || a.engine.state() !== 'running') return;
    a.engine.play(a.sounds[name], { bus: 'sfx', gain, position });
  };

  /** A hit drops the music under the hurt sound and brings it back. */
  const duckMusic = () => {
    const a = audio.current;
    if (!a) return;
    a.engine.bus('music').setGain(0.15, 60);
    window.setTimeout(() => a.engine.bus('music').setGain(0.5, 400), 260);
  };

  const hooks = useRef<WorldHooks>(null!);
  hooks.current = {
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
  };

  const beginFrame = (g: GameRefs) => {
    audio.current?.engine.setListener({ x: g.player.body.x, y: g.player.body.y });
    if (cutMusicIn.current >= 0 && cutMusicIn.current-- === 0) {
      audio.current?.bed?.stop(40);
    }
  };

  const endFrame = (g: GameRefs, simulating: boolean) => {
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
  };

  const swarm = (points: readonly { x: number; y: number }[]) => {
    const a = audio.current;
    if (!a || a.engine.state() !== 'running') return;
    points.forEach((p, i) =>
      a.engine.play(a.sounds.stomp, {
        bus: 'sfx',
        gain: 0.2,
        position: p,
        when: a.engine.now() + i * 15,
      }),
    );
  };

  const stats = () => ({
    voices: audio.current?.engine.activeVoices() ?? 0,
    steps: stepStats.current.count,
    spread: stepStats.current.spread,
  });

  return { hooks, audioState, musicOn, enableAudio, toggleMusic, beginFrame, endFrame, swarm, stats };
}
