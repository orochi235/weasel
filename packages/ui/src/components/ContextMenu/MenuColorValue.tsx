import { useSyncExternalStore, type RefObject } from 'react';
import { Dialog as RACDialog } from 'react-aria-components';
import type { MenuColorEntry, MenuController } from '@weasel-js/menu';
import { ColorField } from '../ColorField';
import { Popover } from '../Popover';
import { Swatch } from '../Properties/PropertyReadout';
import listbox from '../listbox.module.css';
import { useOverlayPortal } from '../../overlays/portalHost';
import { useMenuPart } from './menuParts';
import s from './ContextMenu.module.css';

/** True for a color row the menu can edit: one with a `set`, not disabled. */
export const editsColor = (e: MenuColorEntry): boolean => e.set !== undefined && !e.disabled;

/** A color row's swatch and hex, or a dash for none. While `picking`, the kit's color field sits in a popover
 *  beside the row, and each color it commits is written through the controller; the menu stays open. */
export function MenuColorValue({ entry: e, controller: c, row, picking, onPicked }: {
  entry: MenuColorEntry; controller: MenuController;
  /** The row the popover sits beside. */
  row: RefObject<HTMLElement | null>;
  picking: boolean;
  onPicked(): void;
}) {
  const value = useSyncExternalStore(c.subscribe, () => c.colorValue(e), () => c.colorValue(e));
  const register = useMenuPart();
  const { anchor, provide, ready } = useOverlayPortal();
  return (
    <span className={s.value}>
      {value === undefined ? <span className={s.unit}>—</span> : <><Swatch color={value} />{value}</>}
      {anchor}
      {ready && picking && editsColor(e) && provide(
        <Popover
          ref={(el) => register(e.key, el)}
          triggerRef={row}
          isOpen
          isNonModal
          onOpenChange={(open) => { if (!open) onPicked(); }}
          placement="end top"
          className={listbox.surface}
          data-weasel-overlay=""
        >
          <RACDialog className={s.picker} aria-label={`${e.label} color`}>
            <ColorField
              value={value}
              alpha={e.alpha}
              aria-label={e.label}
              onChange={(hex) => c.setColor(e, hex)}
            />
          </RACDialog>
        </Popover>,
      )}
    </span>
  );
}
