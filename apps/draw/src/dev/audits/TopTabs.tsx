import { Tab, TabList, TabPanel, Tabs } from '@weasel-js/ui/components/Tabs';
import { NextUp } from './NextUp';
import { RoundsChart } from './RoundsChart';
import { useViewerPref } from './viewerPref';
import type { AuditArea, AuditRound } from './skulkMap.types';
import s from './TopTabs.module.css';

type TopTab = 'rounds' | 'next';

const TABS: readonly { id: TopTab; label: string }[] = [{ id: 'rounds', label: 'Rounds' }, { id: 'next', label: 'Next up' }];

/** The rounds chart and the queue, a tab each beside the run lanes; the viewer's choice is kept. */
export function TopTabs({ rounds, area, next, onPick, onLight }: {
  rounds: readonly AuditRound[]; area?: AuditArea | null; next: readonly AuditArea[]; onPick: (id: string) => void;
  onLight: (id: string | null) => void;
}) {
  const [tab, setTab, keep] = useViewerPref<TopTab>('topTab', 'rounds', (v) => (v === 'next' ? 'next' : v === 'rounds' ? 'rounds' : undefined));
  return (
    <Tabs className={s.tabs} selectedKey={tab} onSelectionChange={(key) => { setTab(key as TopTab); keep(key as TopTab); }}>
      <TabList aria-label="Rounds and queue" items={TABS}>
        {(t) => <Tab id={t.id}>{t.label}</Tab>}
      </TabList>
      <TabPanel id="rounds" className={s.panel}><RoundsChart rounds={rounds} area={area} /></TabPanel>
      <TabPanel id="next" className={s.panel}><NextUp areas={next} onPick={onPick} onLight={onLight} /></TabPanel>
    </Tabs>
  );
}
