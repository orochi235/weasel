import { Icon } from '@weasel-js/ui/components/Icon';
import { MenuButton } from '@weasel-js/ui/components/MenuButton';
import { CycleButton, COLOR_MODE_OPTIONS } from '@weasel-js/ui/components/CycleButton';
import type { ReactNode } from 'react';
import { LabHeaderRegion } from '../chrome/LabChrome';
import type { LabContribution } from '../chrome/labTypes';
import { icon } from '../icons.gen';
import { useLabContext } from './LabContext';
import { LabMenuBar } from './LabMenuBar';
import { LabZoom } from './LabZoom';
import type { LabMenus } from './labMenus';

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
          <Icon name={icon('ui:add')} size={16} />
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
  return <CycleButton value={lab.mode} onChange={lab.setMode} options={COLOR_MODE_OPTIONS} aria-label="Theme" />;
}

/** Controls the menu bar also offers, which give way to it in a narrow header. A lab with no menu
 *  bar has nowhere else to offer them, so there they never give way. */
function InMenus({ shown, children }: { shown: boolean; children: ReactNode }) {
  return shown ? <span className="lk-lab-header__in-menus">{children}</span> : children;
}

/** What `<Lab>` draws in its header bar. */
export interface LabBarInput {
  header: boolean;
  menuBar: boolean;
  presenting: boolean;
  menus: LabMenus | undefined;
  addTrial: boolean;
  zoom: boolean;
  contributions: readonly LabContribution[];
  /** Whether the lab offers the shortcut sheet, which the Lab menu then lists. */
  shortcuts?: boolean;
  children?: ReactNode;
}

/** The lab's header bar: its menus, then add trial and zoom, the consumer's `children`, the
 *  header contributions, and the theme switch. Neither part draws without the header, and the
 *  menus and zoom do not while presenting. */
export function labBar(input: LabBarInput): { menuBar: ReactNode; header: ReactNode } {
  const { header, presenting, addTrial, zoom, contributions } = input;
  const menus = input.menuBar && !presenting;
  return {
    menuBar: menus && (
      <LabMenuBar
        {...(input.menus ? { menus: input.menus } : {})}
        contributions={contributions}
        addTrial={addTrial}
        zoom={zoom}
        shortcuts={input.shortcuts ?? false}
      />
    ),
    header: header && (
      <>
        <InMenus shown={menus}>
          <LabHeader addTrial={addTrial} />
          {zoom && !presenting ? <LabZoom /> : null}
        </InMenus>
        {input.children}
        <LabHeaderRegion contributions={contributions} />
        <InMenus shown={menus}>
          <LabThemeSwitcher />
        </InMenus>
      </>
    ),
  };
}
