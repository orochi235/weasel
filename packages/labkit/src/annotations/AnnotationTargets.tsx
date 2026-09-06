import type { TrialInfo } from '../state/types';
import { AnnotationOverlay } from './AnnotationOverlay';
import type { AnnotationsApi, AnnotationsCapability } from './types';

/** Props for `<AnnotationTargets>`. */
export interface AnnotationTargetsProps {
  capability: AnnotationsCapability;
  state: unknown;
  config: unknown;
  /** The trial these targets belong to. `capability.targets` is told it, so a
   *  consumer holding per-trial refs can hand back this trial's. */
  trial: TrialInfo;
  annotations: AnnotationsApi;
  activeToolId: string | null;
}

/** One overlay per region the instrument said accepts marks. */
export function AnnotationTargets({
  capability,
  state,
  config,
  trial,
  annotations,
  activeToolId,
}: AnnotationTargetsProps) {
  const targets = capability.targets(state, config, trial);

  return (
    <>
      {targets.map((t) => (
        <AnnotationOverlay
          key={t.id}
          target={t}
          scene={annotations.sceneFor(t.id)}
          meaning={capability.meaning}
          config={config}
          activeToolId={activeToolId}
        />
      ))}
    </>
  );
}
