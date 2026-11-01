import { useState } from 'react';
import { imeKey } from '@weasel-js/ui-logic';
import { Button } from '@weasel-js/ui/components/Button';
import { Input } from '@weasel-js/ui/components/Input';
import styles from './PaletteLab.module.css';
import { BUILTIN_PRESETS, persist, toSource, type LabState, type Preset } from './presets';

export interface PresetBarProps {
  state: LabState;
  saved: readonly Preset[];
  onSavedChange: (next: readonly Preset[]) => void;
  onLoad: (state: LabState, name: string) => void;
}

/** Name, save, reload and export the constraint set currently on screen. */
export function PresetBar({ state, saved, onSavedChange, onLoad }: PresetBarProps) {
  const [name, setName] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const all = [...BUILTIN_PRESETS, ...saved];

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (BUILTIN_PRESETS.some((p) => p.name === trimmed)) return;
    const next = [...saved.filter((p) => p.name !== trimmed), { name: trimmed, state }];
    onSavedChange(next);
    persist(next);
    setName('');
  };

  const remove = (target: string) => {
    const next = saved.filter((p) => p.name !== target);
    onSavedChange(next);
    persist(next);
  };

  return (
    <section className={styles.presets} aria-label="Presets">
      <div className={styles.presetList}>
        {all.map((p) => (
          <span key={p.name} className={styles.presetChip}>
            <Button
              variant="ghost"
              size="sm"
              className={styles.presetLoad}
              onClick={() => onLoad(p.state, p.name)}
              tooltip={`Load ${p.name}`}
            >
              {p.name}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              className={styles.presetCopy}
              tooltip="Copy as a built-in entry"
              ariaLabel={`Copy ${p.name} as source`}
              onClick={() => {
                void navigator.clipboard?.writeText(toSource(p));
                setCopied(p.name);
                window.setTimeout(() => setCopied(null), 1200);
              }}
            >
              {copied === p.name ? '✓' : '⧉'}
            </Button>
            {!p.builtin && (
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                className={styles.presetCopy}
                onClick={() => remove(p.name)}
                tooltip={`Delete ${p.name}`}
                ariaLabel={`Delete ${p.name}`}
              >
                ×
              </Button>
            )}
          </span>
        ))}
      </div>
      <div className={styles.presetSave}>
        <Input
          value={name}
          placeholder="Name this state"
          onChange={setName}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !imeKey(e.nativeEvent)) save();
          }}
          aria-label="Preset name"
        />
        <Button size="sm" onClick={save} disabled={!name.trim()}>
          Save
        </Button>
      </div>
    </section>
  );
}
