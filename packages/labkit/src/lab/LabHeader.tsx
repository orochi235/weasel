import { AddIcon } from '@weasel-js/ui';
import { MenuButton, ThemeSwitcher } from '../passthrough/weasel-ui';
import { useLabContext } from './LabContext';

/** The control `<Lab>` puts at the start of its header: add a trial. It drives
 *  `LabContext`, which carried it with no UI at all — so every consumer rebuilt
 *  it. Rendered before a consumer's own header content. */
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
    </>
  );
}

/** The lab's color-mode switch, which `<Lab>` puts at the end of its header,
 *  after a consumer's own header content. */
export function LabThemeSwitcher() {
  const lab = useLabContext();
  return <ThemeSwitcher value={lab.mode} onChange={lab.setMode} />;
}
