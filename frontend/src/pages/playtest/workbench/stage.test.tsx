// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PlaytestStage } from './stage'

afterEach(cleanup)

function renderStage(x: number, y = 0, facing: 'left' | 'right' | 'front' | 'back' = 'right') {
  render(
    <PlaytestStage
      frame={{ imageUrl: '/idle-01.png', durationMs: 100 }}
      x={x}
      y={y}
      facing={facing}
      onBoundsChange={() => undefined}
    />,
  )
  return screen.getByRole('region', { name: '预览舞台' }).querySelector('img')
}

describe('PlaytestStage', () => {
  it('centers and moves the sprite through a single transform', () => {
    const sprite = renderStage(40, -25)

    expect(sprite?.style.transform).toBe('translate3d(calc(-50% + 40px), -25px, 0) scaleX(1)')
    expect(sprite?.getAttribute('loading')).toBe('eager')
    expect(sprite?.getAttribute('decoding')).toBe('async')
    expect(sprite?.getAttribute('fetchpriority')).toBe('high')
    // jsdom 不排版，量不出偏移，只能守住成因：Tailwind v4 的 translate 工具类走独立的
    // translate 属性，与 transform 叠加而非覆盖，两处都写会让静止位置左偏半个精灵宽。
    expect(sprite?.className).not.toMatch(/(^|\s)-?translate-/)
  })

  it('mirrors only the left-facing side sequence', () => {
    expect(renderStage(0, 0, 'left')?.style.transform).toContain('scaleX(-1)')
    cleanup()
    expect(renderStage(0, 0, 'front')?.style.transform).toContain('scaleX(1)')
  })

  it('shows an empty stage when the action has no frame to play', () => {
    render(
      <PlaytestStage frame={null} x={0} y={0} facing="right" onBoundsChange={() => undefined} />,
    )

    expect(screen.getByText('暂无可播放帧')).toBeTruthy()
  })

  it('measures horizontal and depth bounds from the stage and sprite sizes', () => {
    const onBoundsChange = vi.fn()
    render(
      <PlaytestStage
        frame={{ imageUrl: '/idle-01.png', durationMs: 100 }}
        x={0}
        y={0}
        facing="right"
        onBoundsChange={onBoundsChange}
      />,
    )
    const stage = screen.getByRole('region', { name: '预览舞台' })
    const sprite = stage.querySelector('img')!
    vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue({
      width: 500,
      height: 400,
    } as DOMRect)
    vi.spyOn(sprite, 'getBoundingClientRect').mockReturnValue({
      width: 100,
      height: 120,
    } as DOMRect)

    fireEvent.load(sprite)

    expect(onBoundsChange).toHaveBeenLastCalledWith({
      minX: -172,
      maxX: 172,
      minY: -96,
      maxY: 96,
    })
  })
})
