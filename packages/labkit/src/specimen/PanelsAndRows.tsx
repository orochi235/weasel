import type { PrefGroup } from '@weasel-js/prefs';
import { LayerList, type LayerListItem, moveLayers } from '@weasel-js/ui/components/LayerList';
import { PrefsForm } from '@weasel-js/ui/components/Prefs';
import {
  PropertyField,
  PropertyGroup,
  PropertyList,
  PropertyPanel,
} from '@weasel-js/ui/components/Properties';
import { Sidebar } from '@weasel-js/ui/components/Sidebar';
import { SidebarPanel } from '@weasel-js/ui/components/SidebarPanel';
import { useState } from 'react';
import { Cell } from './Cell';
import { Section } from './Section';

const PREFS: PrefGroup = {
  name: 'Preferences',
  children: {
    canvas: {
      name: 'Canvas',
      children: {
        showGrid: {
          kind: 'boolean',
          name: 'Show grid',
          description: 'Draw a grid behind the scene.',
          default: true,
        },
        zoomStep: {
          kind: 'number',
          name: 'Zoom step',
          description: 'Percent the zoom controls move per click.',
          default: 10,
          min: 1,
          max: 50,
        },
        format: {
          kind: 'enum',
          name: 'Format',
          description: 'File type for exported images.',
          default: 'svg',
          options: [
            { value: 'svg', label: 'SVG' },
            { value: 'png', label: 'PNG' },
          ],
        },
      },
    },
  },
};

function setAt(
  values: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const [head, ...rest] = path.split('.');
  if (head === undefined) return values;
  if (rest.length === 0) return { ...values, [head]: value };
  const inner = ((Object.hasOwn(values, head) && values[head]) || {}) as Record<string, unknown>;
  return { ...values, [head]: setAt(inner, rest.join('.'), value) };
}

export function PanelsAndRows() {
  const [opacity, setOpacity] = useState(0.8);
  const [radius, setRadius] = useState(12);
  const [fill, setFill] = useState('#5841b8');
  const [alpha, setAlpha] = useState(1);
  const [stroke, setStroke] = useState('#2ec27e');
  const [count, setCount] = useState(8);
  const [cap, setCap] = useState('round');
  const [side, setSide] = useState('center');
  const [label, setLabel] = useState('Badge');
  const [visible, setVisible] = useState(true);
  const [prefs, setPrefs] = useState<Record<string, unknown>>({});
  const [layers, setLayers] = useState<LayerListItem[]>([
    { id: 'base', label: 'Base coat' },
    { id: 'wash', label: 'Wash' },
  ]);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  return (
    <Section title="Panels & property rows">
      <Cell label="PropertyPanel">
        <PropertyPanel title="Shape">
          <PropertyList>
            <PropertyField
              kind="number"
              control="slider"
              label="Opacity"
              value={opacity}
              min={0}
              max={1}
              step={0.01}
              onChange={setOpacity}
            />
            <PropertyField
              kind="number"
              control="slider"
              label="Radius"
              value={radius}
              min={0}
              max={64}
              unit="px"
              onChange={setRadius}
            />
            <PropertyField
              kind="color"
              label="Fill"
              value={fill}
              onChange={setFill}
              alpha={alpha}
              onAlphaChange={setAlpha}
            />
            <PropertyField kind="color" label="Stroke" value={stroke} onChange={setStroke} />
            <PropertyField
              kind="number"
              label="Count"
              value={count}
              min={0}
              max={100}
              step={1}
              onChange={setCount}
            />
            <PropertyField
              kind="enum"
              label="Line cap"
              value={cap}
              onChange={setCap}
              options={[
                { value: 'butt', label: 'Butt' },
                { value: 'round', label: 'Round' },
              ]}
            />
            <PropertyField
              kind="enum"
              control="toggle"
              label="Align"
              value={side}
              onChange={setSide}
              options={[
                { value: 'left', label: 'L' },
                { value: 'center', label: 'C' },
                { value: 'right', label: 'R' },
              ]}
            />
            <PropertyField kind="string" label="Label" value={label} onChange={setLabel} />
            <PropertyField kind="boolean" label="Visible" value={visible} onChange={setVisible} />
            <PropertyGroup title="Bevel" defaultCollapsed>
              <PropertyField
                kind="number"
                control="slider"
                label="Rings"
                value={32}
                min={4}
                max={96}
                step={1}
                onChange={() => {}}
              />
            </PropertyGroup>
          </PropertyList>
        </PropertyPanel>
      </Cell>
      <Cell label="PrefsForm">
        <PrefsForm
          schema={PREFS}
          values={prefs}
          onChange={(path, value) => setPrefs((prev) => setAt(prev, path, value))}
        />
      </Cell>
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
