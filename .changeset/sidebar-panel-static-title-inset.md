---
'@weasel-js/ui': patch
---

A `SidebarPanel` whose title is static (no `onToggleCollapse`) now insets that title the way a collapsible one is inset. Since the panel's horizontal padding moved onto the title row's controls, a static title sat flush against the panel edge with no vertical padding either; both kinds of title now share one box, so they line up and a panel's header row is the same height whether or not it collapses.
