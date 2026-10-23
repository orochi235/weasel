---
"@weasel-js/ui": patch
---

`PageTabs` no longer points its lit tab at a panel that does not exist. React Aria set the lit tab's `aria-controls` to the id of a tab panel `PageTabs` never draws, so a screen reader was sent to nothing. Now no tab names a panel unless the new `panelId` prop gives the id of the element that shows the current page, which the lit tab then names.
