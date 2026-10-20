import { MenuBar } from '@weasel-js/ui/components/MenuBar';
import { useMemo } from 'react';
import type { LabContribution } from '../chrome/labTypes';
import { useLabCommands } from './LabContext';
import { type LabMenus, labMenuBar } from './labMenus';

/** Props for `LabMenuBar`. */
export interface LabMenuBarProps {
  menus?: LabMenus;
  contributions: readonly LabContribution[];
  addTrial: boolean;
  zoom: boolean;
}

/** The lab's menu bar. Its rows run the commands `LabCommands` and `LabZoom` register, so it
 *  must sit inside the lab's actions registry. */
export function LabMenuBar({ menus, contributions, addTrial, zoom }: LabMenuBarProps) {
  const { instruments } = useLabCommands();
  const declared = menus?.schema;
  const schema = useMemo(
    () => labMenuBar({ instruments, addTrial, zoom, header: contributions, declared }),
    [instruments, addTrial, zoom, contributions, declared],
  );
  return (
    <MenuBar
      schema={schema}
      values={menus?.values}
      onChange={menus?.onChange}
      label="Lab menu bar"
    />
  );
}
