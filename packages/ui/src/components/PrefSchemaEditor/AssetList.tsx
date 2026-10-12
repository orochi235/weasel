import type { ReactElement } from 'react';
import { Header, ListBox, ListBoxItem, ListBoxSection } from 'react-aria-components';
import { Icon } from '../../icons';
import { PaneHeader } from './PaneHeader';
import { headingOf, type Asset, type AssetHeading, type ListedAsset } from './workspace';

const NONE: readonly ListedAsset[] = [];
import s from './AssetList.module.css';

/** The headings the assets are listed under, in order. */
const HEADINGS: readonly AssetHeading[] = ['Dialogs', 'Panels', 'Toolbars'];

/**
 * The editor's assets, to pick the one it shows: dialogs, then the panels and the toolbars that point into them.
 * What another editor holds is listed after this one's under the same headings, and a pick of one is the host's.
 */
export function AssetList({ assets, elsewhere = NONE, selected, changed, onSelect, onElsewhere }: {
  assets: readonly Asset[];
  elsewhere?: readonly ListedAsset[];
  selected: string;
  /** The ids of the assets that differ from the baseline. */
  changed: ReadonlySet<string>;
  onSelect(id: string): void;
  onElsewhere?(id: string): void;
}): ReactElement {
  const rows: Array<ListedAsset & { held: boolean }> = [
    ...assets.map((asset) => ({ id: asset.id, label: asset.label, under: headingOf(asset), readOnly: asset.readOnly, held: true })),
    ...elsewhere.filter((other) => !assets.some((asset) => asset.id === other.id)).map((other) => ({ ...other, held: false })),
  ];
  return (
    <>
      <PaneHeader title="Assets" />
      <ListBox aria-label="Assets" className={s.list} selectionMode="single" disallowEmptySelection selectedKeys={[selected]}
        onSelectionChange={(keys) => {
          if (keys === 'all') return;
          const [id] = keys;
          if (id === undefined) return;
          if (rows.find((row) => row.id === id)?.held) onSelect(String(id));
          else onElsewhere?.(String(id));
        }}>
        {HEADINGS.map((title) => {
          const held = rows.filter((row) => row.under === title);
          return held.length === 0 ? null : (
            <ListBoxSection key={title} className={s.group}>
              <Header className={s.heading}>{title}</Header>
              {held.map((row) => (
                <ListBoxItem key={row.id} id={row.id} textValue={row.label} data-changed={changed.has(row.id) || undefined}
                  className={({ isSelected }) => (isSelected ? `${s.row} ${s.selected}` : s.row)}>
                  <span className={changed.has(row.id) ? `${s.label} ${s.changed}` : s.label}>{row.label}</span>
                  {row.readOnly && <Icon name="lock" size={16} label="Read-only" className={s.lock} />}
                </ListBoxItem>
              ))}
            </ListBoxSection>
          );
        })}
      </ListBox>
    </>
  );
}
