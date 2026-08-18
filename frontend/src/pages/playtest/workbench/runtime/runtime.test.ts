import { describe, expect, it } from 'vitest'

import type { PlaytestActionBindings } from '../bindings'
import type { PlaytestAction } from '../model'
import {
  advanceRuntime,
  createRuntime,
  framesForFacing,
  selectRuntimeAction,
  setControlInput,
  setDirectionInput,
  setMovementInput,
} from './runtime'

const actions: readonly PlaytestAction[] = [
  {
    id: 'idle',
    name: '待机',
    type: 'idle',
    loop: true,
    frames: [
      { imageUrl: '/idle-1.png', durationMs: 100 },
      { imageUrl: '/idle-2.png', durationMs: 100 },
    ],
  },
  {
    id: 'walk',
    name: '行走',
    type: 'walk',
    loop: true,
    frames: [
      { imageUrl: '/walk-1.png', durationMs: 80 },
      { imageUrl: '/walk-2.png', durationMs: 120 },
    ],
  },
  {
    id: 'attack',
    name: '攻击',
    type: 'attack',
    loop: false,
    frames: [
      { imageUrl: '/attack-1.png', durationMs: 150 },
      { imageUrl: '/attack-2.png', durationMs: 150 },
    ],
  },
]

const bindings: PlaytestActionBindings = {
  space: 'attack',
  shift: null,
}

const directionalActions: readonly PlaytestAction[] = actions.map((action) =>
  action.id === 'walk'
    ? {
        ...action,
        sequences: {
          side: action.frames,
          front: [
            { imageUrl: '/walk-front-1.png', durationMs: 80 },
            { imageUrl: '/walk-front-2.png', durationMs: 120 },
          ],
          back: [
            { imageUrl: '/walk-back-1.png', durationMs: 80 },
            { imageUrl: '/walk-back-2.png', durationMs: 120 },
          ],
        },
      }
    : { ...action, sequences: { side: action.frames } },
)

describe('playtest runtime', () => {
  it('moves diagonally at the cardinal speed and selects the last pressed direction', () => {
    const idle = createRuntime(directionalActions, 'idle')
    const right = setMovementInput(idle, directionalActions, 'right', true)
    const upRight = setMovementInput(right, directionalActions, 'up', true)
    const advanced = advanceRuntime(
      upRight,
      directionalActions,
      100,
      { minX: -100, maxX: 100, minY: -100, maxY: 100 },
      150,
    )

    expect(advanced.x).toBeCloseTo(10.607, 3)
    expect(advanced.y).toBeCloseTo(-10.607, 3)
    expect(advanced).toMatchObject({ facing: 'back', held: { right: true, up: true } })
  })

  it('uses front and back sequences while horizontal facing reuses side frames', () => {
    const walk = directionalActions.find((action) => action.id === 'walk')!

    expect(framesForFacing(walk, 'left')).toBe(walk.sequences?.side)
    expect(framesForFacing(walk, 'right')).toBe(walk.sequences?.side)
    expect(framesForFacing(walk, 'front')?.[0]?.imageUrl).toBe('/walk-front-1.png')
    expect(framesForFacing(walk, 'back')?.[0]?.imageUrl).toBe('/walk-back-1.png')
  })

  it('keeps animation progress when movement changes to another available direction', () => {
    const walking = setMovementInput(
      createRuntime(directionalActions, 'walk'),
      directionalActions,
      'right',
      true,
    )
    const advanced = advanceRuntime(
      walking,
      directionalActions,
      90,
      { minX: -100, maxX: 100, minY: -100, maxY: 100 },
      0,
    )
    const turned = setMovementInput(advanced, directionalActions, 'down', true)

    expect(turned).toMatchObject({ facing: 'front', frameIndex: 1, frameElapsedMs: 10 })
  })

  it('does not accept vertical movement when only a legacy side sequence exists', () => {
    const sideOnly = createRuntime(actions, 'walk')

    expect(setMovementInput(sideOnly, actions, 'up', true)).toBe(sideOnly)
    expect(setMovementInput(sideOnly, actions, 'down', true)).toBe(sideOnly)
  })

  it('accepts an action whose only playable frames are directional', () => {
    const frontOnly: readonly PlaytestAction[] = [
      {
        id: 'front-idle',
        name: '正面待机',
        type: 'idle',
        loop: true,
        frames: [],
        sequences: {
          front: [{ imageUrl: '/front-idle.png', durationMs: 100 }],
        },
      },
    ]

    expect(createRuntime(frontOnly, 'front-idle').actionId).toBe('front-idle')
  })
  it('binds walk while a direction is held and returns to idle on release', () => {
    const idle = createRuntime(actions, 'idle')
    const walking = setDirectionInput(idle, actions, 'right', true)
    const released = setDirectionInput(walking, actions, 'right', false)

    expect(walking).toMatchObject({
      actionId: 'walk',
      frameIndex: 0,
      facing: 'right',
      held: { left: false, right: true },
    })
    expect(released).toMatchObject({
      actionId: 'idle',
      frameIndex: 0,
      facing: 'right',
      held: { left: false, right: false },
    })
  })

  it('moves continuously from elapsed time while animation uses its own frame durations', () => {
    const walking = setDirectionInput(createRuntime(actions, 'idle'), actions, 'right', true)
    const firstTick = advanceRuntime(walking, actions, 40, { minX: -100, maxX: 100 }, 150)
    const secondTick = advanceRuntime(firstTick, actions, 40, { minX: -100, maxX: 100 }, 150)

    expect(firstTick).toMatchObject({ x: 6, frameIndex: 0, frameElapsedMs: 40 })
    expect(secondTick).toMatchObject({ x: 12, frameIndex: 1, frameElapsedMs: 0 })
  })

  it('turns without moving when the active action is not walk or run', () => {
    const nonLocomotionActions = actions.filter((action) => action.type !== 'walk')
    const attacking = selectRuntimeAction(
      createRuntime(nonLocomotionActions, 'idle'),
      nonLocomotionActions,
      'attack',
    )
    const facingLeft = setDirectionInput(attacking, nonLocomotionActions, 'left', true)
    const advanced = advanceRuntime(
      facingLeft,
      nonLocomotionActions,
      100,
      { minX: -100, maxX: 100 },
      150,
    )

    expect(advanced).toMatchObject({ x: 0, facing: 'left', actionId: 'attack' })
  })

  it('keeps A and D reserved for movement outside the action binding contract', () => {
    const walkingLeft = setMovementInput(createRuntime(actions, 'idle'), actions, 'left', true)
    const advanced = advanceRuntime(walkingLeft, actions, 100, { minX: -100, maxX: 100 }, 150)

    expect(advanced).toMatchObject({ actionId: 'walk', facing: 'left', x: -15 })
  })

  it('triggers an assigned vertical action and ignores an unassigned control', () => {
    const idle = createRuntime(actions, 'idle')
    const attacking = setControlInput(idle, actions, bindings, 'space', true)

    expect(attacking).toMatchObject({ actionId: 'attack', frameIndex: 0 })
    expect(setControlInput(idle, actions, bindings, 'shift', true)).toBe(idle)
    expect(setControlInput(attacking, actions, bindings, 'space', false)).toBe(attacking)
    expect(setControlInput(idle, actions, { ...bindings, space: 'missing' }, 'space', true)).toBe(
      idle,
    )
    expect(setControlInput(idle, actions, { ...bindings, space: 'idle' }, 'space', true)).toBe(idle)
  })

  it('restarts a completed one-shot action when its assigned key is pressed again', () => {
    const attacking = setControlInput(
      createRuntime(actions, 'idle'),
      actions,
      bindings,
      'space',
      true,
    )
    const completed = advanceRuntime(attacking, actions, 400, { minX: -100, maxX: 100 }, 150)
    const restarted = setControlInput(completed, actions, bindings, 'space', true)

    expect(completed).toMatchObject({ actionId: 'attack', frameIndex: 1, frameElapsedMs: 150 })
    expect(restarted).toMatchObject({ actionId: 'attack', frameIndex: 0, frameElapsedMs: 0 })
  })

  it('loops a looping action back to its first frame', () => {
    const idle = createRuntime(actions, 'idle')
    const wrapped = advanceRuntime(idle, actions, 50, { minX: 0, maxX: 0 }, 0)
    const looped = [0, 1, 2].reduce(
      (current) => advanceRuntime(current, actions, 50, { minX: 0, maxX: 0 }, 0),
      wrapped,
    )

    expect(looped.frameIndex).toBe(0)
  })

  it('clamps zero duration frames inside the playback loop', () => {
    const zeroDurationActions: readonly PlaytestAction[] = [
      {
        id: 'idle',
        name: '待机',
        type: 'idle',
        loop: true,
        frames: [
          { imageUrl: '/idle-1.png', durationMs: 0 },
          { imageUrl: '/idle-2.png', durationMs: 100 },
        ],
      },
    ]
    const advanced = advanceRuntime(
      createRuntime(zeroDurationActions, 'idle'),
      zeroDurationActions,
      5,
      { minX: 0, maxX: 0 },
      0,
    )

    expect(advanced).toMatchObject({ frameIndex: 1, frameElapsedMs: 4 })
  })

  it('stops a one-shot action on its last frame instead of restarting it', () => {
    const attacking = selectRuntimeAction(createRuntime(actions, null), actions, 'attack')
    const played = [0, 1, 2, 3, 4, 5, 6, 7].reduce(
      (current) => advanceRuntime(current, actions, 50, { minX: 0, maxX: 0 }, 0),
      attacking,
    )

    expect(played.frameIndex).toBe(1)
  })

  it('keeps the same runtime reference when a stopped one-shot action does not change', () => {
    const stopped = {
      ...selectRuntimeAction(createRuntime(actions, null), actions, 'attack'),
      frameIndex: 1,
      frameElapsedMs: 150,
    }

    expect(advanceRuntime(stopped, actions, 50, { minX: 0, maxX: 0 }, 0)).toBe(stopped)
  })

  it('keeps every bound action directly selectable without extra playback state', () => {
    const selected = selectRuntimeAction(createRuntime(actions, null), actions, 'attack')

    expect(selected).toMatchObject({
      actionId: 'attack',
      frameIndex: 0,
      frameElapsedMs: 0,
    })
  })
})
