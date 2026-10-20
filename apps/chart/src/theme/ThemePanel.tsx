import { isShippedTheme } from '@weasel-js/diagram';
import { CloseButton } from '@weasel-js/ui/components/CloseButton';
import { PropertyField, PropertyGroup, PropertyList, PropertyNote, PropertyPanel } from '@weasel-js/ui/components/Properties';
import type { ReactElement } from 'react';
import type { ChartScene } from '../chartDocument';
import { ThemeBox, ThemeColor } from './themeFields';
import { ThemeRoles } from './ThemeRoles';
import { useThemeEdit } from './useThemeEdit';

/** The Format sidebar's Theme panel: every color and the face of the chart's theme. A shipped theme
 *  is copied into the chart at the first edit. */
export function ThemePanel({ scene, onClose }: { scene: ChartScene; onClose: () => void }): ReactElement {
  const edit = useThemeEdit(scene);
  const { theme } = edit;
  return (
    <PropertyPanel title="Theme" actions={<CloseButton ariaLabel="Close theme" onClick={onClose} />}>
      <PropertyList>
        <PropertyNote>
          {isShippedTheme(theme) ? `${theme.name}. The first edit makes a copy kept in this chart.` : theme.name}
        </PropertyNote>
        <ThemeRoles edit={edit} />
        <PropertyGroup title="Connectors">
          <ThemeColor edit={edit} path={['edge', 'stroke']} label="Connector" />
          <ThemeColor edit={edit} path={['label', 'fill']} label="Label" />
        </PropertyGroup>
        <PropertyGroup title="Containers">
          <ThemeBox edit={edit} at={['container']} name="Container" />
        </PropertyGroup>
        <PropertyGroup title="Lanes">
          <ThemeBox edit={edit} at={['lane', 'header']} name="Header" />
          {theme.lane.bodies.map((_, i) => <ThemeBox key={i} edit={edit} at={['lane', 'bodies', i]} name={`Lane ${i + 1}`} />)}
        </PropertyGroup>
        <PropertyGroup title="Page and text">
          <ThemeColor edit={edit} path={['page']} label="Page" />
          <PropertyField kind="font-family" label="Font" value={theme.font.family} onChange={(f) => edit.commit(['font', 'family'], f)} />
          <PropertyField
            kind="number" label="Size" value={theme.font.size} min={4} max={96} step={1}
            onInput={(n) => edit.input(['font', 'size'], n)} onChange={(n) => edit.commit(['font', 'size'], n)}
          />
        </PropertyGroup>
        <PropertyGroup title="Series">
          {theme.series.map((_, i) => <ThemeColor key={i} edit={edit} path={['series', i]} label={`Series ${i + 1}`} />)}
        </PropertyGroup>
      </PropertyList>
    </PropertyPanel>
  );
}
