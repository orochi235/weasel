import { type ColorList, declaredAxisChoice, type Theme } from '@weasel-js/theme';
import { ThemeProvider, useResolvedColorMode } from '@weasel-js/theme/react';
import { type ReactNode, useState } from 'react';
import { AnnotationOptions } from '../annotations/AnnotationOptions';
import { LabFooterRegion } from '../chrome/LabChrome';
import type { LabDensity, LabMode } from '../state/types';
import { interstellarTheme } from '../theme/interstellar';
import { labBar } from './LabHeader';
import { LabPalette } from './LabPalette';
import { LabPanes } from './LabPanes';
import { LabShell } from './LabShell';
import { LabShortcutSheet } from './LabShortcutSheet';
import { LabSurface } from './LabSurface';
import type { LabChromeAll } from './labChromeAll';
import type { LabBaseProps } from './labProps';
import { nebulaStyle } from './nebula';
import { createPanelHostRegistry, PanelHostContext } from './panelHost';
import { labClassName, type useLabPresentation } from './presentation';
import { UnreadableRecords } from './UnreadableRecords';

/** The selection a lab themes itself at, less any axis its theme does not declare. */
function labSelection(theme: Theme, mode: string, density: LabDensity | undefined) {
  return declaredAxisChoice(theme, { mode, density: density ?? 'comfortable' });
}

/** A lab's theme at its color mode, wearing the `nebula` backdrop where it has one. */
export function LabTheme({
  theme,
  mode,
  density,
  nebula,
  className,
  children,
}: {
  theme: Theme;
  mode: LabMode;
  density: LabDensity | undefined;
  nebula?: ColorList;
  className: string;
  children: ReactNode;
}) {
  const resolvedMode = useResolvedColorMode(mode);
  return (
    <ThemeProvider
      theme={theme}
      selection={labSelection(theme, resolvedMode, density)}
      className={className}
      style={nebulaStyle(nebula, theme, resolvedMode, density ?? 'comfortable')}
    >
      {children}
    </ThemeProvider>
  );
}

/** Props for `LabPage`: `<Lab>`'s props for how its page looks, and what the runtime decided. */
export type LabPageProps = Pick<
  LabBaseProps,
  | 'density'
  | 'theme'
  | 'nebula'
  | 'title'
  | 'documentTitle'
  | 'pages'
  | 'path'
  | 'footer'
  | 'header'
  | 'menus'
  | 'menuBar'
  | 'zoom'
  | 'shortcuts'
> & {
  /** The store's color mode. */
  mode: LabMode;
  presentation: ReturnType<typeof useLabPresentation>;
  chromeAll: LabChromeAll;
  /** Whether the lab offers to add a trial. */
  addTrial: boolean;
  /** A lab with no instruments: no zoom, and its children are its body rather than part of its header. */
  trialless: boolean;
  /** `<Lab>`'s children, which a lab with trials puts in its header. */
  barChildren: ReactNode;
  bodyRef: (el: HTMLDivElement | null) => void;
  children: ReactNode;
};

/** A running lab's page: themed, framed by the shell with its menu bar, header and footer, around `children`. */
export function LabPage({
  density,
  theme = interstellarTheme,
  nebula,
  title,
  documentTitle,
  pages,
  path,
  footer,
  header = true,
  menus,
  menuBar = true,
  zoom = true,
  shortcuts = true,
  mode,
  presentation,
  chromeAll,
  addTrial,
  trialless,
  barChildren,
  bodyRef,
  children,
}: LabPageProps) {
  const bar = labBar({
    header,
    menuBar,
    presenting: presentation.active,
    menus,
    zoom: zoom && !trialless,
    children: trialless ? undefined : barChildren,
    addTrial,
    contributions: chromeAll.all,
    shortcuts,
  });
  return (
    <LabTheme
      theme={theme}
      mode={mode}
      density={density}
      nebula={nebula}
      className={labClassName(presentation)}
    >
      <LabShell
        title={title ?? 'Labkit'}
        bar={header}
        menuBar={bar.menuBar}
        mode={mode}
        {...(documentTitle !== undefined ? { documentTitle } : {})}
        {...(pages ? { pages } : {})}
        {...(path !== undefined ? { path } : {})}
        footer={labFooter(footer, chromeAll)}
        header={bar.header}
      >
        <LabContent chromeAll={chromeAll} shortcuts={shortcuts} bodyRef={bodyRef}>
          {children}
        </LabContent>
      </LabShell>
    </LabTheme>
  );
}

/** The lab's footer: the `footer` prop, then any footer contributions. */
function labFooter(footer: ReactNode, chromeAll: LabChromeAll): ReactNode {
  if (!chromeAll.hasFooter) return footer;
  return (
    <>
      {footer}
      <LabFooterRegion contributions={chromeAll.all} />
    </>
  );
}

/** The lab's page body: its notices and shortcut sheet, then its surface, holding the options palette and the
 *  contributed palette beside `children`, in panes when anything contributes to one. */
function LabContent({
  chromeAll,
  shortcuts,
  bodyRef,
  children,
}: {
  chromeAll: LabChromeAll;
  shortcuts: boolean;
  bodyRef: (el: HTMLDivElement | null) => void;
  children: ReactNode;
}) {
  // One registry for the lab's lifetime: a panel host is a DOM node the workspace owns and the
  // trial portals into, so it must outlive both ends of a dock/undock without being rebuilt.
  const [panelHosts] = useState(createPanelHostRegistry);
  return (
    <>
      <UnreadableRecords />
      {shortcuts && <LabShortcutSheet tools={chromeAll.tools} />}
      <PanelHostContext.Provider value={panelHosts}>
        <LabSurface bodyRef={bodyRef} contributions={chromeAll.all}>
          <AnnotationOptions tools={chromeAll.tools} />
          {chromeAll.hasPanes ? (
            <LabPanes contributions={chromeAll.all}>
              <LabPalette contributions={chromeAll.all} />
              {children}
            </LabPanes>
          ) : (
            <>
              <LabPalette contributions={chromeAll.all} />
              {children}
            </>
          )}
        </LabSurface>
      </PanelHostContext.Provider>
    </>
  );
}
