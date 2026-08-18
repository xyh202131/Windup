// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PlaytestActionBindings } from '../bindings'
import type { PlaytestAction } from '../model'
import { preloadActionFrames, usePlaytestRuntime } from './use-playtest-runtime'

afterEach(() => {
  vi.unstubAllGlobals()
})

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
      { imageUrl: '/walk-1.png', durationMs: 100 },
      { imageUrl: '/idle-1.png', durationMs: 100 },
    ],
  },
  {
    id: 'attack',
    name: '攻击',
    type: 'attack',
    loop: false,
    frames: [{ imageUrl: '/attack-1.png', durationMs: 100 }],
  },
]

const bindings: PlaytestActionBindings = {
  space: 'attack',
  a: 'attack',
  shift: null,
  d: 'walk',
}

describe('preloadActionFrames', () => {
  it('prioritizes the active action while preloading every unique bound frame', () => {
    const loaded: string[] = []
    const decoded: string[] = []
    const priorities: string[] = []
    const createImage = () => {
      let currentUrl = ''
      let currentPriority = 'auto'
      return {
        get src() {
          return currentUrl
        },
        set src(url: string) {
          currentUrl = url
          loaded.push(url)
          priorities.push(currentPriority)
        },
        get fetchPriority() {
          return currentPriority
        },
        set fetchPriority(priority: string) {
          currentPriority = priority
        },
        decode: vi.fn(() => {
          decoded.push(currentUrl)
          return Promise.resolve()
        }),
      } as unknown as HTMLImageElement
    }

    preloadActionFrames(actions, 'walk', createImage)

    expect(loaded).toEqual(['/walk-1.png', '/idle-1.png', '/idle-2.png', '/attack-1.png'])
    expect(priorities).toEqual(['high', 'high', 'low', 'low'])
    expect(decoded).toEqual(loaded)
  })

  it('does not restart the preload batch when the user switches actions', () => {
    const createImage = vi.fn(() => ({
      decode: vi.fn(() => Promise.resolve()),
    }))
    vi.stubGlobal('Image', function Image() {
      return createImage()
    })
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    const { result } = renderHook(() => usePlaytestRuntime(actions, 'idle'))
    expect(createImage).toHaveBeenCalledTimes(4)

    act(() => result.current.selectAction('walk'))

    expect(createImage).toHaveBeenCalledTimes(4)
  })

  it('routes Space/Shift/A/D through the current action assignments', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const keyboardBindings = { ...bindings, shift: 'attack' }
    const { result } = renderHook(() => usePlaytestRuntime(actions, 'idle', keyboardBindings))

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space' })))
    expect(result.current.action?.id).toBe('attack')
    act(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space' })))

    act(() =>
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', code: 'ShiftLeft' })),
    )
    expect(result.current.action?.id).toBe('attack')

    act(() => result.current.selectAction('idle'))
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW' })))
    expect(result.current.action?.id).toBe('idle')

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA' })))
    expect(result.current.runtime).toMatchObject({ actionId: 'attack', facing: -1 })
    act(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', code: 'KeyA' })))
    expect(result.current.runtime).toMatchObject({ actionId: 'idle', held: { left: false } })

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', code: 'KeyD' })))
    expect(result.current.runtime).toMatchObject({ actionId: 'walk', held: { right: true } })
    act(() => window.dispatchEvent(new Event('blur')))
    expect(result.current.runtime).toMatchObject({
      actionId: 'idle',
      held: { left: false, right: false },
    })
  })
})
