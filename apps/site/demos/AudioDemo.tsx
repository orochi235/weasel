import { useEffect, useRef, useState } from 'react';
import {
  asNodeId,
  PATH_L,
  PATH_M,
  SceneCanvas,
  textCommandFromRuns,
  useAnimator,
  useScene,
  useSelection,
} from '@weasel-js/core';
import type { DrawCommand, RenderLayer } from '@weasel-js/core';
import { createAudioEngine, spatialize } from '@weasel-js/audio';
import type { AnalyserTap, AudioEngine, SoundHandle, VoiceHandle } from '@weasel-js/audio';

interface Dot { id: string; x: number; y: number; width: number; height: number }

const W = 600, H = 340;
const LISTENER = { x: W / 2, y: 150 };
const SPATIAL = { refDistance: 40, panWidth: 260, rolloffFactor: 1.6 };
const BUSES = ['sfx', 'music'] as const;
type Bus = typeof BUSES[number];
const BARS = 16;
const SOURCE: Dot[] = [{ id: 'source', x: 430, y: 70, width: 24, height: 24 }];

interface ToneSpec { freq: number; ms: number; decay: number }

/** Fill a mono buffer with a decaying sine. A sustained tone is snapped to a
 *  whole number of cycles — a partial cycle clicks on every loop boundary. */
function makeTone(ctx: AudioContext, { freq, ms, decay }: ToneSpec): AudioBuffer {
  const seconds = ms / 1000;
  const frames = decay > 0
    ? Math.floor(ctx.sampleRate * seconds)
    : Math.round((Math.max(1, Math.round(freq * seconds)) / freq) * ctx.sampleRate);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    const t = i / ctx.sampleRate;
    const env = decay > 0 ? Math.exp(-decay * t) : 1;
    data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.5;
  }
  return buffer;
}

const TONES: Record<string, ToneSpec> = {
  pluck: { freq: 523, ms: 400, decay: 9 },
  thud: { freq: 98, ms: 600, decay: 7 },
  bell: { freq: 1319, ms: 900, decay: 4 },
  bed: { freq: 196, ms: 1000, decay: 0 },
};

interface Kit { engine: AudioEngine; sounds: Record<string, SoundHandle>; tap: AnalyserTap }

export function AudioDemo() {
  const scene = useScene<Dot>({ items: SOURCE });
  const selection = useSelection();
  const animator = useAnimator();

  const [kit, setKit] = useState<Kit | null>(null);
  const [state, setState] = useState<AudioContextState>('suspended');
  const [voices, setVoices] = useState(0);
  const [gains, setGains] = useState<Record<Bus, number>>({ sfx: 1, music: 1 });
  const [muted, setMuted] = useState<Record<Bus, boolean>>({ sfx: false, music: false });
  const [soloed, setSoloed] = useState<Record<Bus, boolean>>({ sfx: false, music: false });
  const [sourcePlaying, setSourcePlaying] = useState(false);
  const bands = useRef<Float32Array>(new Float32Array(BARS));
  const sourceVoice = useRef<VoiceHandle | null>(null);

  useEffect(() => {
    const engine = createAudioEngine({ buses: [...BUSES], voiceLimit: 8 });
    engine.setListener(LISTENER, SPATIAL);
    const sounds = Object.fromEntries(
      Object.entries(TONES).map(
        ([name, spec]) => [name, engine.register(makeTone(engine.context, spec))] as const,
      ),
    );
    setKit({ engine, sounds, tap: engine.analyser() });
    return () => { engine.dispose(); };
  }, []);

  useEffect(() => animator.keepAlive(), [animator]);
  useEffect(() => animator.onTick(() => {
    if (!kit) return;
    bands.current = kit.tap.bands(BARS);
    setState(kit.engine.state());
    setVoices(kit.engine.activeVoices());
  }), [animator, kit]);

  const node = scene.get(asNodeId('source'));
  const pose = (node?.pose ?? SOURCE[0]) as Dot;
  const center = { x: pose.x + pose.width / 2, y: pose.y + pose.height / 2 };
  const spatial = spatialize(center, LISTENER, SPATIAL);

  const cx = center.x, cy = center.y;
  useEffect(() => {
    sourceVoice.current?.setPosition({ x: cx, y: cy });
  }, [cx, cy]);

  const enable = (): void => {
    void kit?.engine.unlock().then(() => setState(kit.engine.state()));
  };

  const toggleSource = (): void => {
    if (!kit) return;
    if (sourceVoice.current) {
      sourceVoice.current.stop(80);
      sourceVoice.current = null;
      setSourcePlaying(false);
      return;
    }
    sourceVoice.current = kit.engine.play(kit.sounds.bed, {
      bus: 'music', loop: true, gain: 0.7, position: center,
    });
    setSourcePlaying(true);
  };

  const setBusGain = (bus: Bus, value: number): void => {
    setGains((g) => ({ ...g, [bus]: value }));
    kit?.engine.bus(bus).setGain(value, 30);
  };
  const setBusMute = (bus: Bus, on: boolean): void => {
    setMuted((m) => ({ ...m, [bus]: on }));
    kit?.engine.bus(bus).mute(on);
  };
  const setBusSolo = (bus: Bus, on: boolean): void => {
    setSoloed((s) => ({ ...s, [bus]: on }));
    kit?.engine.bus(bus).solo(on);
  };

  const trigger = (bus: Bus): void => {
    if (!kit) return;
    kit.engine.play(bus === 'sfx' ? kit.sounds.pluck : kit.sounds.bell, { bus, gain: 0.6 });
  };

  const burst = (): void => {
    if (!kit) return;
    const t0 = kit.engine.now();
    for (let i = 0; i < 50; i += 1) {
      kit.engine.play(kit.sounds.thud, {
        bus: 'sfx', when: t0 + i * 20, gain: 0.35, detune: (i % 12) * 100,
      });
    }
  };

  const overlay: RenderLayer<unknown> = {
    id: 'audio', label: 'Audio overlay',
    draw: () => {
      const cmds: DrawCommand[] = [
        {
          kind: 'path',
          path: {
            kind: 'polygon',
            commands: new Uint8Array([PATH_M, PATH_L]),
            coords: new Float32Array([LISTENER.x, LISTENER.y, center.x, center.y]),
            fillRule: 'nonzero',
          },
          stroke: { paint: { color: '#4a3c2e' }, width: 1 },
        },
        {
          kind: 'path',
          path: { kind: 'rect', x: LISTENER.x - 9, y: LISTENER.y - 9, width: 18, height: 18 },
          fill: { color: '#d4c4a8' },
        },
        textCommandFromRuns(
          LISTENER.x + 14, LISTENER.y + 4,
          [{ text: 'listener', fill: { fill: 'solid', color: '#a89878' } }],
          { fontFamily: 'sans-serif', fontSize: 11 },
        ),
      ];
      const barW = W / BARS;
      for (let i = 0; i < BARS; i += 1) {
        const h = Math.max(1, bands.current[i] * 90);
        cmds.push({
          kind: 'path',
          path: { kind: 'rect', x: i * barW + 2, y: H - h, width: barW - 4, height: h },
          fill: { color: '#7fb069' },
        });
      }
      return cmds;
    },
  };

  return (
    <div className="ckd-demo">
      <div className="ckd-toolbar">
        <button className="ckd-btn" onClick={enable} disabled={!kit || state === 'running'}>
          enable audio
        </button>
        <span className="ckd-readout">engine.state() = {state}</span>
        <button className="ckd-btn" onClick={toggleSource} disabled={!kit}>
          {sourcePlaying ? 'stop source' : 'play source'}
        </button>
        <button className="ckd-btn" onClick={burst} disabled={!kit}>fire 50 one-shots</button>
        <span className="ckd-readout">activeVoices {voices} / 8 per bus</span>
      </div>
      <div className="ckd-row">
        <SceneCanvas
          width={W}
          height={H}
          className="ckd-canvas"
          scene={scene}
          selection={selection}
          defaultTools={['select']}
          animator={animator}
          layers={{
            audio: { layer: overlay, before: 'scene' },
            scene: {
              drawOne: (_n, p): DrawCommand[] => [{
                kind: 'path',
                path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
                fill: { color: '#d4a574' },
              }],
            },
            selectionOverlay: { handles: false },
          }}
        />
        <div className="ckd-panel ckd-panel-wide">
          <div className="ckd-panel-title">spatial</div>
          <dl className="ckd-meters">
            <dt>gain</dt><dd>{spatial.gain.toFixed(3)}</dd>
            <dt>pan</dt><dd>{spatial.pan.toFixed(3)}</dd>
            <dt>distance</dt><dd>{Math.hypot(center.x - LISTENER.x, center.y - LISTENER.y).toFixed(0)}</dd>
          </dl>
          <div className="ckd-panel-title">buses</div>
          {BUSES.map((bus) => (
            <div className="ckd-bus" key={bus}>
              <span className="ckd-readout">{bus}</span>
              <input
                className="ckd-range" type="range" min={0} max={1} step={0.01}
                value={gains[bus]} onChange={(e) => setBusGain(bus, Number(e.target.value))}
              />
              <label className="ckd-field">
                <input
                  type="checkbox" checked={muted[bus]}
                  onChange={(e) => setBusMute(bus, e.target.checked)}
                />
                mute
              </label>
              <label className="ckd-field">
                <input
                  type="checkbox" checked={soloed[bus]}
                  onChange={(e) => setBusSolo(bus, e.target.checked)}
                />
                solo
              </label>
              <button className="ckd-btn" onClick={() => trigger(bus)} disabled={!kit}>
                trigger
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="ckd-hint">
        The context starts <code>suspended</code> — nothing sounds until
        <strong> enable audio</strong> resumes it from a user gesture. Drag the orange dot:
        the readouts are <code>spatialize()</code>, the same pure function the engine applies
        to the looping voice through <code>setPosition</code>. The bars are
        <code> analyser().bands(16)</code> on master. <strong>fire 50 one-shots</strong>
        books fifty plays 20 ms apart against the audio clock; the per-bus limit is 8, so the
        pool steals rather than piling up.
      </div>
    </div>
  );
}
