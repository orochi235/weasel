import type { ReactNode } from 'react';
import {
  Modal as RACModal,
  ModalOverlay,
  Dialog as RACDialog,
  Heading,
  type ModalOverlayProps,
  type DialogProps as RACDialogProps,
} from 'react-aria-components';
import { useContainedRoot, useOverlayPortal, type OverlayPortalProps, type WithoutPortalTarget } from '../../overlays/portalHost';
import { ContainedModal } from './ContainedModal';
import { CloseButton } from '../CloseButton';
import { type AppearanceProps, useAppearance } from '../appearance';
import s from './Dialog.module.css';

/** Props for {@link Dialog}, on top of React Aria's `ModalOverlay` props. */
export type DialogProps = Omit<
  WithoutPortalTarget<ModalOverlayProps>,
  'children' | 'className'
> &
  OverlayPortalProps &
  AppearanceProps & {
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
    /** The dialog's accessible name, where `title` is not plain text. */
    'aria-label'?: string;
    /** ARIA role. Defaults to `dialog`. Use `alertdialog` for confirms. */
    role?: RACDialogProps['role'];
    /** Class applied to the modal box (inside the overlay). */
    className?: string;
    /** Draw the dialog's box where it is rendered, in the page's flow: no
     *  overlay, portal, focus trap or scroll lock, and `isOpen` is ignored. For
     *  showing what a dialog looks like — a preview, a story, a document. */
    inline?: boolean;
    /** Class applied to the scrolling body. For content that owns its own
     *  scrolling — a form with a fixed navigation rail beside a scrolling
     *  pane — this is where the body's padding and overflow come off. */
    bodyClassName?: string;
  };

/**
 * Modal dialog wrapping React Aria. Supplies a default header (title +
 * close), scrollable body, and footer slot. Pass `isOpen` + `onOpenChange`
 * for controlled visibility, or omit both and use a `<DialogTrigger>` from
 * `react-aria-components` upstream of this component.
 *
 * Escape, focus trap, and scroll lock all come from the underlying
 * primitives. A click outside closes it only with `isDismissable`. The appearance props work as on `<PropertyPanel>`:
 * a destructive confirm is `grade="danger"`.
 */
export function Dialog(props: DialogProps) {
  const {
    title,
    showCloseButton,
    children,
    footer,
    role = 'dialog',
    className,
    bodyClassName,
    inline = false,
    'aria-label': ariaLabel,
    isOpen,
    onOpenChange,
    portalContainer,
    stance,
    grade,
    emphasis,
    tint,
    ...rest
  } = props;
  const appearance = useAppearance({ stance, grade, emphasis, tint });

  const showClose = showCloseButton ?? Boolean(onOpenChange);
  const { anchor, provide, ready } = useOverlayPortal(portalContainer);
  const containedRoot = useContainedRoot(portalContainer);
  const box = (close: () => void) => (
    <>
      {(title !== undefined || showClose) && (
        <header className={s.header}>
          {title !== undefined && (
            <Heading slot="title" className={s.title}>{title}</Heading>
          )}
          {showClose && (
            <CloseButton ariaLabel="Close dialog" onClick={close} />
          )}
        </header>
      )}
      <div className={[s.body, bodyClassName].filter(Boolean).join(' ')}>{children}</div>
      {footer !== undefined && <footer className={s.footer}>{footer}</footer>}
    </>
  );
  if (inline) {
    return (
      <div className={[s.modal, s.inline, className].filter(Boolean).join(' ')} {...appearance}>
        <RACDialog role={role} className={s.dialog} aria-label={ariaLabel}>
          {box(() => onOpenChange?.(false))}
        </RACDialog>
      </div>
    );
  }

  if (containedRoot) {
    return (
      <ContainedModal
        root={containedRoot}
        isOpen={isOpen}
        defaultOpen={rest.defaultOpen}
        onOpenChange={onOpenChange}
        isDismissable={rest.isDismissable}
        isKeyboardDismissDisabled={rest.isKeyboardDismissDisabled}
        overlayClassName={s.overlay}
        modalClassName={[s.modal, className].filter(Boolean).join(' ')}
        modalProps={appearance}
      >
        <RACDialog role={role} className={s.dialog} aria-label={ariaLabel}>
          {({ close }) => box(close)}
        </RACDialog>
      </ContainedModal>
    );
  }

  return (
    <>
      {anchor}
      {ready && provide(
        <ModalOverlay
          {...rest}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          className={s.overlay}
          data-weasel-overlay=""
        >
          <RACModal className={[s.modal, className].filter(Boolean).join(' ')} {...appearance}>
            <RACDialog role={role} className={s.dialog} aria-label={ariaLabel}>
              {({ close }) => box(close)}
            </RACDialog>
          </RACModal>
        </ModalOverlay>
      )}
    </>
  );
}
