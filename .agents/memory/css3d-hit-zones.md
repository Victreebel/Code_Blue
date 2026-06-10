---
name: CSS 3D hit zones
description: Why patient body hotspots use projected 2D overlays, not 3D rotated divs
---

The room uses CSS 3D `preserve-3d` for furniture. Flat panels facing the viewer (translateZ only) work fine as click targets. However, planes rotated with `rotateX(-90deg)` (floor/mattress surface) are unreliable for pointer events across browsers — the hit area does not match the visual position after perspective transform.

**Why:** The mattress is a `rotateX(-90deg)` div; clicking it in perspective view doesn't map correctly to CSS pointer-events.

**How to apply:** Any hotspot that sits on a horizontal surface (bed mattress, floor) should be placed in the 2D projected overlay layer, not the 3D scene. Use the `project(x3d, z3d)` helper to compute screen position, then subtract `BED_FH * s` to lift the dot to mattress surface height. See the patient body hotspots block in FirstPersonRoom.tsx.
