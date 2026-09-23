import { memo } from 'react';
import { modeLabel, type ModeDefinition } from '@weasel-js/modes';

export const ModeStatusIndicator = memo(function ModeStatusIndicator(props: { mode: ModeDefinition }) {
  if (props.mode.id === 'normal') return null;
  return <span data-testid="mode-status">{modeLabel(props.mode)}</span>;
});
