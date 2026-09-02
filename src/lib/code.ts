import type { Hotspot, ImageAsset } from '../types'
import { CANVAS_WIDTH, uid } from './editor'
import type { CodeFormat, PlatformId } from './platform'
import { PLATFORMS } from './platform'

const escapeAttr = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

export interface ExportOptions {
  platform?: PlatformId
  format?: CodeFormat
}

// ── 定位图层：绝对定位 div + a 覆盖层 ─────────────────────────────
// 内容按 CANVAS_WIDTH（1920）整幅铺开，再用负偏移拉回，使其在任意宽度的
// 模块里居中——这是"通栏"的实现方式。

function layerHotspot(hotspot: Hotspot, imageIndex: number, index: number, systemClass: string) {
  return `<div class="putu-area-${imageIndex + 1}-${index + 1} ${systemClass}" data-w="area" style="position:absolute;height:auto;width:auto;left:auto;top:auto;right:auto;display:block;z-index:1;overflow:inherit;background:none;border:0;padding:0;line-height:normal;left:${Math.round(hotspot.x)}px;top:${Math.round(hotspot.y)}px;width:${Math.round(hotspot.width)}px;height:${Math.round(hotspot.height)}px;z-index:${index + 2};"><a href="${escapeAttr(hotspot.href || '#')}" target="${hotspot.target}" style="display:block;height:100%;"></a></div>`
}

function layerPage(images: ImageAsset[], platform: PlatformId) {
  const { width, systemClass, title } = PLATFORMS[platform]
  const totalHeight = images.reduce((sum, image) => sum + image.height, 0)
  const left = -Math.round((CANVAS_WIDTH - width) / 2)
  const sections = images
    .map((image, imageIndex) => {
      const hotspots = image.hotspots
        .map((hotspot, index) => layerHotspot(hotspot, imageIndex, index, systemClass))
        .join('')
      return `<div style="height:${image.height}px;width:${CANVAS_WIDTH}px;position:relative;background:transparent url(${escapeAttr(image.url)}) no-repeat center center scroll;overflow:hidden;display:block;border:0;padding:0;margin:0;line-height:0;font-size:0;" data-w="mk">${hotspots}</div>`
    })
    .join('')

  return `<div style="height:${totalHeight}px;" class="jg_tools_code xx_diy_code" data-title="${title}"><div class="${systemClass}" style="position:absolute;background:none;border:0;padding:0;margin:0;z-index:20;width:${width}px;height:${totalHeight}px;top:auto;left:auto;line-height:normal;"><div class="${systemClass}" style="position:absolute;background:none;border:0;padding:0;margin:0;width:${CANVAS_WIDTH}px;height:${totalHeight}px;top:auto;left:${left}px;">${sections}</div></div></div>`
}

// ── 图片热区：img usemap + map/area ───────────────────────────────
// 与线上已验证的现网装修同构。坐标是 area 的 rect 写法：左,上,右,下。
// 图片按模块宽度呈现，不做通栏突破。

function mapAreas(hotspots: Hotspot[], scale: number) {
  return hotspots
    .map((hotspot) => {
      const l = Math.round(hotspot.x * scale)
      const t = Math.round(hotspot.y * scale)
      const r = Math.round((hotspot.x + hotspot.width) * scale)
      const b = Math.round((hotspot.y + hotspot.height) * scale)
      return `<area coords="${l},${t},${r},${b}" href="${escapeAttr(hotspot.href || '#')}" target="${hotspot.target}" style="outline:none;" />`
    })
    .join('')
}

function imageMapPage(images: ImageAsset[], platform: PlatformId) {
  const { width, title } = PLATFORMS[platform]
  const blocks = images
    .map((image, index) => {
      // 编辑器坐标基于原图像素；按模块宽度等比缩放后写入 coords。
      const scale = image.width ? width / image.width : 1
      const name = `hz${Date.now().toString(36)}${index}`
      const height = Math.round(image.height * scale)
      const areas = mapAreas(image.hotspots, scale)
      const map = areas ? `<map name="${name}">${areas}</map>` : ''
      const usemap = areas ? ` usemap="#${name}"` : ''
      return `<img src="${escapeAttr(image.url)}" width="${width}" height="${height}" style="display:block;border:0;" alt=""${usemap} />${map}`
    })
    .join('')

  return `<div class="hotzone-studio" data-title="${title}" style="width:${width}px;margin:0 auto;line-height:0;font-size:0;">${blocks}</div>`
}

// ── 对外入口 ───────────────────────────────────────────────────────

export function generateStoreCode(images: ImageAsset[], options: ExportOptions = {}) {
  const platform = options.platform ?? 'tmall990'
  const format = options.format ?? 'layer'
  return format === 'imagemap' ? imageMapPage(images, platform) : layerPage(images, platform)
}

/**
 * 店招：单图、固定高度（120 或 150）。
 * 图片按模块宽度呈现，热点坐标同比缩放。
 */
export function generateSignCode(
  image: ImageAsset | undefined,
  height: number,
  options: ExportOptions = {},
) {
  const platform = options.platform ?? 'tmall990'
  const format = options.format ?? 'imagemap'
  const { width, title, systemClass } = PLATFORMS[platform]
  if (!image) return ''

  const scale = image.width ? width / image.width : 1

  if (format === 'imagemap') {
    const areas = mapAreas(image.hotspots, scale)
    const name = `hzsign${Date.now().toString(36)}`
    const map = areas ? `<map name="${name}">${areas}</map>` : ''
    const usemap = areas ? ` usemap="#${name}"` : ''
    return `<div class="hotzone-sign" data-title="${title}" style="width:${width}px;height:${height}px;margin:0 auto;line-height:0;font-size:0;overflow:hidden;"><img src="${escapeAttr(image.url)}" width="${width}" height="${height}" style="display:block;border:0;" alt=""${usemap} />${map}</div>`
  }

  const hotspots = image.hotspots
    .map(
      (hotspot, index) =>
        `<div class="putu-sign-${index + 1} ${systemClass}" data-w="area" style="position:absolute;display:block;background:none;border:0;padding:0;line-height:normal;left:${Math.round(hotspot.x * scale)}px;top:${Math.round(hotspot.y * scale)}px;width:${Math.round(hotspot.width * scale)}px;height:${Math.round(hotspot.height * scale)}px;z-index:${index + 2};"><a href="${escapeAttr(hotspot.href || '#')}" target="${hotspot.target}" style="display:block;height:100%;"></a></div>`,
    )
    .join('')

  return `<div class="hotzone-sign" data-title="${title}" style="width:${width}px;height:${height}px;margin:0 auto;position:relative;overflow:hidden;line-height:0;font-size:0;"><img src="${escapeAttr(image.url)}" width="${width}" height="${height}" style="display:block;border:0;" alt="" />${hotspots}</div>`
}

/** 自制导航时用来隐藏系统导航的 CSS，粘到导航模块的「显示设置」里。 */
export const HIDE_NAV_CSS = `.skin-box-bd .menu-list{display:none;}
.all-cats{display:none;}
.skin-box-bd{background:none;}`

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

/** 从 <area coords="左,上,右,下"> 还原热点。 */
function hotspotFromArea(area: HTMLAreaElement, index: number, scale: number): Hotspot | null {
  const parts = (area.getAttribute('coords') || '')
    .split(',')
    .map((value) => Number.parseFloat(value.trim()))
  if (parts.length < 4 || parts.some((value) => !Number.isFinite(value))) return null
  const [left, top, right, bottom] = parts
  const width = right - left
  const height = bottom - top
  if (width <= 0 || height <= 0) return null

  return {
    id: uid('hotspot'),
    label: `热点 ${String(index + 1).padStart(2, '0')}`,
    x: left / scale,
    y: top / scale,
    width: width / scale,
    height: height / scale,
    href: area.getAttribute('href') || '#',
    target: area.getAttribute('target') === '_self' ? '_self' : '_blank',
  }
}

export function importStoreCode(code: string): ImageAsset[] {
  const document = new DOMParser().parseFromString(code, 'text/html')

  // ① 图片热区结构：img[usemap] + map/area
  const mapped = Array.from(document.querySelectorAll<HTMLImageElement>('img[usemap]'))
  if (mapped.length) {
    const images = mapped.map((img, imageIndex) => {
      const mapName = (img.getAttribute('usemap') || '').replace(/^#/, '')
      const map = mapName ? document.querySelector<HTMLMapElement>(`map[name="${mapName}"]`) : null
      const width = Number.parseFloat(img.getAttribute('width') || '') || CANVAS_WIDTH
      const height = Number.parseFloat(img.getAttribute('height') || '') || 0
      const areas = map ? Array.from(map.querySelectorAll('area')) : []
      const hotspots = areas
        .map((area, index) => hotspotFromArea(area, index, 1))
        .filter((hotspot): hotspot is Hotspot => Boolean(hotspot))

      return {
        id: uid('image'),
        name: `导入图片 ${imageIndex + 1}`,
        url: img.getAttribute('src') || '',
        width,
        height,
        hotspots,
      }
    })
    if (images.some((image) => image.url)) return images.filter((image) => image.url)
  }

  // ② 定位图层结构：带背景图的 div + 绝对定位锚点
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
