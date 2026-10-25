import { describe, expect, it } from 'vitest';
import { createScene, type RectPose } from '@weasel-js/core';
import { DIAGRAM_TYPES, STENCIL_GROUPS, groupStencilIds, groupStencils } from './catalog';
import {
  addStencilGroup, diagramTypeDocOf, diagramTypeDocValue, diagramTypeOf, removeStencilGroup, setDiagramType,
} from './doc';
import { DIAGRAM_TYPE_DOC_KEY, type DiagramType } from './types';

const newScene = () => createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
const FLOWCHART = { type: 'flowchart', groups: ['flowchart', 'containers'] };
const ORG: DiagramType = { id: 'org', label: 'Org chart', groups: ['containers'], layout: 'tree' };
const TYPES = { ...DIAGRAM_TYPES, org: ORG };

describe('the diagram type a scene holds', () => {
  it('reads as flowchart with its groups when the scene names no type', () => {
    expect(diagramTypeDocOf(newScene())).toEqual(FLOWCHART);
    expect(diagramTypeOf(newScene())).toBe(DIAGRAM_TYPES.flowchart);
  });

  it('reads an unknown type id as flowchart', () => {
    const scene = newScene();
    scene.doc.set(DIAGRAM_TYPE_DOC_KEY, { type: 'nope', groups: ['containers'] });
    expect(diagramTypeDocOf(scene)).toEqual(FLOWCHART);
  });

  it('reads the type and groups it holds, from the catalog it is given', () => {
    const scene = newScene();
    scene.doc.set(DIAGRAM_TYPE_DOC_KEY, { type: 'org', groups: ['flowchart'] });
    expect(diagramTypeDocOf(scene, TYPES)).toEqual({ type: 'org', groups: ['flowchart'] });
    expect(diagramTypeOf(scene, TYPES)).toBe(ORG);
  });

  it("sets a type with that type's groups, as one undo entry", () => {
    const scene = newScene();
    scene.doc.set(DIAGRAM_TYPE_DOC_KEY, { type: 'flowchart', groups: ['flowchart'] });
    const depth = scene.historyIndex();
    setDiagramType(scene, 'org', { types: TYPES });
    expect(scene.doc.get(DIAGRAM_TYPE_DOC_KEY)).toEqual({ type: 'org', groups: ['containers'] });
    expect(scene.historyIndex()).toBe(depth + 1);
    scene.undo();
    expect(scene.doc.get(DIAGRAM_TYPE_DOC_KEY)).toEqual({ type: 'flowchart', groups: ['flowchart'] });
  });

  it('adds a group after the shown ones and removes one, each undoable', () => {
    const scene = newScene();
    removeStencilGroup(scene, 'flowchart');
    expect(diagramTypeDocOf(scene)).toEqual({ type: 'flowchart', groups: ['containers'] });
    addStencilGroup(scene, 'flowchart');
    expect(diagramTypeDocOf(scene)).toEqual({ type: 'flowchart', groups: ['containers', 'flowchart'] });
    scene.undo();
    expect(diagramTypeDocOf(scene)).toEqual({ type: 'flowchart', groups: ['containers'] });
    scene.undo();
    expect(scene.doc.get(DIAGRAM_TYPE_DOC_KEY)).toBeUndefined();
  });

  it('writes nothing for a group already shown, or one not shown removed', () => {
    const scene = newScene();
    const depth = scene.historyIndex();
    addStencilGroup(scene, 'flowchart');
    removeStencilGroup(scene, 'network');
    expect(scene.historyIndex()).toBe(depth);
    expect(scene.doc.get(DIAGRAM_TYPE_DOC_KEY)).toBeUndefined();
  });

  it("gives a new document's value for a type", () => {
    expect(diagramTypeDocValue('org', TYPES)).toEqual({ type: 'org', groups: ['containers'] });
    expect(diagramTypeDocValue('nope', TYPES)).toEqual(FLOWCHART);
  });
});

describe('stencil groups', () => {
  it("lists the groups' stencils in order, skipping an unknown id", () => {
    const ids = groupStencils(['containers', 'nope', 'flowchart']).map((s) => s.id);
    expect(ids).toEqual([...groupStencilIds(STENCIL_GROUPS.containers!), ...groupStencilIds(STENCIL_GROUPS.flowchart!)]);
  });
});
