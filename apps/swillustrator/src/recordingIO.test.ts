import { describe, expect, it } from 'vitest';
import { deserializeRecording, serializeRecording } from './recordingIO';
import type { Recording } from './recorder';

const sample: Recording = {
  version: 1,
  startedAt: '2026-05-16T19:30:00.000Z',
  profile: 'gesture-only',
  viewport: { w: 1200, h: 800 },
  scene: null,
  events: [
    { type: 'pointerdown', t: 0, clientX: 10, clientY: 20, target: 'canvas' },
    { type: 'pointermove', t: 17, clientX: 12, clientY: 22, target: 'canvas' },
    { type: 'pointerup', t: 50, clientX: 14, clientY: 24, target: 'canvas' },
  ],
};

describe('recordingIO', () => {
  it('serializeRecording produces a gzipped blob with gzip magic bytes', async () => {
    const blob = await serializeRecording(sample);
    expect(blob.type).toBe('application/gzip');
    const bytes = await new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
    expect(bytes[0]).toBe(0x1f);
    expect(bytes[1]).toBe(0x8b);
    // Should be smaller than the JSON for this many repeated keys.
    const jsonSize = JSON.stringify(sample).length;
    expect(bytes.byteLength).toBeLessThan(jsonSize);
  });

  it('round-trips a recording through serialize → deserialize', async () => {
    const blob = await serializeRecording(sample);
    const back = await deserializeRecording(blob);
    expect(back).toEqual(sample);
  });

  it('deserializeRecording accepts a plain-JSON blob (backward compat)', async () => {
    const plain = new Blob([JSON.stringify(sample)], { type: 'application/json' });
    const back = await deserializeRecording(plain);
    expect(back).toEqual(sample);
  });

  it('deserializeRecording handles a much larger payload (real-ish size)', async () => {
    const big: Recording = {
      ...sample,
      events: Array.from({ length: 5000 }, (_, i) => ({
        type: 'pointermove' as const,
        t: i * 16,
        clientX: 100 + (i % 200),
        clientY: 100 + ((i * 7) % 200),
        target: 'canvas' as const,
      })),
    };
    const blob = await serializeRecording(big);
    const back = await deserializeRecording(blob);
    expect(back.events).toHaveLength(5000);
    expect(back.events[2500].clientX).toBe(big.events[2500].clientX);
    // Compression should produce a substantial reduction for repetitive data.
    const jsonSize = JSON.stringify(big).length;
    expect(blob.size).toBeLessThan(jsonSize / 3);
  });
});
