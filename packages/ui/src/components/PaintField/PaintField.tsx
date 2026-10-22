import { type ReactElement } from 'react';
import {
  Button as RACButton,
  Dialog as RACDialog,
  DialogTrigger,
  Popover as RACPopover,
} from 'react-aria-components';
import { INHERIT, usePaintKind, type Inherit, type Paint, type PaintKind } from '@weasel-js/core';
import type { PaintInherit } from '../PaintInput';
import { useOverlayPortal, type OverlayPortalProps } from '../../overlays/portalHost';
import { paintPreviewCss } from '../../paintPreview';
import { PaintInput } from '../PaintInput';
import { ownPaint } from '../PaintInput/PaintInput';
import listbox from '../listbox.module.css';
import s from './PaintField.module.css';

/** Props for {@link PaintField}. `onInput` fires throughout a gesture inside
 *  the popover and `onChange` once at its end. */
export interface PaintFieldProps extends OverlayPortalProps {
  /** The paint being edited. `null` is an explicit "no paint"; `undefined` is
   *  no value to show; `'inherit'` takes the enclosing container's. */
  value: Paint | Inherit | null | undefined;
  /** Present, "Inherit" is offered; its `paint` is the swatch an inheriting
   *  field shows. */
  inherit?: PaintInherit;
  /** Indeterminate presentation: the trigger says "Mixed" and the editor
   *  lights no kind. */
  mixed?: boolean;
  /** Dim the trigger — a value is in effect but was never chosen. */
  unset?: boolean;
  /** Restrict the editor's kind bar. Default: every registered kind. */
  kinds?: readonly PaintKind[];
  /** Offer "None" in the editor. Default `true`. */
  allowNone?: boolean;
  /** The trigger shows the paint and opens nothing. */
  disabled?: boolean;
  onInput?: (next: Paint | null) => void;
  onChange: (next: Paint | null) => void;
  /** Names the paint this field edits — `Fill`, `Color`. */
  'aria-label'?: string;
  className?: string;
}

/** What the trigger says it is holding. */
function kindLabel(paint: Paint | Inherit | null | undefined, mixed: boolean, label: string | undefined): string {
  if (mixed) return 'Mixed';
  if (paint === INHERIT) return 'Inherit';
  if (paint === null) return 'None';
  if (paint === undefined) return '—';
  return label ?? (paint.kind ?? 'solid');
}

/**
 * A whole `Paint` in one control slot: a swatch that says which kind it
 * holds, and a popover holding {@link PaintInput}.
 *
 * `PaintInput` itself is a kind bar over a body — six segments and a stop
 * editor — which a property row's control column cannot hold. This is the
 * shape for a narrow slot, and the difference that matters is fidelity: a
 * `ColorField` in that slot reads a gradient's first stop and writes a solid
 * back, so touching the control loses the paint.
 */
export function PaintField(props: PaintFieldProps): ReactElement {
  const {
    value, mixed = false, unset = false, kinds, allowNone = true, disabled = false,
    onInput, onChange, className, portalContainer,
  } = props;
  const ariaLabel = props['aria-label'];
  const { anchor, provide, ready } = useOverlayPortal(portalContainer);
  const shown = value === INHERIT ? props.inherit?.paint : value;
  const preview = mixed ? undefined : paintPreviewCss(shown);
  const label = usePaintKind(ownPaint(value)?.kind)?.label;

  return (
    <DialogTrigger>
      {anchor}
      <RACButton
        className={[s.trigger, className].filter(Boolean).join(' ')}
        aria-label={ariaLabel}
        isDisabled={disabled}
        {...(unset ? { 'data-unset': '' } : {})}
        {...(mixed ? { 'data-mixed': '' } : {})}
      >
        <span
          className={s.swatch}
          aria-hidden="true"
          {...(preview ? { style: { background: preview } } : { 'data-empty': '' })}
        />
        <span className={s.label}>{kindLabel(value, mixed, label)}</span>
      </RACButton>
      {/* `data-weasel-overlay`: see Select — the popover renders in a portal,
          outside the subtree the trigger sits in. */}
      {ready && provide(
        <RACPopover className={s.popover} data-weasel-overlay="">
          <RACDialog className={`${listbox.surface} ${s.body}`} aria-label={ariaLabel ? `${ariaLabel} editor` : 'Paint editor'}>
            <PaintInput
              value={value}
              mixed={mixed}
              unset={unset}
              kinds={kinds}
              allowNone={allowNone}
              inherit={props.inherit}
              onInput={onInput}
              onChange={onChange}
              aria-label={ariaLabel}
            />
          </RACDialog>
        </RACPopover>
      )}
    </DialogTrigger>
  );
}
