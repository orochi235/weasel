import { useMemo, useState, type ReactElement } from 'react';
import type { Action } from '@weasel-js/core';
import { f, meta, story } from '@weasel-js/forge';
import type { PrefGroup, PrefLeaf, PrefOrder } from '@weasel-js/prefs';
import { Bar } from '@weasel-js/ui/components/Bar';
import { resolveLayout, ToolbarDock, type DockBar, type DockEdge, type DockSpec, type ToolbarLayout } from '@weasel-js/ui/components/ToolbarDock';
import { actionLeaf, LAB_ACTIONS, LabActions } from '../../Along/lab/labActions';
import lab from '../../Along/lab/lab.stories.module.css';
import s from './ToolbarDock.stories.module.css';

/** Toolbars in docks round a workspace: drag a handle, Alt+arrows, Alt+Enter, and the layout that settles, read back. */
export default meta({ title: 'ui/ToolbarDock', layout: 'fullscreen', tags: ['lab'] });

interface DockLabConfig {
  dock: { movable: boolean; top: boolean; left: boolean; right: boolean; bottom: boolean };
}

const EDGES: readonly DockEdge[] = ['top', 'left', 'right', 'bottom'];
const ARRANGE = LAB_ACTIONS.filter((a) => ['front', 'back', 'group', 'ungroup'].includes(a.key));

const number = (name: string, value: number): PrefLeaf => ({ kind: 'number', name, description: '', default: value, min: 0, max: 99 }) as PrefLeaf;
const TEXT: PrefGroup = { name: 'Text', children: { size: number('Size', 12), leading: number('Leading', 16) } };
const TOOLS: PrefGroup = { name: 'Tools', children: Object.fromEntries(['undo', 'redo', 'flipX', 'flipY'].map((k) => [k, actionLeaf(k)])) };
const VIEW: PrefGroup = { name: 'View', children: Object.fromEntries(['copy', 'paste'].map((k) => [k, actionLeaf(k)])) };
const ARRANGE_BAR: PrefGroup = {
  name: 'Arrange',
  children: { run: { kind: 'actions', name: 'Arrange', description: '', default: undefined, group: 'dock-lab.arrange' } as PrefLeaf },
};

/** The actions the Arrange bar's run draws: the lab's arrange actions, in a group of their own. */
const RUN: Action[] = ARRANGE.map((a) => ({ id: `dock-lab.${a.key}`, label: a.name, icon: a.glyph, group: 'dock-lab.arrange', invoker: { timing: 'immediate', run: () => {} } }));

function DockLab({ config }: { config: DockLabConfig }): ReactElement {
  const { movable } = config.dock;
  const edges = EDGES.filter((e) => config.dock[e]).join(' ');
  const docks = useMemo<DockSpec[]>(() => (edges ? edges.split(' ') : []).map((edge) => ({ id: edge, edge: edge as DockEdge })), [edges]);
  const [layout, setLayout] = useState<ToolbarLayout>();
  const [values, setValues] = useState<Record<string, unknown>>({ size: 12, leading: 16 });
  const [order, setOrder] = useState<PrefOrder>();

  const bars = useMemo<DockBar[]>(() => {
    const onChange = (path: string, value: unknown) => setValues((prev) => ({ ...prev, [path]: value }));
    return [
      { id: 'text', label: 'Text', docks: ['top', 'bottom', 'left'], render: (o) => <Bar label="Text" lead="label" schema={TEXT} values={values} onChange={onChange} orientation={o} /> },
      { id: 'tools', label: 'Tools', docks: ['left', 'top', 'right', 'bottom'], vertical: true, render: (o) => <Bar label="Tools" lead="label" schema={TOOLS} orientation={o} /> },
      { id: 'view', label: 'View', docks: ['right', 'top', 'left', 'bottom'], vertical: true, float: true, render: (o) => <Bar label="View" lead="label" schema={VIEW} orientation={o} /> },
      {
        id: 'arrange',
        label: 'Arrange',
        docks: ['top', 'bottom', 'left', 'right'],
        vertical: true,
        render: (o) => <Bar label="Arrange" lead="label" schema={ARRANGE_BAR} order={order} onReorder={setOrder} orientation={o} />,
      },
    ];
  }, [values, order]);

  return (
    <LabActions extra={RUN}>
      <div className={lab.lab}>
        <div className={`${lab.stack} ${lab.main}`}>
          <div className={s.frame}>
            <ToolbarDock docks={docks} bars={bars} layout={layout} onLayoutChange={setLayout} movable={movable}>
              <div className={s.workspace}>Workspace</div>
            </ToolbarDock>
          </div>
          <p className={lab.note}>
            Text may not run vertical, so the left and right docks refuse it. View may float: drag it off its dock, or
            Alt+Enter on its handle. Cmd-drag a button in Arrange to reorder its run.
          </p>
        </div>
        <section className={`${lab.section} ${lab.side}`} aria-label="Layout">
          <h3 className={lab.sectionTitle}>Layout</h3>
          <pre className={s.readout}>{JSON.stringify(resolveLayout(docks, bars, layout), null, 2)}</pre>
        </section>
      </div>
    </LabActions>
  );
}

export const Lab = story({
  config: f.schema({
    dock: f.group({
      movable: f.boolean(true).label('Movable'),
      top: f.boolean(true).label('Top dock'),
      left: f.boolean(true).label('Left dock'),
      right: f.boolean(true).label('Right dock'),
      bottom: f.boolean(false).label('Bottom dock'),
    }).label('Dock'),
  }),
  render: ({ config }) => <DockLab config={config as DockLabConfig} />,
});
