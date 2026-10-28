import { useState, type ReactElement } from 'react';
import { Header, ListBox, ListBoxItem, ListBoxSection, Text } from 'react-aria-components';
import type { IconRef } from '@weasel-js/icons';
import { Icon } from '../../icons';
import { Badge } from '../Badge';
import { PaneHeader } from './PaneHeader';
import { headingOf, type AssetHeading, type ListedAsset, type ShownAsset } from './workspace';

const NONE: readonly ListedAsset[] = [];
import s from './AssetList.module.css';
import { icon } from '../../icons.gen';

/** The headings the assets are listed under, in order. */
const HEADINGS: readonly AssetHeading[] = ['Dialogs', 'Node properties', 'Panels', 'Toolbars', 'Menus', 'Bundles'];

const HEADING_ICON: Record<AssetHeading, IconRef> = {
  Dialogs: icon('formPage'),
  'Node properties': icon('core:tune'),
  Panels: icon('formPanel'),
  Toolbars: icon('formBar'),
  Menus: icon('menu'),
  Bundles: icon('cloudCube'),
};

/** What each heading's assets are called, one at a time, and the class that colors their badge. */
const HEADING_BADGE: Record<AssetHeading, { word: string; tint: string | undefined }> = {
  Dialogs: { word: 'dialog', tint: s.dialog },
  'Node properties': { word: 'properties', tint: s.properties },
  Panels: { word: 'panel', tint: s.panel },
  Toolbars: { word: 'toolbar', tint: s.toolbar },
  Menus: { word: 'menu', tint: s.menu },
  Bundles: { word: 'bundle', tint: s.bundle },
};

/** `rows` with the ones `order` names first, as it names them, and the rest after as they stood. */
function inOrder<T extends { id: string }>(rows: readonly T[], order: readonly string[]): T[] {
  const at = (row: T) => { const i = order.indexOf(row.id); return i < 0 ? order.length : i; };
  return [...rows].sort((a, b) => at(a) - at(b));
}

const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** `rows` sorted by label. */
function byLabel<T extends { label: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => byName.compare(a.label, b.label));
}

/**
 * The editor's assets, to pick the one it shows: dialogs and node kinds' properties, then the panels, toolbars, and
 * menus that point into them, then the feature bundles.
 * Each heading's assets are sorted by name, this editor's and another's alike, unless `order` puts them otherwise;
 * a pick of another editor's is the host's. Each heading folds its assets away, and unfolds again when the one
 * shown moves under it.
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
  const rows = order ? inOrder(listed, order) : byLabel(listed);
  const headingOfSelected = rows.find((row) => row.id === selected)?.under;
  const [folded, setFolded] = useState<ReadonlySet<AssetHeading>>(new Set());
  const [lastSelected, setLastSelected] = useState(selected);
  if (selected !== lastSelected) {
    setLastSelected(selected);
    if (headingOfSelected !== undefined && folded.has(headingOfSelected)) setFolded(new Set([...folded].filter((h) => h !== headingOfSelected)));
  }
  const fold = (title: AssetHeading): void =>
    setFolded(folded.has(title) ? new Set([...folded].filter((h) => h !== title)) : new Set([...folded, title]));
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
          const open = !folded.has(title);
          return held.length === 0 ? null : (
            <ListBoxSection key={title} className={open ? `${s.group} ${s.open}` : s.group}>
              <Header className={s.heading}>
                <button type="button" className={s.fold} aria-expanded={open} onClick={() => fold(title)}>
                  <Icon name={HEADING_ICON[title]} size={16} className={s.headingIcon} />
                  <span>{title}</span>
                </button>
              </Header>
              {open && held.map((row) => (
                <ListBoxItem key={row.id} id={row.id} textValue={row.label} data-changed={row.changed || undefined}
                  data-rail-mark={row.id === selected ? 'current' : undefined} className={s.row}>
                  <Text slot="label" className={row.changed ? `${s.label} ${s.changed}` : s.label}>{row.label}</Text>
                  <Badge size="xs" variant="subtle" tint={{ ref: '--_heading' }} className={`${s.badge} ${HEADING_BADGE[title].tint}`}>{HEADING_BADGE[title].word}</Badge>
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
