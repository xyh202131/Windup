import type { PlaytestAction } from './model'

export const PLAYTEST_CONTROL_KEYS = ['a', 'd', 'space', 'shift'] as const

export type PlaytestControlKey = (typeof PLAYTEST_CONTROL_KEYS)[number]
export type PlaytestActionBindings = Readonly<Record<PlaytestControlKey, string | null>>

const CROUCH_TYPES = new Set(['crouch', 'duck', 'squat'])

export function createDefaultActionBindings(
  actions: readonly PlaytestAction[],
): PlaytestActionBindings {
  const locomotion =
    findAction(actions, (action) => action.type === 'walk') ??
    findAction(actions, (action) => action.type === 'run')

  return {
    a: locomotion?.id ?? null,
    d: locomotion?.id ?? null,
    space: findAction(actions, (action) => action.type === 'jump')?.id ?? null,
    shift: findAction(actions, (action) => CROUCH_TYPES.has(action.type))?.id ?? null,
  }
}

function findAction(
  actions: readonly PlaytestAction[],
  predicate: (action: PlaytestAction) => boolean,
) {
  return actions.find((action) => action.frames.length > 0 && predicate(action))
}
