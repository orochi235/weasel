import type { ComponentType } from 'react';
import type { PresetComponentProps } from './features';

/** The canvas's presets' components, each rendered once with what the canvas hands them. */
export function PresetComponents({ parts, ...props }: PresetComponentProps & {
  parts: readonly ComponentType<PresetComponentProps>[];
}) {
  return <>{parts.map((Part, i) => <Part key={i} {...props} />)}</>;
}
