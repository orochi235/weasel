import type { ReactElement } from 'react';
import { measureRowList, type HeadlessComponent, type RowListFace, type RowListLayout } from '@weasel-js/headless';
import { nodeText } from '../../nodeText';
import type { DomTarget } from '../../domMeasureEnv';
import { ItemList, type ItemListProps, type ItemListRow } from './ItemList';

/** An {@link ItemList} as the shared measure reads it. */
export interface DomItemListState {
  readonly props: ItemListProps;
  /** The width of a row's `leading` or `trailing` content, which measuring cannot read off a React node. Absent,
   *  such content is measured as 0 wide. */
  slotWidth?(row: ItemListRow, slot: 'leading' | 'trailing'): number;
}

/** What `state`'s list shows, as `measureRowList` reads it: each row's label by its text content. Once any row has
 *  trailing content every row gets a trailing cell, an empty one 0 wide, as `ItemList` draws its grid. */
export function itemListFaceOf(state: DomItemListState): RowListFace {
  const trailingColumn = state.props.rows.some((r) => r.trailing != null);
  const width = (r: ItemListRow, slot: 'leading' | 'trailing') =>
    (r[slot] == null ? (slot === 'trailing' && trailingColumn ? 0 : undefined) : state.slotWidth?.(r, slot) ?? 0);
  return {
    rows: state.props.rows.map((r) => ({
      id: r.id, label: nodeText(r.label), leadingWidth: width(r, 'leading'), trailingWidth: width(r, 'trailing'),
    })),
    ...(state.props.empty !== undefined ? { empty: nodeText(state.props.empty) } : {}),
  };
}

/**
 * {@link ItemList} on the measure/draw contract a HUD list implements too: `measure` is `@weasel-js/headless`'s
 * `measureRowList` (pass `domMeasureEnv(el)`, and the column's width as both width bounds, since the list fills its
 * column), and `draw` renders the list, its rows laid out by `ItemList.module.css` from the same tokens.
 */
export const domItemList: HeadlessComponent<DomItemListState, RowListLayout, DomTarget<HTMLDivElement>, ReactElement> = {
  measure: (state, c, env) => measureRowList(itemListFaceOf(state), c, env),
  draw: (state, target) => <ItemList ref={target.ref} {...state.props} />,
};
