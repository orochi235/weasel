/** Reading and writing a scene's {@link DIAGRAM_TYPE_DOC_KEY} value. Each write is one undo entry. */
import { DIAGRAM_TYPES, FLOWCHART_TYPE } from './catalog';
import { DIAGRAM_TYPE_DOC_KEY, type DiagramType, type DiagramTypeDoc } from './types';

/** A scene as the type reader and writers use it. */
export interface DiagramTypeScene {
  doc: { get(key: string): unknown; set(key: string, value: unknown): void };
  batch<T>(label: string, fn: () => T): T;
}

type Types = Readonly<Record<string, DiagramType>>;

/** Options for the diagram type writers. */
export interface DiagramTypeWriteOptions {
  /** The catalog type ids resolve in. Default {@link DIAGRAM_TYPES}. */
  types?: Types;
  label?: string;
}

/** A new document's value for type `id`: it, and its groups. Flowchart for an id `types` lacks. */
export function diagramTypeDocValue(id: string, types: Types = DIAGRAM_TYPES): DiagramTypeDoc {
  const type = types[id] ?? FLOWCHART_TYPE;
  return { type: type.id, groups: [...type.groups] };
}

/** The type and shown groups a scene holds. A scene holding none, or naming a type `types` lacks,
 *  reads as flowchart with its groups. */
export function diagramTypeDocOf(scene: Pick<DiagramTypeScene, 'doc'>, types: Types = DIAGRAM_TYPES): DiagramTypeDoc {
  const value = scene.doc.get(DIAGRAM_TYPE_DOC_KEY) as Partial<DiagramTypeDoc> | null | undefined;
  const id = typeof value?.type === 'string' && types[value.type] !== undefined ? value.type : null;
  if (id === null) return diagramTypeDocValue(FLOWCHART_TYPE.id, types);
  const groups = Array.isArray(value?.groups) ? value.groups.filter((g): g is string => typeof g === 'string') : null;
  return groups === null ? diagramTypeDocValue(id, types) : { type: id, groups };
}

/** The type a scene holds, as {@link diagramTypeDocOf} reads it. */
export function diagramTypeOf(scene: Pick<DiagramTypeScene, 'doc'>, types: Types = DIAGRAM_TYPES): DiagramType {
  return types[diagramTypeDocOf(scene, types).type] ?? FLOWCHART_TYPE;
}

function write(scene: DiagramTypeScene, value: DiagramTypeDoc, label: string): void {
  scene.batch(label, () => scene.doc.set(DIAGRAM_TYPE_DOC_KEY, value));
}

/** Makes the scene type `id`, its shown groups replaced by the type's. */
export function setDiagramType(scene: DiagramTypeScene, id: string, opts: DiagramTypeWriteOptions = {}): void {
  const value = diagramTypeDocValue(id, opts.types);
  write(scene, value, opts.label ?? `Diagram type: ${(opts.types ?? DIAGRAM_TYPES)[value.type]?.label ?? value.type}`);
}

/** Shows stencil group `id` after the ones shown. Nothing when it is shown already. */
export function addStencilGroup(scene: DiagramTypeScene, id: string, opts: DiagramTypeWriteOptions = {}): void {
  const doc = diagramTypeDocOf(scene, opts.types);
  if (doc.groups.includes(id)) return;
  write(scene, { type: doc.type, groups: [...doc.groups, id] }, opts.label ?? 'Add shapes');
}

/** Stops showing stencil group `id`. Nothing when it is not shown. */
export function removeStencilGroup(scene: DiagramTypeScene, id: string, opts: DiagramTypeWriteOptions = {}): void {
  const doc = diagramTypeDocOf(scene, opts.types);
  if (!doc.groups.includes(id)) return;
  write(scene, { type: doc.type, groups: doc.groups.filter((g) => g !== id) }, opts.label ?? 'Remove shapes');
}
