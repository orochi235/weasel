import { IMAGE_STAGE_TYPES, type EffectStageType } from '@weasel-js/diagram/effect';
import { AUDIO_STAGE_TYPES } from '@weasel-js/diagram/effect-audio';
import { ItemList } from '@weasel-js/ui/components/ItemList';
import { SidebarPanel } from '@weasel-js/ui/components/SidebarPanel';
import { ToggleBar } from '@weasel-js/ui/components/ToggleBar';
import { useState, type ReactElement } from 'react';

export interface StagePaletteProps {
  /** Adds a stage of the activated type. */
  onAdd: (type: EffectStageType) => void;
}

type Domain = 'image' | 'audio';

const DOMAINS = [
  { value: 'image', label: 'Image' },
  { value: 'audio', label: 'Audio' },
] as const;

const TYPES: Record<Domain, readonly EffectStageType[]> = { image: IMAGE_STAGE_TYPES, audio: AUDIO_STAGE_TYPES };

/** The stage palette: activating a row adds a stage of that type to the pipeline. */
export function StagePalette({ onAdd }: StagePaletteProps): ReactElement {
  const [domain, setDomain] = useState<Domain>('image');
  const types = TYPES[domain];
  return (
    <SidebarPanel title="Stages">
      <ToggleBar
        items={DOMAINS}
        value={domain}
        onChange={(v) => { if (v) setDomain(v); }}
        ariaLabel="Stage set"
        size="sm"
      />
      <ItemList
        rows={types.map((t) => ({ id: t.type, label: t.title }))}
        onActivate={(id) => {
          const type = types.find((t) => t.type === id);
          if (type) onAdd(type);
        }}
        containerProps={{ 'aria-label': 'Stages' }}
      />
    </SidebarPanel>
  );
}
