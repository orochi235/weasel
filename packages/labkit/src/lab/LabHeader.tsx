import { AddIcon, ModeAutoIcon, ModeDarkIcon, ModeLightIcon } from '@weasel-js/ui';
import { Select, ToggleBar } from '../passthrough/weasel-ui';
import type { LabMode } from '../state/types';
import { useLabContext } from './LabContext';

// The glyph is the segment's content and the word is its accessible name, so
// the bar stays a three-way radiogroup announcing Auto / Light / Dark.
const MODES = [
  { value: 'auto' as LabMode, label: 'Auto', glyph: <ModeAutoIcon size={14} /> },
  { value: 'light' as LabMode, label: 'Light', glyph: <ModeLightIcon size={14} /> },
  { value: 'dark' as LabMode, label: 'Dark', glyph: <ModeDarkIcon size={14} /> },
];

const MODE_ITEMS = MODES.map(({ value, label, glyph }) => ({
  value,
  label: glyph,
  ariaLabel: label,
}));

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
        variant="flat"
        items={MODE_ITEMS}
        value={lab.mode}
        onChange={(next) => {
          if (next) lab.setMode(next);
        }}
      />
    </>
  );
}
