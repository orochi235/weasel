import { CloseButton } from '../CloseButton';
import type { TreeNode } from '../Tree';
import { icon } from '../../icons.gen';
import { Icon } from '../../icons/Icon';
import type { LayerListItem, LayerListProps } from './layerListProps';
import s from './LayerList.module.css';
import { LockToggle, RowLabel } from './RowParts';

/** Which row, if any, has its rename field open, and how to open or close one. */
export interface Renaming {
  id: string | null;
  set(id: string | null): void;
}

/** The tree `LayerList` draws for `items`: a node per layer, its toggles as the row's controls. */
export function layerNodes(items: readonly LayerListItem[], props: LayerListProps, renaming: Renaming): TreeNode[] {
  const withControls = !!(props.onVisibilityChange || props.onLockChange || props.onRemove);
  const node = (item: LayerListItem): TreeNode => ({
    id: item.id,
    label: (
      <RowLabel
        item={item} props={props} renaming={renaming.id === item.id}
        setRenaming={(on) => renaming.set(on ? item.id : null)}
      />
    ),
    textValue: item.label,
    leading: item.leading,
    trailing: item.nonPrinting || item.fixed ? <Marks item={item} /> : undefined,
    controls: withControls ? <Controls item={item} props={props} /> : undefined,
    muted: item.nonPrinting,
    immovable: item.fixed || item.locked,
    selectsAlone: item.fixed,
    ...(item.children?.length ? { children: item.children.map(node) } : {}),
  });
  return items.map(node);
}

/** What the row says of itself after its label: left out of export, or fixed in place. */
function Marks({ item }: { item: LayerListItem }) {
  return (
    <>
      {item.nonPrinting && <span className={s.nonPrintingMark}>Not printed</span>}
      {item.fixed && (
        <span className={s.lock} role="img" aria-label="Locked">
          <Icon name={icon('lock')} size={12} />
        </span>
      )}
    </>
  );
}

/** A row's toggles. A column the list has but this row lacks holds its width, so the columns line up. */
function Controls({ item, props }: { item: LayerListItem; props: LayerListProps }) {
  const { onVisibilityChange, onRemove } = props;
  return (
    <>
      {onVisibilityChange &&
        (item.fixed || item.hideable === false ? (
          <span className={s.check} />
        ) : (
          <input
            className={s.check}
            type="checkbox"
            checked={item.visible !== false}
            onChange={(e) => onVisibilityChange(item.id, e.target.checked)}
            aria-label={`Show ${item.label}`}
          />
        ))}
      <LockToggle item={item} props={props} />
      {onRemove && !item.fixed && !item.locked && item.removable !== false && (
        <CloseButton aria-label={`Remove ${item.label}`} onClick={() => onRemove(item.id)} />
      )}
    </>
  );
}
