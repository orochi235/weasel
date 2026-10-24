import type { Motif } from '@weasel-js/ui/components/MotifFrame';
import type { ReactNode } from 'react';
import { headingLeaf } from '../config/headingLeaf';
import { valueAtPath } from '../config/path';
import type { ControlRenderer, ResolvedConfig, SectionSpec } from '../config/types';
import { BareControl, leafValueAt } from './fields';

/** What a lifted heading control reads and writes through. */
export interface LiftScope<TC extends Record<string, unknown>> {
  resolved: ResolvedConfig;
  renderers: Record<string, ControlRenderer> | undefined;
  shown: TC;
  setConfig: (path: string, value: unknown) => void;
  draftConfig: ((path: string, value: unknown) => void) | undefined;
  visible: (path: string) => boolean;
  enabled: (path: string) => boolean;
}

/** The control a heading carries in its title row, lifted out of the rows
 *  beneath it — see `headingLeaf`. */
export function liftedControl<TC extends Record<string, unknown>>(
  heading: ReactNode,
  paths: readonly string[],
  scope: LiftScope<TC>,
) {
  const { resolved, renderers, shown, setConfig, draftConfig, visible, enabled } = scope;
  const found = headingLeaf(resolved, heading, paths, renderers);
  if (!found) return { path: undefined, control: undefined };
  const { path, leaf } = found;
  return {
    path,
    control: visible(path) ? (
      <BareControl
        leaf={leaf}
        value={leafValueAt(shown, path, leaf)}
        write={(value) => setConfig(path, value)}
        draft={draftConfig && ((value) => draftConfig(path, value))}
        name={typeof heading === 'string' ? heading : undefined}
        disabled={!enabled(path)}
        read={(p) => valueAtPath(shown, p)}
      />
    ) : undefined,
  };
}

/** What a group's heading carries: its lifted control, its reset button, or both. */
export function headingActions(control: ReactNode, reset: ReactNode): ReactNode {
  if (!control || !reset) return control ?? reset;
  return (
    <>
      {control}
      {reset}
    </>
  );
}

/** What a section says of its own frame: its title, its class, and its motif, else the panel's. */
export function sectionFrame(
  section: SectionSpec,
  motif: Motif | undefined,
): { title: string; className?: string; motif?: Motif } {
  return { title: section.label, className: section.className, motif: section.motif ?? motif };
}

/** How a section is keyed for folding: its label at the root, and its group's
 *  path in front of it anywhere else, so two groups may both have an
 *  `Advanced`. */
export function sectionKey(section: SectionSpec): string {
  return section.at === '' ? section.label : `${section.at}.${section.label}`;
}
