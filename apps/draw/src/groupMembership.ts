/**
 * WeaselDraw's group-model adapter, factored out of App.tsx so the
 * single-group-membership invariant has a focused test bed.
 *
 * The kit's {@link Group} interface permits multi-membership at the type
 * level (an id may appear in several groups' `members[]`). WeaselDraw's
 * encoding maps groups onto SVG `<g>` elements — a strict tree — so the
 * app forbids multi-membership outright. This module is the single source
 * of truth that maintains that invariant in memory; `objsToSvgNodes` in
 * `svgInterop.ts` keeps a belt-and-braces assertion at the persistence
 * boundary in case some other path mutates `Group.members` directly.
 */

import type { Group } from '@weasel-js/core';

/** Mutable reference shape — matches how App.tsx stores its `groupsRef`. */
export interface GroupsRef {
  current: Group[];
}

/** The subset of the App.tsx adapter that owns the group model. Exported as
 *  a factory so tests can exercise the same logic the app uses. */
export interface GroupModelAdapter {
  getGroup(id: string): Group | undefined;
  getGroupsForMember(id: string): string[];
  insertGroup(g: Group): void;
  removeGroup(id: string): void;
  addToGroup(gid: string, ids: string[]): void;
  removeFromGroup(gid: string, ids: string[]): void;
}

/**
 * Strip the given member ids from every group except `targetGroupId`.
 * Mutates each affected group's `members` array. No-op for empty input.
 *
 * WeaselDraw forbids multi-group membership at the model level. When a
 * group claims members, this helper yanks those members out of any group
 * that previously held them. The persistence-boundary check in
 * `objsToSvgNodes` (svgInterop.ts) is defense-in-depth on top of this; with
 * the strip in place it should never fire in practice.
 */
export function stripPriorMemberships(
  groups: Group[],
  memberIds: readonly string[],
  targetGroupId: string,
): void {
  if (memberIds.length === 0) return;
  const toStrip = new Set(memberIds);
  for (const g of groups) {
    if (g.id === targetGroupId) continue;
    if (g.members.some((m) => toStrip.has(m))) {
      g.members = g.members.filter((m) => !toStrip.has(m));
    }
  }
}

export function createGroupAdapter(groupsRef: GroupsRef): GroupModelAdapter {
  return {
    getGroup: (id) => groupsRef.current.find((g) => g.id === id),
    getGroupsForMember: (id) =>
      groupsRef.current.filter((g) => g.members.includes(id)).map((g) => g.id),
    insertGroup: (g) => {
      if (groupsRef.current.find((x) => x.id === g.id)) return;
      stripPriorMemberships(groupsRef.current, g.members, g.id);
      groupsRef.current.push({ ...g, members: [...g.members] });
    },
    removeGroup: (id) => {
      const i = groupsRef.current.findIndex((g) => g.id === id);
      if (i >= 0) groupsRef.current.splice(i, 1);
    },
    addToGroup: (gid, ids) => {
      const g = groupsRef.current.find((x) => x.id === gid);
      if (!g) return;
      stripPriorMemberships(groupsRef.current, ids, gid);
      for (const id of ids) if (!g.members.includes(id)) g.members.push(id);
    },
    removeFromGroup: (gid, ids) => {
      const g = groupsRef.current.find((x) => x.id === gid);
      if (!g) return;
      g.members = g.members.filter((m) => !ids.includes(m));
    },
  };
}
