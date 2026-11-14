import { useEffect } from 'react';
import { Tooltip, TooltipTrigger } from '../Tooltip';
import { useRowTip } from '../Tree/useRowTip';

/** The highlighted row's tooltip saying why it is disabled, or else what it does, opened once the highlight rests
 *  on it, by pointer or by key. `why` undefined is a row with nothing to say. */
export function MenuRowTip({ rowId, why }: { rowId: string; why: string | undefined }) {
  const rowTip = useRowTip();
  useEffect(() => {
    const el = why === undefined ? null : document.getElementById(rowId);
    if (el) rowTip.rest(rowId, el);
    else rowTip.clear();
    // `rowTip` is new every render; keyed on what it shows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowId, why]);
  if (!rowTip.tip || why === undefined || rowTip.tip.id !== rowId) return null;
  return (
    <TooltipTrigger isOpen>
      <Tooltip triggerRef={{ current: rowTip.tip.el }} placement="right">{why}</Tooltip>
    </TooltipTrigger>
  );
}
