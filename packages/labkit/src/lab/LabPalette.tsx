import { labContributions, useLabChromeContext } from '../chrome/LabChrome';
import type { LabContribution } from '../chrome/labTypes';
import { PaletteRegion } from '../chrome/regions/PaletteRegion';
import type { TrialTool } from '../tools/types';

/** Props for `<LabPalette>`. */
export interface LabPaletteProps {
  /** Tools offered lab-wide. Shorthand for one `palette` contribution each. */
  tools?: readonly TrialTool[];
  /** The lab's contributions; the `palette` ones are laid out here. */
  contributions?: readonly LabContribution[];
}

/** The lab's tool rail. Writes the lab's tool slot, which every trial whose
 *  instrument declares no tools of its own resolves to. Renders nothing when
 *  the lab contributes no tool rail. */
export function LabPalette({ tools, contributions }: LabPaletteProps) {
  const ctx = useLabChromeContext();
  const all = labContributions(tools, contributions);
  return <PaletteRegion contributions={all.filter((c) => c.region === 'palette')} ctx={ctx} />;
}
