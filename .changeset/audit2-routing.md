---
'@weasel-js/routing': patch
---

A keystroke the dispatcher holding the keys does not take now goes on to the other dispatchers listening on the same element, so in a labkit 3D lab Shift+F10 and the ContextMenu key open the trial camera's menu after a click in the pane.
A wheel over a surface nested inside another dispatcher's surface goes to the nested one first, and to the outer one only when the nested one leaves it.
A press or a right-click on a nested surface no longer also runs the click, drag or menu bindings of the surface around it; a right-click the nested one does not take still reaches the outer one.
A dispatcher with `claimKeys` takes the keys again when the registry it dispatches on changes.
