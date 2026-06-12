// Client-side image compression. Produces a small JPEG data URL suitable for
// storing inline on a Firestore doc (no Firebase Storage needed). Keep the output
// modest — it travels with every read of that doc.

const MAX_BYTES = 250_000 // ~250 KB ceiling for the encoded data URL

/**
 * Load an image file, downscale so the longest side ≤ `maxDim`, and encode JPEG.
 * Tries decreasing quality until under the size ceiling. Rejects if it can't fit.
 */
export async function compressImage(
  file: File,
  maxDim = 640,
  quality = 0.7,
): Promise<string> {
  const bitmap = await loadBitmap(file)
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(bitmap, 0, 0, w, h)

  for (let q = quality; q >= 0.4; q -= 0.1) {
    const url = canvas.toDataURL('image/jpeg', q)
    if (url.length <= MAX_BYTES) return url
  }
  throw new Error('Image too large even after compression — try a smaller photo.')
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file)
    } catch {
      // fall through to <img> decode
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}
