import { useState, type ReactNode, type RefObject } from 'react';
import { useOverlayPortal } from '../../overlays/portalHost';
import { Input } from '../Input';
import { Popover, PopoverDialog } from '../Popover';
import s from './TokenField.module.css';

interface TokenEditorProps {
  /** The chip the popover opens against. */
  anchor: HTMLElement | null;
  /** Names the popover for assistive tech. */
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** The popover that edits one token, open while it is rendered. */
export function TokenEditor({ anchor, title, onClose, children }: TokenEditorProps) {
  const { anchor: portalAnchor, provide, ready } = useOverlayPortal();
  const trigger: RefObject<HTMLElement | null> = { current: anchor };
  return (
    <>
      {portalAnchor}
      {ready && anchor && provide(
        <Popover
          triggerRef={trigger}
          isOpen
          onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}
          placement="bottom start"
          offset={4}
          className={s.popover}
          data-weasel-overlay=""
        >
          <PopoverDialog aria-label={title} className={s.editor}>
            {children}
          </PopoverDialog>
        </Popover>,
      )}
    </>
  );
}

/** The editor a token gets without one of its own: its label as text, remade into a token as it is typed. */
export function TokenText({ value, onCommit }: { value: string; onCommit: (text: string) => void }) {
  const [text, setText] = useState(value);
  return (
    <Input
      aria-label="Text"
      autoFocus
      value={text}
      onChange={(next) => {
        setText(next);
        if (next.trim() !== '') onCommit(next.trim());
      }}
    />
  );
}
