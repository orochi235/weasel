import { useEffect, type ReactNode, type RefObject } from 'react';
import { Tooltip, TooltipTrigger, type TooltipProps } from '../Tooltip';
import { useRowTip } from './useRowTip';

/** A collection row's tooltip, opened once the highlight rests on it, by pointer or by key: a menu row saying why it
 *  is disabled or what it does, or a disabled tab saying why. `why` undefined is a row with nothing to say. The row is
 *  `el`, or else the element whose id is `rowId`. */
export function RowTip({ rowId, why, el, placement = 'right' }: {
  rowId: string;
  why: ReactNode | undefined;
  el?: RefObject<HTMLElement | null>;
  placement?: TooltipProps['placement'];
}) {
  const rowTip = useRowTip();
  useEffect(() => {
    const at = why === undefined ? null : (el?.current ?? document.getElementById(rowId));
    if (at) rowTip.rest(rowId, at);
    else rowTip.clear();
    // `rowTip` is new every render; keyed on what it shows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowId, why]);
  if (!rowTip.tip || why === undefined || rowTip.tip.id !== rowId) return null;
  return (
    <TooltipTrigger open>
      <Tooltip triggerRef={{ current: rowTip.tip.el }} placement={placement}>{why}</Tooltip>
    </TooltipTrigger>
  );
}
