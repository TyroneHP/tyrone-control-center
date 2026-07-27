import { describe, expect, it, vi } from 'vitest'
import {
  IMAGE_TOO_LARGE_MESSAGE,
  normalizeExerciseImage,
  type ImageProcessingEnvironment,
} from './imageProcessing'

function createEnvironment({
  height,
  output,
  width,
}: {
  height: number
  output: Blob | null
  width: number
}) {
  const close = vi.fn()
  const source = { close, height, width }
  const drawImage = vi.fn()
  const toBlob = vi.fn(
    (callback: BlobCallback, type?: string, quality?: number) => {
      expect(type).toBe('image/webp')
      expect(quality).toBe(0.82)
      callback(output)
    },
  )
  const revokeObjectURL = vi.fn()
  const environment: ImageProcessingEnvironment = {
    createCanvas: vi.fn(() => ({
      getContext: () => ({ drawImage }),
      height: 0,
      toBlob,
      width: 0,
    })),
    createObjectURL: vi.fn(() => 'blob:uploaded-exercise-image'),
    loadImage: vi.fn(async () => source),
    revokeObjectURL,
  }

  return { close, drawImage, environment, revokeObjectURL, source, toBlob }
}

describe('normalizeExerciseImage', () => {
  it('scales a landscape image to the 1280px cap while preserving its ratio and WebP quality', async () => {
    const output = new Blob(['processed'], { type: 'image/webp' })
    const { close, drawImage, environment, revokeObjectURL, source, toBlob } =
      createEnvironment({ height: 1350, output, width: 2400 })

    const result = await normalizeExerciseImage(
      new Blob(['original'], { type: 'image/jpeg' }),
      environment,
    )

    expect(environment.createCanvas).toHaveBeenCalledWith(1280, 720)
    expect(drawImage).toHaveBeenCalledWith(source, 0, 0, 1280, 720)
    expect(toBlob).toHaveBeenCalledTimes(1)
    expect(result).toBe(output)
    expect(close).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:uploaded-exercise-image')
  })

  it('caps a portrait image by its longest edge without distorting it', async () => {
    const output = new Blob(['processed'], { type: 'image/webp' })
    const { environment } = createEnvironment({
      height: 2000,
      output,
      width: 500,
    })

    await normalizeExerciseImage(
      new Blob(['original'], { type: 'image/png' }),
      environment,
    )

    expect(environment.createCanvas).toHaveBeenCalledWith(320, 1280)
  })

  it('rejects a processed image above 1.5 MB and still releases browser resources', async () => {
    const oversized = new Blob([new Uint8Array(1_572_865)], {
      type: 'image/webp',
    })
    const { close, environment, revokeObjectURL } = createEnvironment({
      height: 800,
      output: oversized,
      width: 800,
    })

    await expect(
      normalizeExerciseImage(
        new Blob(['original'], { type: 'image/png' }),
        environment,
      ),
    ).rejects.toThrow(IMAGE_TOO_LARGE_MESSAGE)

    expect(close).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:uploaded-exercise-image')
  })

  it('releases the object URL when decoding fails before a canvas is created', async () => {
    const revokeObjectURL = vi.fn()
    const environment: ImageProcessingEnvironment = {
      createCanvas: vi.fn(),
      createObjectURL: vi.fn(() => 'blob:broken-exercise-image'),
      loadImage: vi.fn(async () => {
        throw new Error('decode failed')
      }),
      revokeObjectURL,
    }

    await expect(
      normalizeExerciseImage(
        new Blob(['broken'], { type: 'image/png' }),
        environment,
      ),
    ).rejects.toThrow('decode failed')

    expect(environment.createCanvas).not.toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:broken-exercise-image')
  })
})
