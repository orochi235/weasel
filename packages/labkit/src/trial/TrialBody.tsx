import type { ReactNode } from 'react';
import { Split, type SplitProps } from '../primitives/Split';

/** Props for `<TrialBody>`. */
export interface TrialBodyProps
  extends Omit<SplitProps, 'sidebar' | 'children' | 'className' | 'sidebarClassName' | 'label'> {
  /** The sidebar region's sections, or `null` for a trial with none: the
   *  content then fills the body, with no empty pane or seam beside it. */
  sidebar: ReactNode | null;
  /** The instrument's own output. */
  children: ReactNode;
  /** Extra class on the content pane — `Trial` marks a canvas instrument's
   *  well flush. */
  contentClassName?: string;
}

/** A trial's sidebar and content as a `Split`, wearing the trial's classes. */
export function TrialBody({ sidebar, children, contentClassName, ...rest }: TrialBodyProps) {
  const content = contentClassName ? `lk-trial__content ${contentClassName}` : 'lk-trial__content';
  if (sidebar === null) {
    return (
      <div className="lk-trial__panes">
        <div className={content}>{children}</div>
      </div>
    );
  }
  return (
    <Split
      {...rest}
      sidebar={sidebar}
      className="lk-trial__panes"
      sidebarClassName="lk-trial__sidebar"
      contentClassName={content}
    >
      {children}
    </Split>
  );
}
