import { describe, expect, it } from 'vitest'

import type { Character } from '@/entities'

import { createPlaytestModel } from './model'

const character: Character = {
  id: '51',
  projectId: '42',
  workflowRunId: 'workflow-run-51',
  name: '轻装信使',
  description: null,
  referenceImageUrl: null,
  dataVersion: 1,
  status: 1,
  outfits: [
    {
      id: 'outfit-default',
      characterId: '51',
      name: '常态造型',
      description: null,
      previewUrl: null,
      actions: [
        {
          id: 'idle',
          outfitId: 'outfit-default',
          name: '待机',
          type: 'idle',
          loop: true,
          fps: 8,
          frameCount: 1,
          frames: [{ index: 0, imageUrl: '/idle-01.png', durationMs: null }],
        },
        {
          id: 'walk',
          outfitId: 'outfit-default',
          name: '行走',
          type: 'walk',
          loop: true,
          fps: 10,
          frameCount: 3,
          frames: [
            { index: 2, imageUrl: '/walk-03.png', durationMs: 100 },
            { index: 0, imageUrl: '/walk-01.png', durationMs: 100 },
            { index: 1, imageUrl: '/walk-02.png', durationMs: 100 },
          ],
        },
      ],
    },
  ],
}

describe('createPlaytestModel', () => {
  it('keeps only the fields needed to control and render an action', () => {
    const result = createPlaytestModel(character, 'outfit-default')

    expect(result.ok && result.model.characterId).toBe('51')
    expect(result.ok && result.model.outfitName).toBe('常态造型')
    expect(result.ok && result.model.actions[0]).toEqual({
      id: 'idle',
      name: '待机',
      type: 'idle',
      loop: true,
      // durationMs 为 null 时按所属动作的 fps 换算，不用前端常量顶上。
      frames: [{ imageUrl: '/idle-01.png', durationMs: 125 }],
      sequences: {
        side: [{ imageUrl: '/idle-01.png', durationMs: 125 }],
      },
    })
  })

  it('orders frames by the backend index instead of array position', () => {
    const result = createPlaytestModel(character, 'outfit-default')

    expect(result.ok && result.model.actions[1]?.frames.map((frame) => frame.imageUrl)).toEqual([
      '/walk-01.png',
      '/walk-02.png',
      '/walk-03.png',
    ])
  })

  it('treats legacy frames as side and keeps independent front and back sequences', () => {
    const directionalCharacter = structuredClone(character) as Character & {
      outfits: Array<{
        actions: Array<{
          sequences?: Array<{
            direction: 'side' | 'front' | 'back'
            frameCount: number
            frames: Array<{ index: number; imageUrl: string; durationMs: number | null }>
          }>
        }>
      }>
    }
    directionalCharacter.outfits[0]!.actions[1]!.sequences = [
      {
        direction: 'front',
        frameCount: 2,
        frames: [
          { index: 1, imageUrl: '/walk-front-02.png', durationMs: 90 },
          { index: 0, imageUrl: '/walk-front-01.png', durationMs: 90 },
        ],
      },
      {
        direction: 'back',
        frameCount: 1,
        frames: [{ index: 0, imageUrl: '/walk-back-01.png', durationMs: 110 }],
      },
    ]

    const result = createPlaytestModel(directionalCharacter, 'outfit-default')
    const walk = result.ok ? result.model.actions.find((action) => action.id === 'walk') : undefined

    expect(walk?.sequences?.side?.map((frame) => frame.imageUrl)).toEqual([
      '/walk-01.png',
      '/walk-02.png',
      '/walk-03.png',
    ])
    expect(walk?.sequences?.front?.map((frame) => frame.imageUrl)).toEqual([
      '/walk-front-01.png',
      '/walk-front-02.png',
    ])
    expect(walk?.sequences?.back?.map((frame) => frame.imageUrl)).toEqual(['/walk-back-01.png'])
  })

  it('drops actions that have no frames to play', () => {
    const withEmptyAction = structuredClone(character)
    withEmptyAction.outfits[0]!.actions[1]!.frames = []

    const result = createPlaytestModel(withEmptyAction, 'outfit-default')

    expect(result.ok && result.model.actions.map((action) => action.id)).toEqual(['idle'])
  })

  it('rejects a missing outfit instead of falling back to another one', () => {
    expect(createPlaytestModel(character, 'missing')).toEqual({
      ok: false,
      reason: 'outfit_not_found',
    })
  })

  it('clamps an unusably short frame duration before it reaches the animation loop', () => {
    const tinyDurationCharacter = structuredClone(character)
    tinyDurationCharacter.outfits[0]!.actions[0]!.frames[0]!.durationMs = 0.001

    const result = createPlaytestModel(tinyDurationCharacter, 'outfit-default')

    expect(result.ok && result.model.actions[0]?.frames[0]?.durationMs).toBe(1)
  })
})
