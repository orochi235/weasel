import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SceneSnapshot } from '../recorder';
import { deserializeRecording } from '../recordingIO';
import { createRecordingSession, RECORD_KEY, type RecordingHost } from './session';

const SNAPSHOT: SceneSnapshot = {
  version: 2,
  scene: { version: 1, nodes: [] },
  view: { x: 4, y: 5, scale: { x: 2, y: 2 } },
};

function setup(over: Partial<RecordingHost> = {}) {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const saved: Array<{ blob: Blob; filename: string }> = [];
  const host: RecordingHost = {
    snapshot: () => SNAPSHOT,
    restore: vi.fn(),
    profile: () => 'gesture-only',
    save: (blob, filename) => { saved.push({ blob, filename }); },
    pick: async () => null,
    changed: vi.fn(),
    failed: vi.fn(),
    ...over,
  };
  const session = createRecordingSession(host);
  const detach = session.attach(() => canvas);
  const press = (): void => {
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 3, clientY: 4 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 3, clientY: 4 }));
  };
  return { canvas, host, session, saved, detach, press };
}

beforeEach(() => {
  // `flush` replay yields a frame between events.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('recording session', () => {
  it('records the canvas between two toggles and saves a file holding the baseline', async () => {
    const t = setup();
    await t.session.toggle();
    expect(t.session.recording).toBe(true);
    t.press();
    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: RECORD_KEY }));
    await t.session.toggle();
    expect(t.session.recording).toBe(false);
    expect(t.host.changed).toHaveBeenCalledTimes(2);

    expect(t.saved).toHaveLength(1);
    expect(t.saved[0].filename).toMatch(/^weaseldraw-recording-.+\.json(\.gz)?$/);
    const rec = await deserializeRecording(t.saved[0].blob);
    expect(rec.events.map((e) => e.type)).toEqual(['pointerdown', 'pointerup']);
    expect(rec.scene).toEqual(SNAPSHOT);
  });

  it('plays a picked recording onto the canvas, after putting its baseline back', async () => {
    const recorded = setup();
    await recorded.session.toggle();
    recorded.press();
    await recorded.session.toggle();

    const order: string[] = [];
    const t = setup({
      pick: async () => recorded.saved[0].blob,
      restore: () => { order.push('restore'); },
    });
    t.canvas.addEventListener('pointerdown', () => order.push('pointerdown'));
    t.canvas.addEventListener('pointerup', () => order.push('pointerup'));
    const playing: boolean[] = [];
    vi.mocked(t.host.changed).mockImplementation(() => { playing.push(t.session.playing); });
    await t.session.play('flush');
    expect(order).toEqual(['restore', 'pointerdown', 'pointerup']);
    expect(playing).toEqual([true, false]);
  });

  it('does nothing when the picker is dismissed', async () => {
    const t = setup();
    await t.session.play('flush');
    expect(t.host.restore).not.toHaveBeenCalled();
    expect(t.host.changed).not.toHaveBeenCalled();
  });

  it('reports a file that is not a recording, and is ready to play again', async () => {
    const t = setup({ pick: async () => new Blob(['not json']) });
    await t.session.play('flush');
    expect(t.host.failed).toHaveBeenCalledOnce();
    expect(t.session.playing).toBe(false);
  });

  it('will not record while it plays, nor play while it records', async () => {
    const t = setup({ pick: vi.fn(async () => null) });
    await t.session.toggle();
    await t.session.play('flush');
    expect(t.host.pick).not.toHaveBeenCalled();
  });

  it('stops hearing the canvas when the surface goes away mid-recording', async () => {
    const t = setup();
    await t.session.toggle();
    t.detach();
    expect(t.session.recording).toBe(false);
    expect(t.saved).toHaveLength(0);
  });
});
