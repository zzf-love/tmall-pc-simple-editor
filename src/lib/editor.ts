import type { Hotspot, ImageAsset, ProjectData } from '../types'

export const CANVAS_WIDTH = 1920

export const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

export function imageNameFromUrl(url: string, index: number) {
  try {
    const path = new URL(url).pathname
    const file = decodeURIComponent(path.split('/').filter(Boolean).at(-1) || '')
    return file && /\.[a-z0-9]{2,5}$/i.test(file) ? file : `图片 ${index + 1}`
  } catch {
    return `图片 ${index + 1}`
  }
}

export function loadImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.referrerPolicy = 'no-referrer'
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error('图片无法加载，请检查链接或补充尺寸'))
    image.src = url
  })
}

export function clampHotspot(hotspot: Hotspot, asset: ImageAsset): Hotspot {
  const width = Math.max(20, Math.min(hotspot.width, asset.width))
  const height = Math.max(20, Math.min(hotspot.height, asset.height))
  return {
    ...hotspot,
    width,
    height,
    x: Math.max(0, Math.min(hotspot.x, asset.width - width)),
    y: Math.max(0, Math.min(hotspot.y, asset.height - height)),
  }
}

export function projectFromImages(name: string, images: ImageAsset[]): ProjectData {
  return {
    version: 1,
    name,
    canvasWidth: CANVAS_WIDTH,
    images,
    updatedAt: new Date().toISOString(),
  }
}

export function downloadText(filename: string, content: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function safeFileName(name: string) {
  return (name.trim() || '未命名店铺页').replace(/[\\/:*?"<>|]/g, '-').slice(0, 80)
}

