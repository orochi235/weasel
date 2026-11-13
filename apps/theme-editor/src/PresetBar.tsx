import { useState } from 'react';
import { imeKey } from '@weasel-js/ui-input';
import { Button } from '@weasel-js/ui/components/Button';
import { CloseButton } from '@weasel-js/ui/components/CloseButton';
import { Icon } from '@weasel-js/ui/components/Icon';
import { Input } from '@weasel-js/ui/components/Input';
import { icon } from './icons.gen';
import styles from './PaletteLab.module.css';
import { BUILTIN_PRESETS, persist, toSource, type LabState, type Preset } from './presets';
import { copyText } from '@weasel-js/react';
import { useFlash } from './useFlash';

export interface PresetBarProps {
  state: LabState;
  saved: readonly Preset[];
  onSavedChange: (next: readonly Preset[]) => void;
  onLoad: (state: LabState, name: string) => void;
}

/** Name, save, reload and export the constraint set currently on screen. */
export function PresetBar({ state, saved, onSavedChange, onLoad }: PresetBarProps) {
  const [name, setName] = useState('');
  const [copied, flashCopied] = useFlash<string | null>(null, 1200);
  const [unkept, setUnkept] = useState(false);

  const all = [...BUILTIN_PRESETS, ...saved];

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (BUILTIN_PRESETS.some((p) => p.name === trimmed)) return;
    const next = [...saved.filter((p) => p.name !== trimmed), { name: trimmed, state }];
    onSavedChange(next);
    setUnkept(!persist(next));
    setName('');
  };

  const remove = (target: string) => {
    const next = saved.filter((p) => p.name !== target);
    onSavedChange(next);
    setUnkept(!persist(next));
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
              ariaLabel={copied === p.name ? `Copied ${p.name}` : `Copy ${p.name} as source`}
              onClick={() => {
                void copyText(toSource(p)).then((took) => took && flashCopied(p.name));
              }}
            >
              <Icon name={copied === p.name ? icon('ui:check') : icon('core:copy')} size={14} />
            </Button>
            {!p.builtin && (
              <CloseButton
                className={styles.presetCopy}
                onClick={() => remove(p.name)}
                tooltip={`Delete ${p.name}`}
                ariaLabel={`Delete ${p.name}`}
              />
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
      {unkept && <p role="status">Presets are not being kept in the browser, which refused to store them: a reload loses them.</p>}
    </section>
  );
}
