---
'@weasel-js/ui': patch
---

Clicking a property row's label reaches its control again when the row has a `description`. `PropertyRow`'s `<label>` had no `for`, so it belonged to the first labelable element inside it, the ⓘ help button; `CheckboxRow`, `TextRow`, `NumberRow`, `SelectRow` and `ColorRow` now point it at their control. `ColorRow`'s opacity slider is named `<label> opacity`. A direct `PropertyRow` with a `description` should pass `htmlFor` for the same reason.
