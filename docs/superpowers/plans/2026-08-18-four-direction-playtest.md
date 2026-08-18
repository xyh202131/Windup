# Four-direction Playtest Implementation Plan

## Goal

Make Playtest support real two-dimensional movement while preserving existing side-only assets:

- `W/A/S/D` move the character on the stage and can be combined diagonally.
- Left and right reuse one `side` sequence; right is the source orientation and left is mirrored.
- Up and down use independent `back` and `front` sequences.
- `Space` triggers jump and `Shift` triggers crouch, with configurable action assignments.
- Missing directional assets disable only the unsupported axis; they never substitute a visually incorrect sequence.

## Data Contract

1. Extend character actions with optional directional sequences (`side`, `front`, `back`).
2. Treat the legacy top-level `frames` as the `side` sequence for backward compatibility.
3. Preserve directional sequences through the backend character JSON model and frontend DTO mapping.
4. Export one package sequence per available direction instead of flattening to `default`.

## Runtime

1. Add `y` position and four held movement directions.
2. Normalize diagonal movement so it is not faster than cardinal movement.
3. Choose the rendered sequence from the latest non-zero movement axis.
4. Preserve animation progress when only direction changes; clamp the frame index to the selected sequence.
5. Keep non-locomotion actions stationary while still selecting their available directional sequence.
6. Disable W/S movement when the active locomotion action lacks `front` or `back` frames.

## UI

1. Keep movement keys fixed as `W/A/S/D`.
2. Limit configurable action bindings to `Space` and `Shift`.
3. Show unavailable directions/actions as disabled controls.
4. Render stage depth through vertical position and stable sprite layering.

## Generation Boundary

1. Expose direction in action-generation input and result contracts.
2. Generate only against a matching directional master image.
3. Do not synthesize front/back from a side master; surface missing masters as an explicit incomplete asset state.

## Verification

1. Character DTO round-trip tests for legacy and directional assets.
2. Runtime tests for cardinal movement, diagonal normalization, bounds, facing, and fallback behavior.
3. Stage tests for two-dimensional transforms and mirroring.
4. Export tests for `side/front/back` package sequences.
5. Focused tests, coverage, typecheck, build, and desktop/mobile Playtest screenshots.
