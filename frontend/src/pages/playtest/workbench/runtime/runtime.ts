import type { PlaytestActionBindings, PlaytestControlKey } from '../bindings'
import type { PlaytestAction, PlaytestFrame } from '../model'

export type Direction = 'left' | 'right'
export type MovementDirection = 'up' | 'down' | Direction
export type Facing = 'left' | 'right' | 'front' | 'back'

export interface StageBounds {
  readonly minX: number
  readonly maxX: number
  readonly minY?: number
  readonly maxY?: number
}

export interface PlaytestRuntime {
  readonly actionId: string | null
  readonly frameIndex: number
  readonly frameElapsedMs: number
  readonly x: number
  readonly y: number
  readonly facing: Facing
  readonly held: Readonly<Record<MovementDirection, boolean>>
}

const EMPTY_HELD: PlaytestRuntime['held'] = {
  up: false,
  down: false,
  left: false,
  right: false,
}

export function framesForFacing(
  action: PlaytestAction,
  facing: Facing,
): readonly PlaytestFrame[] | undefined {
  if (facing === 'left' || facing === 'right') {
    return action.sequences?.side ?? action.frames
  }
  return action.sequences?.[facing]
}

function hasFrames(action: PlaytestAction): boolean {
  return (
    action.frames.length > 0 ||
    Object.values(action.sequences ?? {}).some((frames) => (frames?.length ?? 0) > 0)
  )
}

function actionById(
  actions: readonly PlaytestAction[],
  actionId: string | null,
): PlaytestAction | undefined {
  return actions.find((action) => action.id === actionId && hasFrames(action))
}

function actionByType(
  actions: readonly PlaytestAction[],
  type: PlaytestAction['type'],
): PlaytestAction | undefined {
  return actions.find((action) => action.type === type && hasFrames(action))
}

function initialAction(
  actions: readonly PlaytestAction[],
  requestedActionId: string | null,
): PlaytestAction | undefined {
  return (
    actionById(actions, requestedActionId) ??
    actionByType(actions, 'idle') ??
    actions.find(hasFrames)
  )
}

export function createRuntime(
  actions: readonly PlaytestAction[],
  initialActionId: string | null,
): PlaytestRuntime {
  return {
    actionId: initialAction(actions, initialActionId)?.id ?? null,
    frameIndex: 0,
    frameElapsedMs: 0,
    x: 0,
    y: 0,
    facing: 'right',
    held: EMPTY_HELD,
  }
}

export function selectRuntimeAction(
  runtime: PlaytestRuntime,
  actions: readonly PlaytestAction[],
  actionId: string,
): PlaytestRuntime {
  const action = actionById(actions, actionId)
  if (action === undefined || action.id === runtime.actionId) return runtime

  return {
    ...runtime,
    actionId: action.id,
    frameIndex: 0,
    frameElapsedMs: 0,
  }
}

function axis(negative: boolean, positive: boolean): -1 | 0 | 1 {
  if (negative === positive) return 0
  return negative ? -1 : 1
}

function horizontalAxis(held: PlaytestRuntime['held']): -1 | 0 | 1 {
  return axis(held.left, held.right)
}

function verticalAxis(held: PlaytestRuntime['held']): -1 | 0 | 1 {
  return axis(held.up, held.down)
}

function frameDurationMs(frames: readonly PlaytestFrame[], frameIndex: number): number {
  return Math.max(1, frames[frameIndex]?.durationMs ?? 1)
}

function isLocomotionAction(action: PlaytestAction): boolean {
  return action.type === 'walk' || action.type === 'run'
}

function facingForDirection(direction: MovementDirection): Facing {
  if (direction === 'up') return 'back'
  if (direction === 'down') return 'front'
  return direction
}

function supportedDirection(action: PlaytestAction, direction: MovementDirection): boolean {
  return (framesForFacing(action, facingForDirection(direction))?.length ?? 0) > 0
}

function remainingFacing(held: PlaytestRuntime['held'], fallback: Facing): Facing {
  if (held.left) return 'left'
  if (held.right) return 'right'
  if (held.up) return 'back'
  if (held.down) return 'front'
  return fallback
}

export function setMovementInput(
  runtime: PlaytestRuntime,
  actions: readonly PlaytestAction[],
  direction: MovementDirection,
  pressed: boolean,
): PlaytestRuntime {
  if (runtime.held[direction] === pressed) return runtime

  const activeAction = actionById(actions, runtime.actionId)
  const locomotion = actionByType(actions, 'walk') ?? actionByType(actions, 'run')
  const directionAction = locomotion ?? activeAction
  if (
    pressed &&
    (directionAction === undefined || !supportedDirection(directionAction, direction))
  ) {
    return runtime
  }

  const held = { ...runtime.held, [direction]: pressed }
  const isMoving = horizontalAxis(held) !== 0 || verticalAxis(held) !== 0
  const shouldReturnToIdle =
    !isMoving && activeAction !== undefined && isLocomotionAction(activeAction)
  const nextAction = shouldReturnToIdle
    ? actionByType(actions, 'idle')
    : isMoving
      ? locomotion
      : activeAction
  const nextActionId = nextAction?.id ?? runtime.actionId
  const nextFacing = pressed
    ? facingForDirection(direction)
    : runtime.facing === facingForDirection(direction)
      ? remainingFacing(held, runtime.facing)
      : runtime.facing

  return {
    ...runtime,
    held,
    facing: nextFacing,
    actionId: nextActionId,
    frameIndex: nextActionId === runtime.actionId ? runtime.frameIndex : 0,
    frameElapsedMs: nextActionId === runtime.actionId ? runtime.frameElapsedMs : 0,
  }
}

export function setDirectionInput(
  runtime: PlaytestRuntime,
  actions: readonly PlaytestAction[],
  direction: Direction,
  pressed: boolean,
): PlaytestRuntime {
  return setMovementInput(runtime, actions, direction, pressed)
}

export function setControlInput(
  runtime: PlaytestRuntime,
  actions: readonly PlaytestAction[],
  bindings: PlaytestActionBindings,
  key: PlaytestControlKey,
  pressed: boolean,
): PlaytestRuntime {
  if (!pressed || bindings[key] === null) return runtime
  const action = actionById(actions, bindings[key])
  if (action === undefined) return runtime
  if (action.id !== runtime.actionId) return selectRuntimeAction(runtime, actions, action.id)
  if (action.loop) return runtime
  return { ...runtime, frameIndex: 0, frameElapsedMs: 0 }
}

export function advanceRuntime(
  runtime: PlaytestRuntime,
  actions: readonly PlaytestAction[],
  deltaMs: number,
  bounds: StageBounds,
  movementSpeed: number,
): PlaytestRuntime {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return runtime

  const action = actionById(actions, runtime.actionId)
  if (action === undefined) return runtime
  const frames = framesForFacing(action, runtime.facing) ?? action.frames
  if (frames.length === 0) return runtime

  const rawX = isLocomotionAction(action) ? horizontalAxis(runtime.held) : 0
  const rawY = isLocomotionAction(action) ? verticalAxis(runtime.held) : 0
  const magnitude = rawX !== 0 && rawY !== 0 ? Math.SQRT1_2 : 1
  const minY = bounds.minY ?? runtime.y
  const maxY = bounds.maxY ?? runtime.y
  const nextX = Math.min(
    bounds.maxX,
    Math.max(bounds.minX, runtime.x + (rawX * magnitude * movementSpeed * deltaMs) / 1000),
  )
  const nextY = Math.min(
    maxY,
    Math.max(minY, runtime.y + (rawY * magnitude * movementSpeed * deltaMs) / 1000),
  )
  const lastFrameIndex = frames.length - 1
  let frameIndex = Math.min(runtime.frameIndex, lastFrameIndex)
  let frameElapsedMs = runtime.frameElapsedMs + deltaMs

  let currentFrameDurationMs = frameDurationMs(frames, frameIndex)
  while (frameElapsedMs >= currentFrameDurationMs) {
    if (!action.loop && frameIndex === lastFrameIndex) {
      frameElapsedMs = currentFrameDurationMs
      break
    }
    frameElapsedMs -= currentFrameDurationMs
    frameIndex = (frameIndex + 1) % frames.length
    currentFrameDurationMs = frameDurationMs(frames, frameIndex)
  }

  if (
    nextX === runtime.x &&
    nextY === runtime.y &&
    frameIndex === runtime.frameIndex &&
    frameElapsedMs === runtime.frameElapsedMs
  ) {
    return runtime
  }

  return { ...runtime, x: nextX, y: nextY, frameIndex, frameElapsedMs }
}
