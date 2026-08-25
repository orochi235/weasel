import { AddIcon } from '@weasel-js/ui';
import { Select, ToggleBar } from '../passthrough/weasel-ui';
import type { LabMode } from '../state/types';
import { useLabContext } from './LabContext';

const MODES: { value: LabMode; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** The controls `<Lab>` puts in its header: add a trial, and choose the color
 *  mode. Both drive `LabContext`, which carried them with no UI at all — so
 *  every consumer rebuilt these two. Rendered before a consumer's own header
 *  content, which still lands beside them. */
export function LabHeader() {
  const lab = useLabContext();
  const only = lab.instruments.length === 1 ? lab.instruments[0] : null;

  return (
    <>
      {only ? (
        <button
          type="button"
          className="lk-lab-header__add"
          onClick={() => lab.addTrial(only.name)}
        >
          <AddIcon size={16} />
          <span>Add trial</span>
        </button>
      ) : (
        // Held at null so the control stays an "add one" action rather than
        // reading as the current instrument.
        <Select
          className="lk-lab-header__add-select"
          aria-label="Add trial"
          placeholder="Add trial…"
          selectedKey={null}
          options={lab.instruments.map((i) => ({ value: i.name, label: i.name }))}
          onSelectionChange={(name) => {
            if (name != null) lab.addTrial(String(name));
          }}
        />
      )}

      <ToggleBar
        className="lk-lab-header__mode"
        ariaLabel="Color mode"
        size="sm"
        items={MODES}
        value={lab.mode}
        onChange={(next) => {
          if (next) lab.setMode(next);
        }}
      />
    </>
  );
}
