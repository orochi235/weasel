import { createRecorder, type RecordingProfile, type SceneSnapshot } from '../recorder';
import { deserializeRecording, RECORDING_EXTENSION, serializeRecording } from '../recordingIO';
import { replayRecording, type ReplayOptions } from '../replay';

/** The key that starts and stops a recording. The recorder leaves it out, or
 *  replaying a recording would end by starting another. */
export const RECORD_KEY = 'F9';

/** What a recording session needs from the app around it. */
export interface RecordingHost {
  /** The baseline a recording carries, so it replays from the state it began in. */
  snapshot(): SceneSnapshot | null;
  /** Put a recording's baseline back before its first event replays. */
  restore(snapshot: SceneSnapshot): void;
  profile(): RecordingProfile;
  save(blob: Blob, filename: string): void;
  /** The recording file to play, or null when the user picks none. */
  pick(): Promise<Blob | null>;
  /** `recording` or `playing` changed. */
  changed(): void;
  failed(message: string): void;
}

export interface RecordingSession {
  /** Bind to the canvas whose input is recorded and replayed. Returns the
   *  teardown, which drops a recording in flight. */
  attach(canvas: () => HTMLCanvasElement | null): () => void;
  readonly recording: boolean;
  readonly playing: boolean;
  /** Start a recording, or stop the one in flight and save it. */
  toggle(): Promise<void>;
  /** Pick a recording file and replay it. */
  play(mode?: ReplayOptions['mode']): Promise<void>;
}

export function createRecordingSession(host: RecordingHost): RecordingSession {
  let canvas: () => HTMLCanvasElement | null = () => null;
  let playing = false;
  const recorder = createRecorder({
    canvas: () => canvas(),
    surface: () => canvas(),
    skipKey: (e) => e.key === RECORD_KEY,
  });

  return {
    attach(next) {
      canvas = next;
      return () => {
        if (recorder.isRecording()) {
          recorder.stop();
          host.changed();
        }
        canvas = () => null;
      };
    },
    get recording() { return recorder.isRecording(); },
    get playing() { return playing; },

    async toggle() {
      if (playing || !canvas()) return;
      if (!recorder.isRecording()) {
        recorder.start({ snapshotScene: host.snapshot, profile: host.profile() });
        host.changed();
        return;
      }
      const recording = recorder.stop();
      host.changed();
      const blob = await serializeRecording(recording);
      const stamp = recording.startedAt.replace(/[:.]/g, '-');
      const extension = blob.type === 'application/gzip' ? RECORDING_EXTENSION : 'json';
      host.save(blob, `weaseldraw-recording-${stamp}.${extension}`);
    },

    async play(mode = 'realtime') {
      const target = canvas();
      if (playing || recorder.isRecording() || !target) return;
      const blob = await host.pick();
      if (!blob) return;
      playing = true;
      host.changed();
      try {
        const recording = await deserializeRecording(blob);
        const { scene } = recording;
        await replayRecording(recording, {
          canvas: target,
          mode,
          ...(scene ? { beforeFirstEvent: () => host.restore(scene) } : {}),
        });
      } catch (err) {
        host.failed(err instanceof Error ? err.message : String(err));
      } finally {
        playing = false;
        host.changed();
      }
    },
  };
}
