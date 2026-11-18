import { LayerList, type LayerListItem, moveLayers } from '@weasel-js/ui/components/LayerList';
import { Sidebar } from '@weasel-js/ui/components/Sidebar';
import { SidebarPanel } from '@weasel-js/ui/components/SidebarPanel';
import { useState } from 'react';
import { Cell } from './Cell';
import { PrefsCell } from './PrefsCell';
import { Section } from './Section';
import { ShapePanelCell } from './ShapePanelCell';

export function PanelsAndRows() {
  const [layers, setLayers] = useState<LayerListItem[]>([
    { id: 'base', label: 'Base coat' },
    { id: 'wash', label: 'Wash' },
  ]);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  return (
    <Section title="Panels & property rows">
      <ShapePanelCell />
      <PrefsCell />
      <Cell label="LayerList">
        <LayerList items={layers} onReorder={(move) => setLayers(moveLayers(layers, move))} />
      </Cell>
      <Cell label="Sidebar, SidebarPanel">
        <div className="lk-specimen__box">
          <Sidebar side="right" aria-label="Specimen sidebar">
            <SidebarPanel
              title="Selection"
              collapsed={panelCollapsed}
              onCollapsedChange={setPanelCollapsed}
              onHide={() => {}}
            >
              <div className="lk-specimen__pad">2 items selected</div>
            </SidebarPanel>
          </Sidebar>
        </div>
      </Cell>
    </Section>
  );
}
