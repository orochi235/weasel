import { PAGE_TEMPLATES, type PageTemplate, type PageTemplateGroup } from '@weasel-js/diagram-formats';
import { Button } from '@weasel-js/ui/components/Button';
import { Dialog } from '@weasel-js/ui/components/Dialog';
import { Icon } from '@weasel-js/ui/components/Icon';
import { ItemList, type ItemListRow } from '@weasel-js/ui/components/ItemList';
import { useState, type ReactElement } from 'react';
import './templateDialog.css';

const GROUPS: readonly { id: PageTemplateGroup; label: string }[] = [
  { id: 'diagram', label: 'Diagrams' }, { id: 'sequence', label: 'Sequence' }, { id: 'chart', label: 'Charts' },
];

/** A dialog choosing one of the page templates, listed by group, that confirms with `action`. */
export function TemplateDialog({ title, action, initial, onChoose, onClose }: {
  title: string;
  action: string;
  initial: string;
  onChoose(template: PageTemplate): void;
  onClose(): void;
}): ReactElement {
  const [chosen, setChosen] = useState(initial);
  const all = Object.values(PAGE_TEMPLATES);
  const rows = (group: PageTemplateGroup): ItemListRow[] => all.filter((t) => t.group === group).map((t) => ({
    id: t.id,
    label: t.label,
    selected: t.id === chosen,
    ...(t.icon ? { leading: <Icon name={t.icon} size={16} /> } : {}),
  }));
  const footer = (
    <>
      <Button onClick={onClose}>Cancel</Button>
      <Button stance="confirm" onClick={() => onChoose(PAGE_TEMPLATES[chosen]!)}>{action}</Button>
    </>
  );
  return (
    <Dialog isOpen onOpenChange={(isOpen) => { if (!isOpen) onClose(); }} title={title} isDismissable footer={footer}>
      <div className="wc-templates">
        {GROUPS.map((g) => (
          <section key={g.id} className="wc-templates-group">
            <h3 className="wc-templates-heading">{g.label}</h3>
            <ItemList rows={rows(g.id)} selection="single" onActivate={setChosen} containerProps={{ 'aria-label': g.label }} />
          </section>
        ))}
      </div>
    </Dialog>
  );
}
