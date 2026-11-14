import type { ComponentType, ReactElement } from 'react';
import type { PaintKindEditorProps, PaintKindEntry } from '@weasel-js/core';
import type { MESH_GRADIENT_KIND, MeshGradientPaint } from '@weasel-js/core/mesh';
import { MeshEditor } from '../MeshEditor/MeshEditor';

type KindEditor = ComponentType<PaintKindEditorProps>;

/** A gradient kind's editor leaves the blend-space switch to `GradientEditor`,
 *  which draws it under every gradient body. */
function MeshPaintEditor(props: PaintKindEditorProps): ReactElement {
  return <MeshEditor {...props} value={props.value as unknown as MeshGradientPaint} spaceSwitch={false} />;
}

const MESH: typeof MESH_GRADIENT_KIND = 'mesh-gradient';

// Editors for built-in kinds whose entries live in core, which cannot depend on this package.
const KIT_EDITORS: ReadonlyMap<string, KindEditor> = new Map<string, KindEditor>([
  [MESH, MeshPaintEditor],
]);

/** The editor a paint control mounts for a kind: its entry's own `Editor`,
 *  which wins even for a built-in id, else the kit's. */
export function paintKindEditor(entry: PaintKindEntry | undefined): KindEditor | undefined {
  if (entry === undefined) return undefined;
  return entry.Editor ?? KIT_EDITORS.get(entry.id);
}
