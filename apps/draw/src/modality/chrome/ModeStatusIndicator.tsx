// apps/draw/src/modality/chrome/ModeStatusIndicator.tsx
import { memo } from 'react';

const DISPLAY: Record<string, string> = {
  'path-edit': 'Path Edit',
  'isolation': 'Isolation',
  'text-edit': 'Text Edit',
  'free-transform': 'Free Transform',
  'crop': 'Crop',
};

export const ModeStatusIndicator = memo(function ModeStatusIndicator(props: { modeId: string }) {
  if (props.modeId === 'normal') return null;
  const name = DISPLAY[props.modeId] ?? props.modeId;
  return <span data-testid="mode-status">{name}</span>;
});
