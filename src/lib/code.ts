import type { Hotspot, ImageAsset } from '../types'
import { CANVAS_WIDTH, uid } from './editor'

const escapeAttr = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

export function generateStoreCode(images: ImageAsset[]) {
  const totalHeight = images.reduce((sum, image) => sum + image.height, 0)
  const left = -Math.round((CANVAS_WIDTH - 990) / 2)
  const sections = images
    .map((image, imageIndex) => {
      const hotspots = image.hotspots
        .map(
          (hotspot, hotspotIndex) =>
            `<div class="putu-area-${imageIndex + 1}-${hotspotIndex + 1} sn-simple-logo jgabs" data-w="area" style="position:absolute;height:auto;width:auto;left:auto;top:auto;right:auto;display:block;z-index:1;overflow:inherit;background:none;border:0;padding:0;line-height:normal;left:${Math.round(hotspot.x)}px;top:${Math.round(hotspot.y)}px;width:${Math.round(hotspot.width)}px;height:${Math.round(hotspot.height)}px;z-index:${hotspotIndex + 2};"><a href="${escapeAttr(hotspot.href || '#')}" target="${hotspot.target}" style="display:block;height:100%;"></a></div>`,
        )
        .join('')

      return `<div style="height:${image.height}px;width:${CANVAS_WIDTH}px;position:relative;background:transparent url(${escapeAttr(image.url)}) no-repeat center center scroll;overflow:hidden;display:block;border:0;padding:0;margin:0;line-height:0;font-size:0;" data-w="mk">${hotspots}</div>`
    })
    .join('')

  return `<div style="height:${totalHeight}px;" class="jg_tools_code xx_diy_code" data-title="PC端简易装修(天猫版)"><div class="sn-simple-logo jgabs" style="position:absolute;background:none;border:0;padding:0;margin:0;z-index:20;width:990px;height:${totalHeight}px;top:auto;left:auto;line-height:normal;"><div class="sn-simple-logo jgabs" style="position:absolute;background:none;border:0;padding:0;margin:0;width:${CANVAS_WIDTH}px;height:${totalHeight}px;top:auto;left:${left}px;">${sections}</div></div></div>`
}

const px = (style: CSSStyleDeclaration, property: keyof CSSStyleDeclaration) => {
  const raw = String(style[property] || '')
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? value : 0
}

function getBackgroundUrl(element: HTMLElement) {
  const style = element.style
  const value = style.backgroundImage || style.background
  const match = value.match(/url\((['"]?)(.*?)\1\)/i)
  return match?.[2]?.replaceAll('&amp;', '&') || ''
}

function hotspotFromElement(element: HTMLElement, index: number): Hotspot | null {
  const anchor = element.matches('a') ? (element as HTMLAnchorElement) : element.querySelector('a')
  const source = element
  const width = px(source.style, 'width') || px(anchor?.style || source.style, 'width')
  const height = px(source.style, 'height') || px(anchor?.style || source.style, 'height')
  if (!width || !height) return null

  return {
    id: uid('hotspot'),
    label: `热点 ${String(index + 1).padStart(2, '0')}`,
    x: px(source.style, 'left'),
    y: px(source.style, 'top'),
    width,
    height,
    href: anchor?.getAttribute('href') || '#',
    target: anchor?.getAttribute('target') === '_self' ? '_self' : '_blank',
  }
}

export function importStoreCode(code: string): ImageAsset[] {
  const document = new DOMParser().parseFromString(code, 'text/html')
  const explicit = Array.from(document.querySelectorAll<HTMLElement>('[data-putu-image]'))
  const candidates = explicit.length
    ? explicit
    : Array.from(document.querySelectorAll<HTMLElement>('div')).filter((element) => {
        const url = getBackgroundUrl(element)
        const width = px(element.style, 'width')
        const height = px(element.style, 'height')
        return Boolean(url && width >= 750 && height >= 80)
      })

  const images = candidates.map((element, imageIndex) => {
    const url = getBackgroundUrl(element)
    const width = px(element.style, 'width') || CANVAS_WIDTH
    const height = px(element.style, 'height')
    const explicitHotspots = Array.from(
      element.querySelectorAll<HTMLElement>('[data-putu-hotspot], [data-w="area"]'),
    )
    const hotspotElements = explicitHotspots.length
      ? explicitHotspots
      : Array.from(element.querySelectorAll<HTMLElement>('a')).filter(
          (anchor) => px(anchor.style, 'width') > 0 && px(anchor.style, 'height') > 0,
        )
    const hotspots = hotspotElements
      .map((hotspot, index) => hotspotFromElement(hotspot, index))
      .filter((hotspot): hotspot is Hotspot => Boolean(hotspot))

    return {
      id: uid('image'),
      name: element.dataset.putuName || `导入图片 ${imageIndex + 1}`,
      url,
      width,
      height,
      hotspots,
    }
  })

  if (!images.length) throw new Error('没有识别到带背景图和尺寸的装修模块')
  return images
}

