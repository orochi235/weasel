import type { ReactElement } from 'react';
import { Header, ListBox, ListBoxItem, ListBoxSection } from 'react-aria-components';
import { Icon } from '../../icons';
import { PaneHeader } from './PaneHeader';
import { headingOf, type AssetHeading, type ListedAsset, type ShownAsset } from './workspace';

const NONE: readonly ListedAsset[] = [];
import s from './AssetList.module.css';
import { icon } from '../../icons.gen';

/** The headings the assets are listed under, in order. */
const HEADINGS: readonly AssetHeading[] = ['Dialogs', 'Node properties', 'Panels', 'Toolbars', 'Menus', 'Bundles'];

/** `rows` with the ones `order` names first, as it names them, and the rest after as they stood. */
function inOrder<T extends { id: string }>(rows: readonly T[], order: readonly string[]): T[] {
  const at = (row: T) => { const i = order.indexOf(row.id); return i < 0 ? order.length : i; };
  return [...rows].sort((a, b) => at(a) - at(b));
}

/**
 * The editor's assets, to pick the one it shows: dialogs and node kinds' properties, then the panels, toolbars, and
 * menus that point into them, then the feature bundles.
 * What another editor holds is listed after this one's under the same headings, or where `order` puts it, and a
 * pick of one is the host's.
 */
export function AssetList({ assets, elsewhere = NONE, order, selected, changed, onSelect, onElsewhere }: {
  assets: readonly ShownAsset[];
  elsewhere?: readonly ListedAsset[];
  order?: readonly string[];
  selected: string;
  /** The ids of the assets that differ from the baseline. */
  changed: ReadonlySet<string>;
  onSelect(id: string): void;
  onElsewhere?(id: string): void;
}): ReactElement {
  const listed: Array<ListedAsset & { held: boolean }> = [
    ...assets.map((asset) => ({ id: asset.id, label: asset.label, under: headingOf(asset), readOnly: asset.readOnly, changed: changed.has(asset.id), held: true })),
    ...elsewhere.filter((other) => !assets.some((asset) => asset.id === other.id)).map((other) => ({ ...other, held: false })),
  ];
  const rows = order ? inOrder(listed, order) : listed;
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
                <ListBoxItem key={row.id} id={row.id} textValue={row.label} data-changed={row.changed || undefined}
                  data-rail-mark={row.id === selected ? 'current' : undefined} className={s.row}>
                  <span className={row.changed ? `${s.label} ${s.changed}` : s.label}>{row.label}</span>
                  {row.readOnly && <Icon name={icon('bolt')} size={16} label="Dynamic" className={s.dynamic} />}
                </ListBoxItem>
              ))}
            </ListBoxSection>
          );
        })}
      </ListBox>
    </>
  );
}
