import { createContext, useContext, type ReactNode } from 'react';

/**
 * The form a control takes where it is drawn: a cell of a bar (`'bar'`), a row of the menu a bar's overflow opens
 * (`'menu'`), a labeled row of a form or a panel (`'row'`), a row of a popover a cell opens (`'popover'`), or a tool
 * of a palette (`'palette'`).
 */
export type ControlForm = 'row' | 'bar' | 'menu' | 'popover' | 'palette';

const FormContext = createContext<ControlForm>('bar');

/** Draws the controls inside it in `form`, unless one names its own. `Bar`, its overflow menu, its popovers, and
 *  `ToolGroup` each set one. */
export function FormScope({ form, children }: { form: ControlForm; children: ReactNode }) {
  return <FormContext.Provider value={form}>{children}</FormContext.Provider>;
}

/** `own`, else the nearest {@link FormScope}'s form, else `'bar'`. */
export function useControlForm(own?: ControlForm): ControlForm {
  const scoped = useContext(FormContext);
  return own ?? scoped;
}

/** Whether a leaf drawn in `form` takes its bar form rather than its row form. */
export function drawsBarForm(form: ControlForm): boolean {
  return form === 'bar' || form === 'menu' || form === 'palette';
}
