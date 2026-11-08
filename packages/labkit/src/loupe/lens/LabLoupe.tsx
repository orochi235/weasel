import { useLatest } from '@weasel-js/react';
import { KeymapHint } from '@weasel-js/ui/components/KeymapHint';
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { LabContribution } from '../../chrome/labTypes';
import { createCloneSource } from './cloneSource';
import { LensActions } from './LensActions';
import { LensOverlay } from './LensOverlay';
import { createLensApi, useLensFocus } from './lensApi';
import { createLensScene } from './lensScene';
import type { LensSources } from './lensSource';
import type { LoupePoint } from './lensTypes';
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
  const [body, setBody] = useState<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLElement | null>(null);
  const pointer = useRef<LoupePoint | null>(null);
  const { focus, onFocusLens } = useLensFocus();
  const [live] = useState(createCloneSource<null>);
  const sources = useMemo<LensSources<null>>(() => ({ live }), [live]);
  const sourcesRef = useLatest(sources);
  const [api] = useState(() =>
    createLensApi(scene, { body: bodyRef, pointer, focus, sources: sourcesRef }),
  );
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  // A Follow reticle moves through the scene's overrides, which bump no version; the lenses re-read it on a render.
  useSyncExternalStore(scene.overrides.subscribe, scene.overrides.getGeneration);
  const remeasured = useMemo(() => [live], [live]);
  useLensRemeasure(remeasured, body, rerender);

  useEffect(() => {
    if (!body) return;
    const track = (e: PointerEvent) => {
      pointer.current = { x: e.clientX, y: e.clientY };
    };
    body.addEventListener('pointermove', track, { passive: true });
    return () => body.removeEventListener('pointermove', track);
  }, [body]);

  // An overlay contribution renders inside the lab body, which is what this finds; the marker itself shows nothing.
  const attachMarker = useCallback((el: HTMLElement | null) => {
    const found = el?.closest<HTMLElement>('.lk-lab__body') ?? null;
    bodyRef.current = found;
    setBody(found);
  }, []);

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
