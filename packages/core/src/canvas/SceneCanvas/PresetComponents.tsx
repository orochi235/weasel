import type { ComponentType } from 'react';
import { createPart } from '@weasel-js/registry';
import { DepRank } from '@weasel-js/routing/react';
import type { PresetComponentProps } from './features';

/** The rank a preset component's dep sources join at: over the canvas's own, at the default 0. */
const PRESET_DEP_RANK = 1;
/** The rank the canvas's children's dep sources join at: over its presets' components, whichever mounted last. */
export const CHILD_DEP_RANK = 2;

let nextKey = 0;
/** One key per component for as long as it lives, so turning off a preset ahead of it does not remount it. */
const keyOf = createPart((_part: ComponentType<PresetComponentProps>): number => nextKey++);

/** The canvas's presets' components, each rendered once with what the canvas hands them. */
export function PresetComponents({ parts, ...props }: PresetComponentProps & {
  parts: readonly ComponentType<PresetComponentProps>[];
}) {
  return <DepRank rank={PRESET_DEP_RANK}>{parts.map((Part) => <Part key={keyOf(Part)} {...props} />)}</DepRank>;
}
