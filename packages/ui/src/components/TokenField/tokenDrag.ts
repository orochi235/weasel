import { useMemo, useRef, useState } from 'react';
import { moveItems, movedIndex } from '@weasel-js/headless';
import { useReorderDragList, type ReorderItem } from '../../useReorderDragList';
import { wrapLine } from '../../wrapLine';

/** The rows of a token field: its chips, which are the container's children marked `data-token`. */
export const TOKEN_ROW = '[data-token]';

/**
 * How a token field's chips are dragged: along the lines they wrap onto, read in order. `onMoved` gets the whole
 * list after a drop and the index the dragged token now holds; `onPress` a press on a chip that never dragged.
 */
export function useTokenDrag<T>(
  value: readonly T[],
  onMoved: (next: T[], at: number) => void,
  onPress: (at: number) => void,
) {
  const container = useRef<HTMLElement | null>(null);
  const [line] = useState(() => wrapLine(() => [...(container.current?.querySelectorAll(`:scope > ${TOKEN_ROW}`) ?? [])]));
  const items = useMemo((): ReorderItem[] => value.map((_, i) => ({ id: String(i), label: '' })), [value]);
  const drag = useReorderDragList({
    items,
    selectedIds: [],
    line,
    rowSelector: TOKEN_ROW,
    onReorder: ([id], target) => {
      const from = Number(id);
      onMoved(moveItems(value, [from], target), movedIndex([from], target));
    },
    onPress: (id) => onPress(Number(id)),
  });
  const ref = (el: HTMLElement | null): void => {
    container.current = el;
    drag.containerProps.ref(el);
  };
  return { drag, ref };
}
