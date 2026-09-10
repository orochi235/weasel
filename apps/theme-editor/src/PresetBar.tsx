import { useState } from 'react';
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
            <button
              type="button"
              className={styles.presetLoad}
              onClick={() => onLoad(p.state, p.name)}
              title={`Load ${p.name}`}
            >
              {p.name}
            </button>
            <button
              type="button"
              className={styles.presetCopy}
              title="Copy as a built-in entry"
              aria-label={`Copy ${p.name} as source`}
              onClick={() => {
                void navigator.clipboard?.writeText(toSource(p));
                setCopied(p.name);
                window.setTimeout(() => setCopied(null), 1200);
              }}
            >
              {copied === p.name ? '✓' : '⧉'}
            </button>
            {!p.builtin && (
              <button
                type="button"
                className={styles.presetCopy}
                onClick={() => remove(p.name)}
                title={`Delete ${p.name}`}
                aria-label={`Delete ${p.name}`}
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>
      <div className={styles.presetSave}>
        <input
          type="text"
          value={name}
          placeholder="Name this state"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
          }}
          className={styles.anchorSearch}
          aria-label="Preset name"
        />
        <button type="button" className={styles.copy} onClick={save} disabled={!name.trim()}>
          Save
        </button>
      </div>
    </section>
  );
}
