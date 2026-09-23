import { AddIcon } from '@weasel-js/ui';
import { ColorModeControl, MenuButton } from '../passthrough/weasel-ui';
import { useLabContext } from './LabContext';

/** The controls `<Lab>` puts in its header: add a trial, and choose the color
 *  mode. Both drive `LabContext`, which carried them with no UI at all — so
 *  every consumer rebuilt these two. Rendered before a consumer's own header
 *  content, which still lands beside them. */
export function LabHeader({ addTrial = true }: { addTrial?: boolean }) {
  const lab = useLabContext();
  const only = lab.instruments.length === 1 ? lab.instruments[0] : null;

  return (
    <>
      {!addTrial ? null : only ? (
        <button
          type="button"
          className="lk-lab-header__add"
          onClick={() => lab.addTrial(only.name)}
        >
          <AddIcon size={16} />
          <span>Add trial</span>
        </button>
      ) : (
        <MenuButton
          aria-label="Add trial"
          label="Add trial…"
          items={lab.instruments.map((i) => ({ value: i.name, label: i.title ?? i.name }))}
          onAction={(name) => lab.addTrial(name)}
        />
      )}

      <ColorModeControl
        className="lk-lab-header__mode"
        variant="flat"
        value={lab.mode}
        onChange={lab.setMode}
      />
    </>
  );
}
