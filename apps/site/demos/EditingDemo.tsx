import { pathNode, SceneCanvas, useScene, WeaselProvider } from '@weasel-js/core';
import { solid } from '@weasel-js/paint';
import { KIT_TOOL_IDS, useSelection } from '@weasel-js/editing';
import * as groups from '@weasel-js/editing/groups';
import * as presets from '@weasel-js/editing/presets';
import { ActionBar } from '@weasel-js/ui/components/ActionBar';
import { ToolPalette } from '@weasel-js/ui/components/ToolPalette';
import { DemoStage } from './DemoStage';
import s from './EditingDemo.module.css';

const W = 560, H = 320;

const SHAPES = [
  pathNode('a', 'M60 70 H200 V190 H60 Z', { fill: { paint: solid('#7fb069') } }),
  pathNode('b', 'M150 120 C150 60 290 60 290 120 C290 180 150 180 150 120 Z', { fill: { paint: solid('#d4a574') } }),
  pathNode('c', 'M400 60 L480 230 H320 Z', { fill: { paint: solid('#a48bd4') } }),
];

/** What each preset `presets.draw` includes adds, by its id. */
const PARTS: Record<string, string> = {
  view: 'pans and zooms the view: the hand tool, a middle-button drag, and a pinch.',
  select: 'click, marquee, or lasso to select; a double-click enters a group.',
  outline: 'draws the selection\'s outline.',
  resize: 'handles on the selection\'s box that resize it.',
  rotate: 'the handle that turns it.',
  move: 'drag a selected shape to move it.',
  edit: 'Escape, select all, delete, duplicate, group, nudge, style, the clipboard, and the context menu.',
  arrange: 'align, distribute, flip, and reorder the selection.',
  pathfinder: 'union, subtract, intersect, exclude, divide, crop, trim, and merge the selected shapes.',
  ingest: 'paste or drop images, SVG, and copied shapes onto the canvas.',
  'toolkit:select': 'offers the select and lasso tools.',
  'toolkit:shape': 'offers the rect, ellipse, line, polygon, and star tools.',
};

export function EditingDemo() {
  const scene = useScene({ systemLayers: [{ id: 'default' }], initial: SHAPES });
  const selection = useSelection({ scene, mode: 'multiple' });
  return (
    <WeaselProvider>
      <div className={s.demo}>
        <div className="ckd-toolbar">
          <ToolPalette orientation="horizontal" />
          <ActionBar group="history" />
          <ActionBar group={groups.edit} />
          <ActionBar group={groups.pathfinder} />
        </div>
        <DemoStage width={W} height={H}>
          <SceneCanvas
            className="ckd-canvas"
            backgroundFill={{ color: '#ffffff' }}
            scene={scene}
            selection={selection}
            features={[presets.draw]}
            defaultTools={KIT_TOOL_IDS}
          />
        </DemoStage>
        <dl className={s.parts}>
          {presets.draw.includes?.map((p) => (
            <div key={p.id} className={s.part}>
              <dt>{p.label}</dt>
              <dd>{PARTS[p.id]}</dd>
            </div>
          ))}
        </dl>
      </div>
    </WeaselProvider>
  );
}
