import { useState } from 'react';
import { prefLeaves, type PrefGroup } from '@weasel-js/prefs';
import { PrefSchemaEditor } from '@weasel-js/prefs-editor';
import s from './PrefsEditorDemo.module.css';

const START: PrefGroup = {
  name: 'Preferences',
  children: {
    view: {
      name: 'View',
      children: {
        grid: { kind: 'boolean', name: 'Show grid', description: 'Draw the grid.', default: true },
        gap: { kind: 'number', name: 'Grid gap', description: 'Space between lines.', default: 16, min: 4, max: 64 },
        units: {
          kind: 'enum', name: 'Units', description: 'Ruler units.', default: 'px',
          options: [{ value: 'px', label: 'Pixels' }, { value: 'mm', label: 'Millimeters' }],
        },
      },
    },
    export: {
      name: 'Export',
      children: {
        author: { kind: 'string', name: 'Author', description: 'Written into saved files.', default: '' },
      },
    },
  },
};

export function PrefsEditorDemo() {
  const [schema, setSchema] = useState(START);
  return (
    <div className={s.demo}>
      <div className={s.editor}>
        <PrefSchemaEditor schema={schema} onChange={setSchema} />
      </div>
      <ul className={s.leaves} aria-label="Leaves in the schema">
        {[...prefLeaves(schema)].map(([path, leaf]) => (
          <li key={path}>
            <code>{path}</code> {leaf.kind} “{leaf.name}”
          </li>
        ))}
      </ul>
    </div>
  );
}
