import type { ReactNode } from 'react';
import {
  Modal as RACModal,
  ModalOverlay,
  Dialog as RACDialog,
  Heading,
  type ModalOverlayProps,
  type DialogProps as RACDialogProps,
} from 'react-aria-components';
import s from './Dialog.module.css';

/** Props for {@link Dialog}, on top of React Aria's `ModalOverlay` props. */
export type DialogProps = Omit<ModalOverlayProps, 'children' | 'className'> & {
  /** Heading rendered in the dialog's default header. Omit when supplying
   *  a custom `header` slot via children. */
  title?: ReactNode;
  /** Show the built-in close button. Defaults to true when `onOpenChange`
   *  is wired so the user has an escape hatch. */
  showCloseButton?: boolean;
  /** Body content. */
  children?: ReactNode;
  /** Footer slot — typically action buttons. */
  footer?: ReactNode;
  /** ARIA role. Defaults to `dialog`. Use `alertdialog` for confirms. */
  role?: RACDialogProps['role'];
  /** Class applied to the modal box (inside the overlay). */
  className?: string;
};

/**
 * Modal dialog wrapping React Aria. Supplies a default header (title +
 * close), scrollable body, and footer slot. Pass `isOpen` + `onOpenChange`
 * for controlled visibility, or omit both and use a `<DialogTrigger>` from
 * `react-aria-components` upstream of this component.
 *
 * Escape, click-outside, focus trap, and scroll lock all come from the
 * underlying primitives.
 */
export function Dialog(props: DialogProps) {
  const {
    title,
    showCloseButton,
    children,
    footer,
    role = 'dialog',
    className,
    isOpen,
    onOpenChange,
    ...rest
  } = props;

  const showClose = showCloseButton ?? Boolean(onOpenChange);

  return (
    <ModalOverlay {...rest} isOpen={isOpen} onOpenChange={onOpenChange} className={s.overlay} data-weasel-overlay="">
      <RACModal className={[s.modal, className].filter(Boolean).join(' ')}>
        <RACDialog role={role} className={s.dialog}>
          {({ close }) => (
            <>
              {(title !== undefined || showClose) && (
                <header className={s.header}>
                  {title !== undefined && (
                    <Heading slot="title" className={s.title}>{title}</Heading>
                  )}
                  {showClose && (
                    <button
                      type="button"
                      className={s.close}
                      onClick={close}
                      aria-label="Close dialog"
                    >
                      ×
                    </button>
                  )}
                </header>
              )}
              <div className={s.body}>{children}</div>
              {footer !== undefined && <footer className={s.footer}>{footer}</footer>}
            </>
          )}
        </RACDialog>
      </RACModal>
    </ModalOverlay>
  );
}
