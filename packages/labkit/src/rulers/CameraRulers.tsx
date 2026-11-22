import { viewWorldToScreen } from '@weasel-js/core';
import type { Guide, Rulers as RulersModel } from '@weasel-js/guides';
import { watchResize } from '@weasel-js/react';
import { Rulers } from '@weasel-js/ui-canvas/components/Rulers';
import {
  type ReactElement,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { CameraContext } from '../canvas/CameraInput';
import { toCameraView } from '../canvas/cameraView';
import { layoutSize } from '../canvas/hostBox';
import type { ViewportSize } from '../canvas/worldSpec';
import type { ViewTransform2D } from '../instrument/types';
import type { TrialGuidesShown } from './types';

/** Props for {@link CameraRulers}. */
export interface CameraRulersProps {
  /** The rulers, their contribution installed on the camera around this. */
  rulers: RulersModel;
  /** The camera's view, which the rulers follow. */
  view: ViewTransform2D;
  shown: TrialGuidesShown;
  /** The guides to draw, and where their changes are heard. */
  getGuides: () => readonly Guide[];
  subscribe: (listener: () => void) => () => void;
}

const NO_SIZE: ViewportSize = { width: 0, height: 0 };

/** One guide's line across a `size` viewport, in screen px. */
function guideLine(g: Guide, rulers: RulersModel, size: ViewportSize) {
  const view = rulers.get().view;
  if (!view) return null;
  const at = viewWorldToScreen(view, { x: g.offset, y: g.offset });
  return g.axis === 'x'
    ? { x1: at.x, x2: at.x, y1: 0, y2: size.height }
    : { x1: 0, x2: size.width, y1: at.y, y2: at.y };
}

/**
 * Rulers over a labkit camera, inside its `<CanvasStack>` or `<Stage>`, and the guides placed off them: reports the
 * camera's view through the camera's frame, so the rulers read the instrument's own world, and draws whatever
 * `shown` asks. It takes no input; the rulers' contribution on the camera does.
 */
export function CameraRulers({
  rulers,
  view,
  shown,
  getGuides,
  subscribe,
}: CameraRulersProps): ReactElement | null {
  const camera = useContext(CameraContext);
  const box = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<ViewportSize | null>(null);
  const state = useSyncExternalStore(rulers.subscribe, rulers.get, rulers.get);
  const guides = useSyncExternalStore(subscribe, getGuides, getGuides);
  const frame = camera?.frame;

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () =>
      setSize((prev) => {
        const next = layoutSize(el);
        return next && prev?.width === next.width && prev.height === next.height ? prev : next;
      });
    measure();
    return watchResize(el, measure);
  }, []);

  useLayoutEffect(() => {
    // Before a size, still the view: snapping to the guides reads it.
    if (frame) rulers.follow(toCameraView(view, frame), size ?? NO_SIZE);
  }, [rulers, view, frame, size]);

  const lines = size
    ? [
        ...(shown.guides ? rulers.settled(guides) : []).map((g) => ({ g, draft: false })),
        ...(state.draft ? [{ g: state.draft, draft: true }] : []),
      ]
    : [];
  return (
    <div ref={box} className="lk-camera-rulers">
      {size && lines.length > 0 ? (
        <svg
          className="lk-camera-rulers__guides"
          aria-hidden="true"
          width={size.width}
          height={size.height}
        >
          {lines.map(({ g, draft }) => {
            const line = guideLine(g, rulers, size);
            return line ? (
              <line
                key={draft ? 'draft' : g.id}
                className="lk-camera-rulers__guide"
                data-draft={draft ? '' : undefined}
                {...line}
              />
            ) : null;
          })}
        </svg>
      ) : null}
      {shown.rulers ? <Rulers rulers={rulers} /> : null}
    </div>
  );
}
