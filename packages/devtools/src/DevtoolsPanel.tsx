import { useState, type ReactElement } from 'react';
import type { PanelTransport } from '@weasel-js/core/devtools';
import { Tab, TabList, TabPanel, Tabs } from '@weasel-js/ui/components/Tabs';
import { useDevtoolsClient } from './hooks';
import { RootPicker } from './RootPicker';
import type { DevtoolsClient } from './client';
import { DEVTOOLS_TABS, type DevtoolsTab, type DevtoolsTabId } from './tabs';
import s from './DevtoolsPanel.module.css';

export interface DevtoolsPanelProps {
  /** The panel's end of a connection to a page's devtools hook. */
  transport: PanelTransport;
  /** The tabs to show, in the panel's own order. Default: every tab. With one, the tab bar is left out. */
  tabs?: readonly DevtoolsTabId[];
  /** The tab open first. Default: the first shown. */
  defaultTab?: DevtoolsTabId;
  className?: string;
}

/**
 * Reads and steers the canvases of the page `transport` reaches: pick a canvas,
 * then walk its scene, read its state, follow its dispatch trace, or watch its
 * frame stats. It fills its container; give that a size.
 */
export function DevtoolsPanel({ transport, tabs, defaultTab, className }: DevtoolsPanelProps): ReactElement {
  const { client, state } = useDevtoolsClient(transport);
  const shown = tabs ? DEVTOOLS_TABS.filter((t) => tabs.includes(t.id)) : DEVTOOLS_TABS;
  const [tab, setTab] = useState<DevtoolsTabId>(defaultTab ?? shown[0]?.id ?? 'scene');
  const [picked, setPicked] = useState<string | null>(null);
  const rootId = state.roots.some((r) => r.id === picked) ? picked : state.roots[0]?.id ?? null;

  return (
    <section className={[s.panel, className].filter(Boolean).join(' ')} aria-label="Devtools">
      <header className={s.bar}>
        <RootPicker roots={state.roots} value={rootId} onChange={setPicked} />
        <span className={s.status}>{statusText(state.status, state.kitVersion, state.error)}</span>
      </header>
      {rootId && shown.length === 1 ? (
        <div className={s.tabPanel}>{renderView(shown[0]!.View, client, rootId)}</div>
      ) : rootId ? (
        <Tabs className={s.tabs} selectedKey={tab} onSelectionChange={(k) => setTab(k as DevtoolsTabId)}>
          <TabList aria-label="Devtools areas" className={s.tabList}>
            {shown.map((t) => <Tab key={t.id} id={t.id}>{t.label}</Tab>)}
          </TabList>
          {shown.map(({ id, View }) => (
            <TabPanel key={id} id={id} className={s.tabPanel}>
              {renderView(View, client, rootId)}
            </TabPanel>
          ))}
        </Tabs>
      ) : (
        <p className={s.empty}>{state.status === 'connected' ? 'No canvas on this page.' : 'Connecting…'}</p>
      )}
    </section>
  );
}

/** A view keyed by its root, so picking another canvas starts it fresh. */
function renderView(View: DevtoolsTab['View'], client: DevtoolsClient, rootId: string): ReactElement {
  return <View key={rootId} client={client} rootId={rootId} />;
}

function statusText(status: string, kitVersion: string | null, error: string | null): string {
  if (status === 'error') return error ?? 'error';
  if (status === 'connected') return `weasel ${kitVersion ?? ''}`;
  return status;
}
