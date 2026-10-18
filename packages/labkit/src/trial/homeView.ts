import { clampCamera, createCamera } from '@weasel-js/kernel3d';
import { fitStage } from '../canvas/Stage';
import type { ViewportSize } from '../canvas/worldSpec';
import type {
  CanvasCapability,
  Instrument,
  OrbitCapability,
  StageCapability,
} from '../instrument/types';
import { DEFAULT_VIEW } from '../state/view';

/** The camera an instrument declares, by kind. */
export type InstrumentCamera =
  | { kind: 'canvas'; capability: CanvasCapability }
  | { kind: 'stage'; capability: StageCapability }
  | { kind: 'orbit'; capability: OrbitCapability }
  | null;

/** Which camera `instrument` declares. `canvas` wins over `stage`, whose DOM it
 *  then lays over its layers; `orbit` combines with neither, and throws. */
export function cameraOf(instrument: Instrument): InstrumentCamera {
  const { canvas, stage, orbit } = instrument;
  if (orbit) {
    if (canvas || stage) {
      throw new Error(
        `[labkit] instrument "${instrument.name}" declares \`orbit\` beside \`${canvas ? 'canvas' : 'stage'}\`; a trial has one camera`,
      );
    }
    return { kind: 'orbit', capability: orbit };
  }
  if (canvas) return { kind: 'canvas', capability: canvas };
  if (stage) return { kind: 'stage', capability: stage };
  return null;
}

/** Whether where `instrument` opens depends on its viewport's size. */
export function opensBySize(instrument: Instrument): boolean {
  const camera = cameraOf(instrument);
  if (!camera) return false;
  const declared = camera.capability.initialView;
  // A stage that names no view is fitted, which needs the size.
  return typeof declared === 'function' || (camera.kind === 'stage' && declared === undefined);
}

/**
 * The view `instrument` opens on — where a fresh trial starts, and where Reset
 * and the `home` gesture return it — in a viewport of `size`. `null` when that
 * depends on a size not yet known: the unplaced marker a trial holds until its
 * camera is first measured.
 */
export function homeView(instrument: Instrument, size: ViewportSize | null): unknown {
  const camera = cameraOf(instrument);
  if (size === null && opensBySize(instrument)) return null;
  const vp = size ?? { width: 0, height: 0 };
  switch (camera?.kind) {
    case 'orbit': {
      const declared = camera.capability.initialView;
      const fields = typeof declared === 'function' ? declared(vp) : declared;
      return clampCamera(createCamera(fields ?? {}), camera.capability.limits);
    }
    case 'stage': {
      const { initialView, size: content } = camera.capability;
      if (initialView === undefined) return fitStage(content, vp);
      return typeof initialView === 'function' ? initialView(vp) : structuredClone(initialView);
    }
    case 'canvas': {
      const { initialView } = camera.capability;
      if (typeof initialView === 'function') return initialView(vp);
      if (initialView) return structuredClone(initialView);
      break;
    }
  }
  return { ...DEFAULT_VIEW, pan: { ...DEFAULT_VIEW.pan } };
}
