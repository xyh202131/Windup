import type { ActionDirection, ActionType, Character, Frame } from '@/entities'

export interface PlaytestFrame {
  readonly imageUrl: string
  readonly durationMs: number
}

export interface PlaytestAction {
  readonly id: string
  readonly name: string
  readonly type: ActionType
  /** 一次性动作播完停在末帧；只有循环动作才回到首帧。 */
  readonly loop: boolean
  /** side 始终存在；front/back 只在真实方向资产存在时提供。 */
  readonly sequences?: Readonly<Partial<Record<ActionDirection, readonly PlaytestFrame[]>>>
  /** 旧调用方的侧向序列别名。 */
  readonly frames: readonly PlaytestFrame[]
}

export interface PlaytestModel {
  readonly characterId: string
  readonly outfitName: string
  readonly actions: readonly PlaytestAction[]
}

export type PlaytestModelResult =
  | { readonly ok: true; readonly model: PlaytestModel }
  | { readonly ok: false; readonly reason: 'outfit_not_found' }

const DEFAULT_FRAME_DURATION_MS = 100

function frameDuration(durationMs: number | null, fps: number): number {
  if (durationMs !== null && Number.isFinite(durationMs) && durationMs > 0) {
    return Math.max(1, durationMs)
  }
  if (Number.isFinite(fps) && fps > 0) return Math.max(1, Math.round(1000 / fps))
  return DEFAULT_FRAME_DURATION_MS
}

/**
 * 播放顺序由 Frame.index 决定，不是数组下标。
 * 后端整棵下发资产树，数组顺序没有被契约保证；照数组播的话，顺序一变动画就乱，
 * 而且乱得不报错。排序在这里做一次，运行时之后只按数组下标推进。
 */
function orderedFrames(frames: readonly Frame[]): readonly Frame[] {
  return [...frames].sort((left, right) => left.index - right.index)
}

function playtestFrames(frames: readonly Frame[], fps: number): readonly PlaytestFrame[] {
  return orderedFrames(frames).map((frame) => ({
    imageUrl: frame.imageUrl,
    durationMs: frameDuration(frame.durationMs, fps),
  }))
}

/** Playtest 只保留渲染和操控所需的数据；审核、生成与根位移仍属于各自原有边界。 */
export function createPlaytestModel(character: Character, outfitId: string): PlaytestModelResult {
  const outfit = character.outfits.find((candidate) => candidate.id === outfitId)
  if (outfit === undefined) return { ok: false, reason: 'outfit_not_found' }

  return {
    ok: true,
    model: {
      characterId: character.id,
      outfitName: outfit.name,
      actions: outfit.actions
        .filter(
          (action) =>
            action.frames.length > 0 ||
            action.sequences?.some((sequence) => sequence.frames.length > 0) === true,
        )
        .map((action) => {
          const side = playtestFrames(
            action.sequences?.find((sequence) => sequence.direction === 'side')?.frames ??
              action.frames,
            action.fps,
          )
          const sequences = Object.fromEntries(
            [
              ['side', side] as const,
              ...(action.sequences ?? []).map(
                (sequence) =>
                  [sequence.direction, playtestFrames(sequence.frames, action.fps)] as const,
              ),
            ].filter(([, frames]) => frames.length > 0),
          ) as Partial<Record<ActionDirection, readonly PlaytestFrame[]>>
          const fallbackFrames = side.length > 0 ? side : (Object.values(sequences)[0] ?? [])

          return {
            id: action.id,
            name: action.name,
            type: action.type,
            loop: action.loop,
            sequences,
            frames: fallbackFrames,
          }
        }),
    },
  }
}
