import { memo } from 'react';
import { modeDisplayName } from './modeDisplay';

export const ModeStatusIndicator = memo(function ModeStatusIndicator(props: { modeId: string }) {
  if (props.modeId === 'normal') return null;
  return <span data-testid="mode-status">{modeDisplayName(props.modeId)}</span>;
});
