import {
  DIAGRAM_ROLES, diagramStyleOf, setDiagramColor, setDiagramStyle, type DiagramStyleState, type DiagramTheme, type StyleField,
} from '@weasel-js/diagram';
import { PropertyField, PropertyList, PropertyNote, PropertyPanel, type PropertyOption } from '@weasel-js/ui/components/Properties';
import type { CSSProperties, ReactElement } from 'react';
import type { ChartScene } from '../chartDocument';
import './stylePanel.css';

interface Styled { id: string; state: DiagramStyleState; data: Record<string, unknown> }

const HEX = /^#[0-9a-f]{6}$/i;
const colorIn = (paint: unknown): string | undefined => {
  const color = (paint as { paint?: { color?: unknown } } | undefined)?.paint?.color;
  return typeof color === 'string' && HEX.test(color) ? color : undefined;
};

/** The color `field` shows on one shape or connector: a fill or stroke, or its first text's. */
function colorOf(scene: ChartScene, s: Styled, field: StyleField): string | undefined {
  if (field !== 'text') return colorIn(s.data[field]);
  const text = s.state.kind === 'shape'
    ? scene.childrenOf(s.id as never).map((id) => scene.get(id)).find((n) => typeof (n?.data as { text?: unknown })?.text === 'string')
    : scene.get(`${s.id}/label` as never);
  return colorIn((text?.data as { fill?: unknown } | undefined)?.fill);
}

/** One value when every item agrees, else `mixed`. */
function common<T>(values: readonly T[]): { value: T | undefined; mixed: boolean } {
  const first = values[0];
  return values.every((v) => v === first) ? { value: first, mixed: false } : { value: undefined, mixed: true };
}

function swatch(theme: DiagramTheme, role: string): ReactElement {
  const style = theme.roles[role]!;
  // Each theme's own colors: they are data, so no stylesheet can name them.
  const vars = { '--wc-swatch-fill': style.fill, '--wc-swatch-stroke': style.stroke } as CSSProperties;
  return <span className="wc-swatch" style={vars} aria-hidden />;
}

/** The Format sidebar's Style panel: the selected shapes' and connectors' theme role, as swatches, and
 *  the colors that can be set on them by hand, which a theme change then leaves. */
export function StylePanel({ scene, selected, theme }: { scene: ChartScene; selected: readonly string[]; theme: DiagramTheme }): ReactElement {
  const styled: Styled[] = selected.flatMap((id) => {
    const node = scene.get(id as never);
    const state = node === undefined ? null : diagramStyleOf(node);
    return state === null ? [] : [{ id, state, data: node!.data as Record<string, unknown> }];
  });
  const ids = styled.map((s) => s.id);
  const roles: PropertyOption<string>[] = DIAGRAM_ROLES.filter((r) => theme.roles[r.id] !== undefined)
    .map((r) => ({ value: r.id, label: r.label, glyph: swatch(theme, r.id) }));
  const role = common(styled.map((s) => s.state.role ?? theme.defaultRole));
  const field = (name: StyleField, label: string, among: readonly Styled[]) => {
    const color = common(among.map((s) => colorOf(scene, s, name)));
    return (
      <PropertyField
        kind="color" label={label} value={color.value} mixed={color.mixed} disabled={among.length === 0}
        onChange={(next) => setDiagramColor(scene, among.map((s) => s.id), name, next)} onInput={() => {}}
      />
    );
  };
  return (
    <PropertyPanel title="Style">
      <PropertyList>
        {styled.length === 0 ? <PropertyNote>Select shapes or connectors to style them.</PropertyNote> : (
          <>
            <PropertyField
              kind="enum" control="toggle" label="Role" options={roles} value={role.value} mixed={role.mixed}
              onChange={(next) => setDiagramStyle(scene, ids, next, { theme })}
            />
            {field('fill', 'Fill', styled.filter((s) => s.state.kind === 'shape'))}
            {field('stroke', 'Stroke', styled)}
            {field('text', 'Text', styled)}
          </>
        )}
      </PropertyList>
    </PropertyPanel>
  );
}
