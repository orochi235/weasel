import { useLatest } from '@weasel-js/react';
import { KeymapHint } from '@weasel-js/ui/components/KeymapHint';
import { useMemo, useReducer, useState, useSyncExternalStore } from 'react';
import type { LabContribution } from '../../chrome/labTypes';
import { createCloneSource } from './cloneSource';
import { LensActions } from './LensActions';
import { LensOverlay } from './LensOverlay';
import { createLensApi, useLensFocus } from './lensApi';
import { createLensScene } from './lensScene';
import type { LensSources } from './lensSource';
import { useFrameSchedule } from './useFrameSchedule';
import { useLabBody } from './useLabBody';
import { useLensRemeasure } from './useLensRemeasure';

/** A plain lab compares nothing, so the opposite preset clears a lens's comparison. */
const NO_COMPARISON = () => null;

/**
 * A lab's own lenses: the lens canvas over the lab body, the lens actions in the Loupe keymap (Alt+L), and its hint.
 * Each lens shows a copy of the trial under its reticle ({@link createCloneSource}). Lenses last as long as the lab
 * does and are never stored. Mount it with {@link labLoupe}.
 */
export function LabLoupe() {
  const [scene] = useState(createLensScene<null>);
  const { body, bodyRef, frameRef, pointer, attachMarker } = useLabBody();
  const { focus, onFocusLens } = useLensFocus();
  const onFrame = useFrameSchedule();
  const [live] = useState(() => createCloneSource<null>({ onFrame }));
  const sources = useMemo<LensSources<null>>(() => ({ live }), [live]);
  const sourcesRef = useLatest(sources);
  const [api] = useState(() =>
    createLensApi(scene, { body: bodyRef, frame: frameRef, pointer, focus, sources: sourcesRef }),
  );
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  // A Follow reticle moves through the scene's overrides, which bump no version; the lenses re-read it on a render.
  useSyncExternalStore(scene.overrides.subscribe, scene.overrides.getGeneration);
  const remeasured = useMemo(() => [live], [live]);
  useLensRemeasure(remeasured, body, rerender);

  return (
    <>
      <span hidden ref={attachMarker} />
      <LensOverlay scene={scene} sources={sources} onFocusLens={onFocusLens} />
      <LensActions api={api} bodyRef={bodyRef} opposite={NO_COMPARISON} />
      <KeymapHint className="lk-lab-loupe-hint" />
    </>
  );
}

/** The lab chrome that mounts {@link LabLoupe}: `<Lab labChrome={[labLoupe]} />`. */
export const labLoupe: LabContribution = {
  id: 'lk-loupe',
  region: 'overlay',
  render: () => <LabLoupe />,
};
