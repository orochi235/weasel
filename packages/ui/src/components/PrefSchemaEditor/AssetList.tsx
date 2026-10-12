import type { ReactElement } from 'react';
import { Header, ListBox, ListBoxItem, ListBoxSection } from 'react-aria-components';
import { Icon } from '../../icons';
import { PaneHeader } from './PaneHeader';
import type { Asset } from './workspace';
import s from './AssetList.module.css';

/** The headings the assets are listed under, in order, each over the assets of one kind. */
const GROUPS: ReadonlyArray<{ kind: Asset['kind']; title: string }> = [
  { kind: 'schema', title: 'Dialogs' },
  { kind: 'layout', title: 'Panels' },
];

/** The editor's assets, to pick the one it shows: dialogs, then the panels that point into them. */
export function AssetList({ assets, selected, changed, onSelect }: {
  assets: readonly Asset[];
  selected: string;
  /** The ids of the assets that differ from the baseline. */
  changed: ReadonlySet<string>;
  onSelect(id: string): void;
}): ReactElement {
  return (
    <>
      <PaneHeader title="Assets" />
      <ListBox aria-label="Assets" className={s.list} selectionMode="single" disallowEmptySelection selectedKeys={[selected]}
        onSelectionChange={(keys) => {
          if (keys === 'all') return;
          const [id] = keys;
          if (id !== undefined) onSelect(String(id));
        }}>
        {GROUPS.map(({ kind, title }) => {
          const held = assets.filter((asset) => asset.kind === kind);
          return held.length === 0 ? null : (
            <ListBoxSection key={kind} className={s.group}>
              <Header className={s.heading}>{title}</Header>
              {held.map((asset) => (
                <ListBoxItem key={asset.id} id={asset.id} textValue={asset.label} data-changed={changed.has(asset.id) || undefined}
                  className={({ isSelected }) => (isSelected ? `${s.row} ${s.selected}` : s.row)}>
                  <span className={changed.has(asset.id) ? `${s.label} ${s.changed}` : s.label}>{asset.label}</span>
                  {asset.readOnly && <Icon name="lock" size={16} label="Read-only" className={s.lock} />}
                </ListBoxItem>
              ))}
            </ListBoxSection>
          );
        })}
      </ListBox>
    </>
  );
}
