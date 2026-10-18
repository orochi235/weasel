import { describe, expect, it } from 'vitest';
import type { AudioEngine } from '../createAudioEngine';
import type { VoiceHandle } from '../types';
import { renderEngineStereo } from '../testing/renderEngine';
import { rmsEnvelope } from '../testing/spectrum';

// A worklet voice has to sound as a node voice does through the whole engine:
// level, pan, position, a gain ramp, a fade, a steal. Each scenario renders
// once per kind and compares the two channels' levels over time.

const RATE = 48000;
const WINDOW = Math.round(RATE * 0.01);

type Later = Parameters<typeof renderEngineStereo>[4];

async function both(seconds: number, play: (e: AudioEngine) => void, voiceLimit?: number, later?: Later) {
  const nodes = await renderEngineStereo(seconds, play, RATE, { random: () => 0, voiceLimit }, later);
  const worklet = await renderEngineStereo(seconds, play, RATE, {
    random: () => 0, voiceLimit, synthVoices: 'worklet',
  }, later);
  return { nodes, worklet };
}

function expectSameLevels(a: Float32Array, b: Float32Array, label: string): void {
  const x = rmsEnvelope(a, WINDOW);
  const y = rmsEnvelope(b, WINDOW);
  for (let i = 0; i < x.length; i += 1) {
    expect(Math.abs(x[i] - y[i]), `${label}, window ${i}`).toBeLessThan(0.03 + 0.1 * y[i]);
  }
}

function expectSame(r: Awaited<ReturnType<typeof both>>): void {
  expect(Math.max(...rmsEnvelope(r.worklet[0], WINDOW), ...rmsEnvelope(r.worklet[1], WINDOW))).toBeGreaterThan(0.05);
  expectSameLevels(r.worklet[0], r.nodes[0], 'left');
  expectSameLevels(r.worklet[1], r.nodes[1], 'right');
}

describe('a worklet voice against a node voice, through the engine', () => {
  it('matches a note at a gain and a pan', async () => {
    expectSame(await both(0.4, (e) => {
      e.playNote({ pitch: 330, wave: 'sawtooth', gain: 0.6, pan: 0.5, duration: 200, envelope: { release: 60 } });
    }));
  });

  it('matches a positioned noise voice', async () => {
    expectSame(await both(0.3, (e) => {
      e.setListener({ x: 0, y: 0 }, { rolloff: 'linear', maxDistance: 1000, panWidth: 500 });
      e.playNoise({ noise: 'white', position: { x: -250, y: 100 }, duration: 200, when: 20 });
    }));
  });

  // Mid-render, as a node's gain anchors a ramp at the value it last rendered.
  it('matches a gain ramp and a pan change', async () => {
    let v: VoiceHandle;
    expectSame(await both(0.3, (e) => {
      v = e.playNote({ pitch: 440, gain: 0.8, duration: 250 });
    }, undefined, {
      at: 0.05,
      run: () => {
        v.setGain(0.2, 100);
        v.setPan(-0.7);
      },
    }));
  });

  it('matches a fade', async () => {
    let v: VoiceHandle;
    expectSame(await both(0.3, (e) => {
      v = e.playNote({ pitch: 440, wave: 'square', gain: 0.5 });
    }, undefined, { at: 0.1, run: () => v.stop(80) }));
  });

  it('matches a steal: the second voice cuts the first', async () => {
    const r = await both(0.3, (e) => {
      e.playNote({ pitch: 440 });
      e.playNote({ pitch: 660, when: 50, duration: 150 });
    }, 1);
    expectSame(r);
    const early = rmsEnvelope(r.worklet[0].subarray(0, Math.round(0.05 * RATE)), WINDOW);
    expect(Math.max(...early)).toBe(0);
  });
});
