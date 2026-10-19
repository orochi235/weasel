import { useLatest, type SerializedScene, type SurfaceContribution, type View } from '@weasel-js/core';
import { toast } from '@weasel-js/ui/components/Toast';
import { useMemo, useReducer } from 'react';
import { downloadBlob, pickFile, serializeReplacer } from '@editor/index';
import { reviveSnapshot } from '../persistence';
import { drawPrefs } from '../prefs';
import type { RecordingProfile } from '../recorder';
import { recordingContribution } from './contribution';
import { createRecordingSession, type RecordingHost } from './session';

const PROFILES: readonly RecordingProfile[] = ['gesture-only', 'full', 'events-only'];

/** The parts of the editor a recording's baseline covers. */
export interface RecordingTarget {
  scene: { toJSON(): unknown; loadState(json: never): void };
  view(): View;
  setView(view: View): void;
}

/** The baseline half of a {@link RecordingHost}: the scene and the camera. */
export function baselineOf(target: RecordingTarget): Pick<RecordingHost, 'snapshot' | 'restore'> {
  return {
    snapshot: () => ({
      version: 2,
      // Through the replacer, so typed-array path data survives the recording's own JSON.
      scene: JSON.parse(JSON.stringify(target.scene.toJSON(), serializeReplacer)),
      view: target.view(),
    }),
    restore: (snapshot) => {
      target.scene.loadState(reviveSnapshot(snapshot.scene as SerializedScene<unknown, string, unknown>) as never);
      target.setView(snapshot.view);
    },
  };
}

/**
 * Draw's input recorder as a canvas contribution. Record saves a file when it
 * stops; Play asks for one and replays it over the canvas. `target` is read
 * live, so it may be a fresh object each render.
 */
export function useRecording(target: RecordingTarget): SurfaceContribution {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const live = useLatest(target);
  return useMemo(() => recordingContribution(createRecordingSession({
    ...baselineOf({
      scene: { toJSON: () => live.current.scene.toJSON(), loadState: (json) => live.current.scene.loadState(json) },
      view: () => live.current.view(),
      setView: (view) => live.current.setView(view),
    }),
    profile: () => PROFILES.find((p) => p === drawPrefs().get('recording.profile')) ?? 'gesture-only',
    save: downloadBlob,
    pick: () => pickFile('.json,.gz,application/json,application/gzip'),
    changed: rerender,
    failed: (message) => { toast.error('The recording could not be played', { description: message }); },
  })), [live]);
}
