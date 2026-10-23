import { useState, type CSSProperties, type ReactElement } from 'react';
import { Along, type AlongArc } from '@weasel-js/ui/components/Along';
import { PageTabs } from '@weasel-js/ui/components/PageTabs';
import { Tab, TabList, TabPanel, Tabs } from '@weasel-js/ui/components/Tabs';
import { Readouts } from '../../Along/lab/Readouts';
import lab from '../../Along/lab/lab.stories.module.css';
import s from './TabsArc.stories.module.css';

/** The knobs the lab reads. */
export interface TabsArcConfig {
  tabs: number;
  sweep: number;
  inset: number;
  size: number;
  turn: number;
}

export const TABS_ARC_DEFAULTS: TabsArcConfig = { tabs: 4, sweep: 140, inset: 20, size: 320, turn: 0 };

const SECTIONS = ['General', 'Layers', 'Color', 'Export', 'History', 'Fonts', 'Grid', 'About'];

/** The arc over the top of the box and the one under its bottom, `sweep` degrees each, both reading left to right. */
export function tabArcs({ sweep, inset }: Pick<TabsArcConfig, 'sweep' | 'inset'>): { top: AlongArc; bottom: AlongArc } {
  const span = `${sweep}deg` as const;
  return { top: { at: 0, span, inset }, bottom: { at: 180, span, direction: 'ccw', inset } };
}

/**
 * Tabs over the top of a circle with the lit tab's panel inside it, and a page strip along its bottom whose tabs
 * can be pressed, renamed with a double press, dragged or Alt+arrowed into a new order, and added to with +. The box
 * can be turned, so a drag is measured through a rotated ancestor.
 */
export function TabsArcView({ config }: { config: TabsArcConfig }): ReactElement {
  const { tabs, size, turn } = config;
  const { top, bottom } = tabArcs(config);
  const sections = SECTIONS.slice(0, tabs);
  const [section, setSection] = useState<string>(SECTIONS[0]!);
  const [pages, setPages] = useState([{ id: 'p1', name: 'Cover' }, { id: 'p2', name: 'Body' }, { id: 'p3', name: 'Back' }]);
  const [current, setCurrent] = useState('p1');
  const box = { '--box': `${size}px`, transform: turn ? `rotate(${turn}deg)` : undefined } as CSSProperties;
  const move = (id: string, index: number) => setPages((ps) => {
    const next = ps.filter((p) => p.id !== id);
    next.splice(index, 0, ps.find((p) => p.id === id)!);
    return next;
  });
  const add = () => {
    const id = `p${Date.now()}`;
    setPages((ps) => [...ps, { id, name: `Page ${ps.length + 1}` }]);
    setCurrent(id);
  };

  return (
    <div className={lab.lab}>
      <section className={lab.section} aria-label="Tabs">
        <h3 className={lab.sectionTitle}>Tabs along the top</h3>
        <div className={s.box} style={box} data-lab-box="tabs">
          <Along arc={top}>
            <Tabs selectedKey={section} onSelectionChange={(key) => setSection(String(key))}>
              <TabList aria-label="Sections">
                {sections.map((name) => <Tab key={name} id={name}>{name}</Tab>)}
              </TabList>
              {sections.map((name) => <TabPanel key={name} id={name} className={s.panel}>The {name.toLowerCase()} settings.</TabPanel>)}
            </Tabs>
          </Along>
        </div>
      </section>
      <section className={lab.section} aria-label="Page tabs">
        <h3 className={lab.sectionTitle}>Page tabs along the bottom</h3>
        <div className={s.box} style={box} data-lab-box="pages">
          <div className={s.page}>{pages.find((p) => p.id === current)?.name}</div>
          <Along arc={bottom}>
            <PageTabs
              pages={pages}
              current={current}
              onSelect={setCurrent}
              onRename={(id, name) => setPages((ps) => ps.map((p) => (p.id === id ? { ...p, name } : p)))}
              onMove={move}
              onAdd={add}
            />
          </Along>
        </div>
      </section>
      <div className={`${lab.stack} ${lab.side}`}>
        <Readouts
          title="State"
          rows={[
            { id: 'section', label: 'section', value: section },
            { id: 'pages', label: 'pages', value: pages.map((p) => p.name).join(', ') },
          ]}
        />
        <p className={lab.note}>Arrow keys move along the tabs. Drag a page tab, or Alt+arrow it, to reorder; double-press to rename.</p>
      </div>
    </div>
  );
}
