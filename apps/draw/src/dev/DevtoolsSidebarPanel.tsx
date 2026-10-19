/** DEV-only: the devtools panel over this page's own canvases, as a folding panel in the right sidebar. */
import { useMemo, type ReactElement } from 'react';
import { DevtoolsPanel, createInPagePanelTransport } from '@weasel-js/devtools';
import { PropertyPanel } from '@weasel-js/ui/components/Properties';
import s from './DevtoolsSidebarPanel.module.css';

export function DevtoolsSidebarPanel(): ReactElement {
  const transport = useMemo(() => createInPagePanelTransport(), []);
  return (
    <PropertyPanel stance="debug" title="Devtools" collapsible defaultCollapsed>
      <div className={s.body}>
        <DevtoolsPanel transport={transport} />
      </div>
    </PropertyPanel>
  );
}

export default DevtoolsSidebarPanel;
