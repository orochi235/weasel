/** One registry entry in full: a tool, an action, or a dep. */
import type { ReactElement, ReactNode } from 'react';
import type { DevtoolsActionEntry, DevtoolsDepEntry, DevtoolsRegistry, DevtoolsToolEntry } from '@weasel-js/core/devtools-protocol';
import { Code } from '@weasel-js/ui/components/Code';
import { DetailList, DetailRow } from '@weasel-js/ui/components/DetailList';
import { Bindings } from './Bindings';
import { ValueView } from './ValueView';
import s from './RegistryView.module.css';

export interface RegistryPick {
  category: 'tools' | 'actions' | 'deps';
  id: string;
}

const yesNo = (v: boolean): string => (v ? 'yes' : 'no');
const codes = (ids: readonly string[]): ReactNode =>
  ids.length ? <span className={s.codes}>{ids.map((id) => <Code key={id} size="sm">{id}</Code>)}</span> : null;

function ToolDetail({ tool }: { tool: DevtoolsToolEntry }): ReactElement {
  return (
    <section className={s.detail} aria-label={`Tool ${tool.id}`}>
      <h3 className={s.title}><Code size="sm">{tool.id}</Code></h3>
      <DetailList layout="inline">
        <DetailRow label="Slot">{tool.slot}</DetailRow>
        <DetailRow label="Label">{tool.label}</DetailRow>
        <DetailRow label="Group">{tool.group}</DetailRow>
        <DetailRow label="Icon">{tool.icon}</DetailRow>
        <DetailRow label="Shortcut">{tool.shortcut}</DetailRow>
        <DetailRow label="Hotkey">{tool.hotkey}</DetailRow>
        <DetailRow label="Hidden">{yesNo(tool.hidden)}</DetailRow>
        <DetailRow label="Overlay">{yesNo(tool.hasOverlay)}</DetailRow>
        <DetailRow label="Actions">{codes(tool.actions)}</DetailRow>
        <DetailRow label="Deps">{codes(tool.deps)}</DetailRow>
      </DetailList>
      <Bindings bindings={tool.bindings} />
      <h3 className={s.heading}>Cursor</h3>
      <ValueView value={tool.cursor} label="Cursor" />
      <h3 className={s.heading}>Eligibility</h3>
      <ValueView value={tool.eligibility} label="Eligibility" />
    </section>
  );
}

function ActionDetail({ action }: { action: DevtoolsActionEntry }): ReactElement {
  return (
    <section className={s.detail} aria-label={`Action ${action.id}`}>
      <h3 className={s.title}><Code size="sm">{action.id}</Code></h3>
      <DetailList layout="inline">
        <DetailRow label="Label">{action.label}</DetailRow>
        <DetailRow label="Enabled" status={action.enabled === true ? 'success' : 'warn'}>
          {action.enabled === true ? 'yes' : action.enabled}
        </DetailRow>
        <DetailRow label="Active">{action.active === null ? 'no pressed state' : yesNo(action.active)}</DetailRow>
        <DetailRow label="Scope">{action.scope}</DetailRow>
        <DetailRow label="Invoker">{action.invoker}</DetailRow>
        <DetailRow label="Group">{action.group}</DetailRow>
        <DetailRow label="Tags">{codes(action.tags)}</DetailRow>
        <DetailRow label="Shortcut">{action.shortcut}</DetailRow>
        <DetailRow label="Requires">{codes(action.requires)}</DetailRow>
        <DetailRow label="Preview">{yesNo(action.hasPreview)}</DetailRow>
        <DetailRow label="Variants">{codes(action.variants.map((v) => v.key))}</DetailRow>
      </DetailList>
      <Bindings bindings={action.bindings} />
      <h3 className={s.heading}>Eligible</h3>
      {action.eligible === null ? <p className={s.note}>Always.</p> : <ValueView value={action.eligible} label="Eligible" />}
    </section>
  );
}

function DepDetail({ dep, users }: { dep: DevtoolsDepEntry; users: string[] }): ReactElement {
  return (
    <section className={s.detail} aria-label={`Dep ${dep.name}`}>
      <h3 className={s.title}><Code size="sm">{dep.name}</Code></h3>
      <DetailList layout="inline">
        <DetailRow label="Scope" values="figures">{dep.depth === 0 ? 'this canvas' : `${dep.depth} above`}</DetailRow>
        <DetailRow label="Stacked" values="figures">{dep.stacked}</DetailRow>
        <DetailRow label="Required by">{codes(users)}</DetailRow>
      </DetailList>
    </section>
  );
}

export function RegistryEntryDetail({ registry, pick }: { registry: DevtoolsRegistry; pick: RegistryPick }): ReactElement {
  if (pick.category === 'tools') {
    const tool = registry.tools.find((t) => t.id === pick.id);
    if (tool) return <ToolDetail tool={tool} />;
  } else if (pick.category === 'actions') {
    const action = registry.actions.find((a) => a.id === pick.id);
    if (action) return <ActionDetail action={action} />;
  } else {
    const dep = registry.deps.find((d) => d.name === pick.id);
    const users = registry.actions.filter((a) => a.requires.includes(pick.id)).map((a) => a.id);
    if (dep) return <DepDetail dep={dep} users={users} />;
  }
  return <p className={s.note}>{pick.id} is no longer registered.</p>;
}
