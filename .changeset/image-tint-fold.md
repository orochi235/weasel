---
'@weasel-js/renderer': patch
---

An image or a run of sprites inside a group whose `colorMatrix` only scales channels, each by 0 to 1 with no bias, no longer ends the batch: the scale rides the quad's vertices, as a solid's mapped color already did. Fading or darkening tints over an atlas now draw in the run with their neighbors. The pixels are the same; a matrix with a bias, a channel mix, or a scale past 1 still draws under the uniform.
