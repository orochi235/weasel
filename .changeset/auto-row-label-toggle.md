---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

Clicking a property row's **label** now toggles whether the row is auto. That
replaces the hover-revealed pin dot — `PinDot` is removed — and labkit's
shift-click gesture, and with them `<PropertyRow data-auto-path>`, which
existed only to route that gesture.

An auto row now hides its control rather than ghosting it, keeping the box so
the row does not resize on the toggle, and reads out the bare word `auto`;
labkit's `auto · 18` form is gone. A hidden control is out of reach of the
pointer and the tab ring, which is also what takes it out of the
accessibility tree — a test reading an auto row's value has to read the
element, not the role.
