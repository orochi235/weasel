import { AnnotationOverlay } from './AnnotationOverlay';
import type { AnnotationsApi, AnnotationsCapability } from './types';

/** Props for `<AnnotationTargets>`. */
export interface AnnotationTargetsProps {
  capability: AnnotationsCapability;
  state: unknown;
  config: unknown;
  annotations: AnnotationsApi;
  activeToolId: string | null;
}

/** One overlay per region the instrument said accepts marks. */
export function AnnotationTargets({
  capability,
  state,
  config,
  annotations,
  activeToolId,
}: AnnotationTargetsProps) {
  const targets = capability.targets(state, config);

  return (
    <>
      {targets.map((t) => (
        <AnnotationOverlay
          key={t.id}
          target={t}
          scene={annotations.sceneFor(t.id)}
          config={config}
          activeToolId={activeToolId}
        />
      ))}
    </>
  );
}
