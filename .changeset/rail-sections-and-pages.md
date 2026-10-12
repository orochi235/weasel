---
'@weasel-js/ui': patch
---

Breaking: `PrefsForm` and `PrefsDialog` no longer take `subPages`. In the rail layout each nested group now decides for itself, from its own `as`. Unset or `'section'`, it is a section of the page that holds it, with a rail entry that scrolls that page to it. `as: 'page'` gives it a rail entry that opens a page of its own, holding its leaves, tabs, panels, and sections; a page with none of those opens the first page nested in it. A caller that passed `subPages` writes `as: 'page'` on each nested group that should keep a page of its own. Without it, those groups are sections of their parent's page.

This holds at any depth, so a rail without `subPages` changes too: a section inside a section now has a rail entry, where the rail used to stop one level down.

One rail can hold both kinds, and marks both. The open page's entry is `aria-current="page"` and the entry of the section in view is `aria-current="location"`. `data-rail-mark="current"` is the strong mark, on the section in view, or on the open page while none of its sections is; under a current section the open page carries `data-rail-mark="open"`, a weaker one. `foldable` is unchanged.

`PrefRailItem` has `page` in place of `section`: the path of the page the entry's group is drawn on, which is the entry's own path when choosing it opens a page. `prefRailItems` takes the root alone. `useScrollSpy` takes `covered`, how much of the container's top a stuck heading hides while a given section is at it.

`PrefSchemaEditor`'s live preview draws a nested group the way a form given the schema would, and opens a selected group's page when `as: 'page'` gives it one.
