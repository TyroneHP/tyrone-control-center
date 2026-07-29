export const IMAGE_TOO_LARGE_MESSAGE =
  'Das verarbeitete Bild darf höchstens 1,5 MB groß sein.'
export const IMAGE_FORMAT_ERROR_MESSAGE =
  'Das Bild konnte nicht als WebP verarbeitet werden.'

const MAX_IMAGE_EDGE = 1280
const MAX_PROCESSED_IMAGE_BYTES = 1.5 * 1024 * 1024
const WEBP_QUALITY = 0.82

interface DecodedImage {
  close?: () => void
  height: number
  width: number
}

interface ImageCanvas {
  getContext: (contextId: '2d') => {
    drawImage: (
      image: DecodedImage,
      dx: number,
      dy: number,
      dWidth: number,
      dHeight: number,
    ) => void
  } | null
  height: number
  toBlob: (callback: BlobCallback, type?: string, quality?: number) => void
  width: number
}

export interface ImageProcessingEnvironment {
  createCanvas: (width: number, height: number) => ImageCanvas
  createObjectURL: (blob: Blob) => string
  loadImage: (url: string) => Promise<DecodedImage>
  revokeObjectURL: (url: string) => void
}

function createBrowserEnvironment(): ImageProcessingEnvironment {
  if (
    typeof document === 'undefined' ||
    typeof Image === 'undefined' ||
    typeof URL.createObjectURL !== 'function' ||
    typeof URL.revokeObjectURL !== 'function'
  ) {
    throw new Error('Die Bildverarbeitung wird von diesem Browser nicht unterstützt.')
  }

  return {
    createCanvas: (width, height) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      return canvas as unknown as ImageCanvas
    },
    createObjectURL: (blob) => URL.createObjectURL(blob),
    loadImage: (url) =>
      new Promise((resolve, reject) => {
        const image = new Image()
        const removeListeners = () => {
          image.onload = null
          image.onerror = null
        }

        image.onload = () => {
          removeListeners()
          if (typeof image.decode !== 'function') {
            resolve(image)
            return
          }
          void image.decode().then(() => resolve(image), reject)
        }
        image.onerror = () => {
          removeListeners()
          reject(new Error('Das Bild konnte nicht geladen werden.'))
        }
        image.src = url
      }),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
  }
}

function normalizedDimensions(width: number, height: number) {
  if (width <= 0 || height <= 0) {
    throw new Error('Das Bild hat keine gültigen Abmessungen.')
  }

  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height))
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  }
}

function encodeWebp(canvas: ImageCanvas) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
          return
        }
        reject(new Error('Das Bild konnte nicht verarbeitet werden.'))
      },
      'image/webp',
      WEBP_QUALITY,
    )
  })
}

/**
 * Returns the normalized Blob that callers may persist for a custom exercise.
 * The injected browser boundary keeps image decoding and canvas behavior real
 * in production while making the dimension and cleanup contract testable.
 */
export async function normalizeExerciseImage(
  source: Blob,
  browser: ImageProcessingEnvironment = createBrowserEnvironment(),
): Promise<Blob> {
  const objectUrl = browser.createObjectURL(source)
  let image: DecodedImage | undefined

  try {
    image = await browser.loadImage(objectUrl)
    const { height, width } = normalizedDimensions(image.width, image.height)
    const canvas = browser.createCanvas(width, height)
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Das Bild konnte nicht verarbeitet werden.')
    }

    context.drawImage(image, 0, 0, width, height)
    const processed = await encodeWebp(canvas)
    if (processed.type.toLocaleLowerCase() !== 'image/webp') {
      throw new Error(IMAGE_FORMAT_ERROR_MESSAGE)
    }
    if (processed.size > MAX_PROCESSED_IMAGE_BYTES) {
      throw new Error(IMAGE_TOO_LARGE_MESSAGE)
    }
    return processed
  } finally {
    image?.close?.()
    browser.revokeObjectURL(objectUrl)
  }
}
