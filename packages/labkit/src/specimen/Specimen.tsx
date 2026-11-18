import { ButtonsAndToggles } from './ButtonsAndToggles';
import { EditorsAndPlots } from './EditorsAndPlots';
import { FieldsAndPickers } from './FieldsAndPickers';
import { LabChrome } from './LabChrome';
import { ListsAndData } from './ListsAndData';
import { OverlaysAndFeedback } from './OverlaysAndFeedback';
import { PanelsAndRows } from './PanelsAndRows';
import { ToolChrome } from './ToolChrome';

export { SPECIMEN_SECTIONS } from './Section';

/**
 * One page of the kit's controls and chrome, each in a small working state: a
 * preview surface for a theme, where every token has something on screen that
 * reads it. Popovers, dialogs and toasts portal into the page itself, so they
 * take whatever theme the page is under.
 */
export function Specimen({ className }: { className?: string }) {
  return (
    <div className={className ? `lk-specimen ${className}` : 'lk-specimen'} data-wzl-portal-host="">
      <ButtonsAndToggles />
      <FieldsAndPickers />
      <PanelsAndRows />
      <OverlaysAndFeedback />
      <ListsAndData />
      <ToolChrome />
      <EditorsAndPlots />
      <LabChrome />
    </div>
  );
}
