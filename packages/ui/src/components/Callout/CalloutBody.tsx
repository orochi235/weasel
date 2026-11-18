import type { ReactNode } from 'react';
import { Heading } from 'react-aria-components';
import { Button, CLOSE_BUTTON_PROPS } from '../Button';
import s from './Callout.module.css';

interface CalloutBodyProps {
  modal: boolean;
  title?: ReactNode;
  titleId: string;
  showClose: boolean;
  /** The close button was pressed. */
  onClose: () => void;
  footer?: ReactNode;
  children?: ReactNode;
}

/** What a callout's dialog holds: a header with the title and close button when either shows, the body, and the footer. */
export function CalloutBody({ modal, title, titleId, showClose, onClose, footer, children }: CalloutBodyProps) {
  return (
    <>
      {(title !== undefined || showClose) && (
        <header className={s.header}>
          {title !== undefined && (
            <Heading id={titleId} slot={modal ? 'title' : undefined} className={s.title}>
              {title}
            </Heading>
          )}
          {showClose && <Button {...CLOSE_BUTTON_PROPS} aria-label="Close callout" onClick={onClose} />}
        </header>
      )}
      <div className={s.body}>{children}</div>
      {footer !== undefined && <footer className={s.footer}>{footer}</footer>}
    </>
  );
}
