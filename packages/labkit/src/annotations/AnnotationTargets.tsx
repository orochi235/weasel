import { AnnotationOverlay } from './AnnotationOverlay';
import type { MarkScene } from './store';
import type { AnnotationsCapability } from './types';

/** Props for `<AnnotationTargets>`. */
export interface AnnotationTargetsProps {
  capability: AnnotationsCapability;
  state: unknown;
  config: unknown;
  scene: MarkScene;
  activeToolId: string | null;
}

/** One overlay per region the instrument said accepts marks. */
export function AnnotationTargets({
  capability,
  state,
  config,
  scene,
  activeToolId,
}: AnnotationTargetsProps) {
  const targets = capability.targets(state, config);

  return (
    <>
      {targets.map((t) => (
        <AnnotationOverlay
          key={t.id}
          target={t}
          scene={scene}
          config={config}
          activeToolId={activeToolId}
        />
      ))}
    </>
  );
}
