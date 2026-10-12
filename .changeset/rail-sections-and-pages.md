---
'@weasel-js/ui': patch
---

Breaking: `PrefsForm` and `PrefsDialog` no longer take `subPages`. In the rail layout each nested group now decides for itself, from its own `as`. Unset or `'section'`, it is a section of the page that holds it. `as: 'page'` gives it a rail entry that opens a page of its own, holding its leaves, tabs, panels, and sections; a page with none of those opens the first page nested in it. A caller that passed `subPages` writes `as: 'page'` on each nested group that should keep a page of its own. Without it, those groups are sections of their parent's page.

A page has a rail entry at any depth. A section has one only when it sits directly on a page, and choosing it scrolls that page to it; a section inside a section is drawn on the page under its parent with no entry, so a rail still stops one level under each page. A group that deserves an entry further down says `as: 'page'`. A page inside a section with no entry nests under the nearest entry above it.

One rail can hold both kinds, and marks both. The open page's entry is `aria-current="page"` and the entry of the section in view is `aria-current="location"`. `data-rail-mark="current"` is the strong mark, on the section in view, or on the open page while none of its sections is; under a current section the open page carries `data-rail-mark="open"`, a weaker one. `foldable` is unchanged.

`PrefRailItem` has `page` in place of `section`: the path of the page the entry's group is drawn on, which is the entry's own path when choosing it opens a page. `prefRailItems` takes the root alone, and `depth` counts the entries above an entry, not the groups.

A row or a section scrolled to inside a section, as a form does for `selected`, stops below that section's stuck heading; before, it stopped under it.

`PrefSchemaEditor`'s live preview draws a nested group the way a form given the schema would, and opens a selected group's page when `as: 'page'` gives it one.
