import type { Hotspot, ImageAsset } from '../types'
import { CANVAS_WIDTH, loadImageDimensions, uid } from './editor'
import type { CodeFormat, PlatformId } from './platform'
import { PLATFORMS, signBreakthroughLeft, signWidthOf } from './platform'

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

function layerHotspot(
  hotspot: Hotspot,
  imageIndex: number,
  index: number,
  systemClass: string,
  offsetX = 0,
  offsetY = 0,
) {
  const x = Math.round(hotspot.x + offsetX)
  const y = Math.round(hotspot.y + offsetY)
  const width = Math.round(hotspot.width)
  const height = Math.round(hotspot.height)
  return `<div class="putu-area-${imageIndex + 1}-${index + 1} ${systemClass}" data-w="area" style="position:absolute;left:${x}px;top:${y}px;width:${width}px;height:${height}px;display:block;z-index:${index + 2};overflow:inherit;background:none;border:0;padding:0;margin:0;line-height:normal;"><a href="${escapeAttr(hotspot.href || '#')}" target="${hotspot.target}" style="display:block;width:100%;height:100%;"></a></div>`
}

/**
 * 通栏结构（页面与店招共用）。
 * - 页面模块宽度取 platform.width，左偏移取 platform.breakthroughLeft
 *   （基础版 750 在右栏，偏移与居中模块不同）。
 * - 店招模块宽度取 signWidth（淘宝 C 店统一 950），偏移按居中公式。
 * fixedHeight 用于店招固定高度；页面按图片高度之和。
 */
function layerPage(images: ImageAsset[], platform: PlatformId, fixedHeight?: number, isSign = false) {
  const config = PLATFORMS[platform]
  const moduleWidth = isSign ? config.signWidth : config.width
  const left = isSign ? signBreakthroughLeft(platform) : config.breakthroughLeft
  const { systemClass, title } = config
  const naturalHeight = images.reduce((sum, image) => sum + image.height, 0)
  const totalHeight = fixedHeight ?? naturalHeight
  const sections = images
    .map((image, imageIndex) => {
      const sectionHeight = fixedHeight ?? image.height
      // 背景图是 `no-repeat center center`：图片比 1920 窄（或比固定高度矮/高）时，
      // 浏览器会把它居中留白或居中裁切。热点坐标是原图像素，必须跟着同样的居中量平移，
      // 否则整组热点会偏移 (1920-图宽)/2 ——990 宽的图会整体偏出模块 465px，点不到。
      const offsetX = (CANVAS_WIDTH - image.width) / 2
      const offsetY = (sectionHeight - image.height) / 2
      const hotspots = image.hotspots
        .map((hotspot, index) =>
          layerHotspot(hotspot, imageIndex, index, systemClass, offsetX, offsetY),
        )
        .join('')
      return `<div style="height:${sectionHeight}px;width:${CANVAS_WIDTH}px;position:relative;background:transparent url(${escapeAttr(image.url)}) no-repeat center center scroll;overflow:hidden;display:block;border:0;padding:0;margin:0;line-height:0;font-size:0;" data-w="mk">${hotspots}</div>`
    })
    .join('')

  return `<div style="height:${totalHeight}px;" class="jg_tools_code xx_diy_code" data-title="${title}"><div class="${systemClass}" style="position:absolute;background:none;border:0;padding:0;margin:0;z-index:20;width:${moduleWidth}px;height:${totalHeight}px;top:auto;left:auto;line-height:normal;"><div class="${systemClass}" style="position:absolute;background:none;border:0;padding:0;margin:0;width:${CANVAS_WIDTH}px;height:${totalHeight}px;top:auto;left:${left}px;">${sections}</div></div></div>`
}

// ── 图片热区：img usemap + map/area ───────────────────────────────
// 与线上已验证的现网装修同构。坐标是 area 的 rect 写法：左,上,右,下。
// 图片按模块宽度呈现，不做通栏突破。
// data-ow/data-oh 记录原图像素，导入时才能把缩放后的 coords 还原回原图空间。

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

function originalSizeAttrs(image: ImageAsset) {
  return ` data-ow="${image.width}" data-oh="${image.height}"`
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
      return `<img src="${escapeAttr(image.url)}" width="${width}" height="${height}"${originalSizeAttrs(image)} style="display:block;border:0;" alt=""${usemap} />${map}`
    })
    .join('')

  return `<div class="hotzone-studio" data-title="${title}" style="width:${width}px;margin:0 auto;line-height:0;font-size:0;">${blocks}</div>`
}

// ── 通用版：自适应百分比热区 ───────────────────────────────────────
// 不依赖任何平台的模块宽度与系统类名，也不用 usemap（usemap 的 coords 是死像素，
// 图片一缩放热点就错位）。图片 width:100%，热点用百分比定位，整块跟着容器宽度
// 等比缩放，手机上也不会错位。全部内联样式，不需要 <style>、不需要 JS，
// 可以直接粘进任意网站或 CMS 的 HTML 区域。

/** 百分比保留 4 位小数：1920px 上的 1px 约 0.052%，足够精确又不会写出长串浮点 */
const pct = (value: number) => `${Number(value.toFixed(4))}%`

function responsiveBlock(image: ImageAsset, imageIndex: number) {
  const hotspots = image.hotspots
    .map((hotspot, index) => {
      const left = pct((hotspot.x / image.width) * 100)
      const top = pct((hotspot.y / image.height) * 100)
      const width = pct((hotspot.width / image.width) * 100)
      const height = pct((hotspot.height / image.height) * 100)
      const label = hotspot.label || `热点 ${index + 1}`
      return `<a class="hotzone-area" data-w="area" href="${escapeAttr(hotspot.href || '#')}" target="${hotspot.target}" rel="noopener" aria-label="${escapeAttr(label)}" style="position:absolute;left:${left};top:${top};width:${width};height:${height};display:block;z-index:${index + 2};"></a>`
    })
    .join('')
  // width/height 属性写原图像素：既让浏览器提前知道宽高比（避免加载时抖动），
  // 也让「导入代码」能按原图像素空间还原热点。
  return `<div class="hotzone-item" style="position:relative;display:block;line-height:0;font-size:0;"><img src="${escapeAttr(image.url)}" width="${image.width}" height="${image.height}"${originalSizeAttrs(image)} alt="" style="display:block;width:100%;height:auto;border:0;" />${hotspots}</div>`
}

function responsivePage(images: ImageAsset[], fullWidth: boolean) {
  const naturalWidth = images[0]?.width || CANVAS_WIDTH
  // 全屏通栏：铺满所在容器；居中显示：最宽不超过原图宽，居中留白。
  const outer = fullWidth ? 'width:100%;' : `max-width:${naturalWidth}px;margin:0 auto;`
  const blocks = images.map((image, index) => responsiveBlock(image, index)).join('')
  return `<div class="hotzone-studio" data-title="${PLATFORMS.generic.title}" style="${outer}line-height:0;font-size:0;">${blocks}</div>`
}

// ── 对外入口 ───────────────────────────────────────────────────────

export function generateStoreCode(images: ImageAsset[], options: ExportOptions = {}) {
  const platform = options.platform ?? 'tmall990'
  const format = options.format ?? 'layer'
  if (PLATFORMS[platform].responsive) return responsivePage(images, format === 'layer')
  return format === 'imagemap' ? imageMapPage(images, platform) : layerPage(images, platform)
}

/**
 * 店招：单图、固定高度（120 或 150）。
 * - layer（全屏通栏）：与页面通栏同构，1920 原图居中突破，热点用原图像素坐标。
 * - imagemap（居中显示）：图按模块宽度等比缩放（不拉伸变形），热点同比缩放。
 */
export function generateSignCode(
  image: ImageAsset | undefined,
  height: number,
  options: ExportOptions = {},
) {
  const platform = options.platform ?? 'tmall990'
  const format = options.format ?? 'imagemap'
  const width = signWidthOf(platform)
  if (!image) return ''

  // 通用版没有「店招」这个概念（那是淘宝页头的固定模块），按普通自适应块输出。
  // UI 上通用版也不显示店招选项，这里只是防御性兜底。
  if (PLATFORMS[platform].responsive) return responsivePage([image], format === 'layer')

  if (format === 'layer') {
    // 通栏店招与页面通栏是同一套突破结构，只是高度固定为店招高度。
    return layerPage([image], platform, height, true)
  }

  const scale = image.width ? width / image.width : 1
  const renderedHeight = Math.round(image.height * scale)
  const areas = mapAreas(image.hotspots, scale)
  const name = `hzsign${Date.now().toString(36)}`
  const map = areas ? `<map name="${name}">${areas}</map>` : ''
  const usemap = areas ? ` usemap="#${name}"` : ''
  return `<div class="hotzone-sign" data-title="${PLATFORMS[platform].title}" style="width:${width}px;height:${height}px;margin:0 auto;overflow:hidden;line-height:0;font-size:0;"><img src="${escapeAttr(image.url)}" width="${width}" height="${renderedHeight}"${originalSizeAttrs(image)} style="display:block;border:0;" alt=""${usemap} />${map}</div>`
}

/** 自制导航时用来隐藏系统导航的 CSS，粘到导航模块的「显示设置」里。 */
export const HIDE_NAV_CSS = `.skin-box-bd .menu-list{display:none;}
.all-cats{display:none;}
.skin-box-bd{background:none;}`

const px = (style: CSSStyleDeclaration | undefined | null, property: keyof CSSStyleDeclaration) => {
  if (!style) return 0
  const raw = String(style[property] || '')
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? value : 0
}

/**
 * 通用版的热点写的是百分比（`left:31.25%`），按给定基准换算回像素；
 * 写死像素的照常返回。base 为 0 时无法换算，退回原始数值。
 */
const lengthPx = (
  style: CSSStyleDeclaration | undefined | null,
  property: keyof CSSStyleDeclaration,
  base: number,
) => {
  if (!style) return 0
  const raw = String(style[property] || '').trim()
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value)) return 0
  return raw.endsWith('%') && base ? (value / 100) * base : value
}

function getBackgroundUrl(element: HTMLElement) {
  const style = element.style
  const value = style.backgroundImage || style.background
  const match = value.match(/url\((['"]?)(.*?)\1\)/i)
  return match?.[2]?.replaceAll('&amp;', '&') || ''
}

function hotspotFromElement(
  element: HTMLElement,
  index: number,
  scale = 1,
  offsetX = 0,
  offsetY = 0,
  base: { width: number; height: number } = { width: 0, height: 0 },
): Hotspot | null {
  const anchor = element.matches('a') ? (element as HTMLAnchorElement) : element.querySelector('a')
  const source = element
  // 通用版热点是百分比定位，按原图尺寸换算回像素；平台版是死像素，原样通过。
  const width = lengthPx(source.style, 'width', base.width) || lengthPx(anchor?.style, 'width', base.width)
  const height =
    lengthPx(source.style, 'height', base.height) || lengthPx(anchor?.style, 'height', base.height)
  if (!width || !height) return null

  return {
    id: uid('hotspot'),
    label: `热点 ${String(index + 1).padStart(2, '0')}`,
    x: Math.round((lengthPx(source.style, 'left', base.width) - offsetX) / scale),
    y: Math.round((lengthPx(source.style, 'top', base.height) - offsetY) / scale),
    width: Math.round(width / scale),
    height: Math.round(height / scale),
    href: anchor?.getAttribute('href') || '#',
    target: anchor?.getAttribute('target') === '_self' ? '_self' : '_blank',
  }
}

/** 从 <area coords="左,上,右,下"> 还原热点；scale=渲染宽/原图宽，坐标除回原图空间。 */
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
    x: Math.round(left / scale),
    y: Math.round(top / scale),
    width: Math.round(width / scale),
    height: Math.round(height / scale),
    href: area.getAttribute('href') || '#',
    target: area.getAttribute('target') === '_self' ? '_self' : '_blank',
  }
}

/** 解析阶段的原始记录：尺寸与热点坐标先停留在「代码声明空间」，确定原图尺寸后再统一换算。 */
interface PendingImportImage {
  /** img：真实 <img>，缺尺寸时可联网取自然尺寸；bg：背景图 div，尺寸以样式声明为准 */
  kind: 'img' | 'bg'
  name: string
  url: string
  /** width/height 属性或容器样式声明的渲染尺寸，0 表示代码里没写 */
  declaredW: number
  declaredH: number
  /** 导出时写入的原图像素 data-ow/data-oh，0 表示没有 */
  dataW: number
  dataH: number
  /** usemap 热区（坐标在渲染尺寸空间） */
  areas: HTMLAreaElement[]
  /** 定位层热区元素（坐标在渲染尺寸空间） */
  boxes: HTMLElement[]
}

const attrNumber = (element: Element, attribute: string) =>
  Number.parseFloat(element.getAttribute(attribute) || '') || 0

/**
 * 用确定下来的原图尺寸构建素材：area/定位热点坐标写在「渲染尺寸空间」，
 * 除以 scale 还原为原图像素；代码没有声明渲染宽度时，图片按自然尺寸渲染，scale=1。
 */
function buildImportedAsset(
  record: PendingImportImage,
  index: number,
  natural?: { width: number; height: number },
): ImageAsset {
  const origW = record.dataW || natural?.width || record.declaredW || CANVAS_WIDTH
  const origH = record.dataH || natural?.height || record.declaredH || 0

  // img：图片被缩放到声明宽度，坐标除以 scale 还原。
  // bg（定位图层/通栏）：背景是 `no-repeat center center`，不缩放而是在声明的容器里居中，
  //   容器尺寸和原图不一致时（旧代码/外部工具很常见），热点写在容器空间，
  //   要减掉居中留白才能落回原图像素空间。
  const isBackground = record.kind === 'bg'
  const renderedW = record.declaredW || origW
  const scale = isBackground || !origW ? 1 : renderedW / origW
  const offsetX = isBackground ? (renderedW - origW) / 2 : 0
  const offsetY = isBackground ? ((record.declaredH || origH) - origH) / 2 : 0
  const areaHotspots = record.areas.map((area, areaIndex) => hotspotFromArea(area, areaIndex, scale))
  const boxHotspots = record.boxes.map((element, boxIndex) =>
    hotspotFromElement(element, record.areas.length + boxIndex, scale, offsetX, offsetY, {
      width: origW,
      height: origH,
    }),
  )
  const hotspots = [...areaHotspots, ...boxHotspots].filter(
    (hotspot): hotspot is Hotspot => Boolean(hotspot),
  )
  return {
    id: uid('image'),
    name: record.name || `导入图片 ${index + 1}`,
    url: record.url,
    width: origW,
    height: origH,
    hotspots,
  }
}

/** 纯结构解析（不联网）：返回三条识别路径命中的原始记录，一条都没命中时抛错。 */
function parseImportCode(code: string): PendingImportImage[] {
  const document = new DOMParser().parseFromString(code, 'text/html')

  // ① 图片热区结构：img[usemap] + map/area（马工/小语言等外部工具导出的常见形态，
  // 往往不带 width/height 属性，尺寸需要后续联网按自然尺寸补齐）
  const mapped = Array.from(document.querySelectorAll<HTMLImageElement>('img[usemap]'))
  if (mapped.length) {
    const records = mapped
      .map((img) => {
        const mapName = (img.getAttribute('usemap') || '').replace(/^#/, '')
        const map = mapName ? document.querySelector<HTMLMapElement>(`map[name="${mapName}"]`) : null
        return {
          kind: 'img' as const,
          name: '',
          url: img.getAttribute('src') || '',
          declaredW: attrNumber(img, 'width'),
          declaredH: attrNumber(img, 'height'),
          dataW: attrNumber(img, 'data-ow'),
          dataH: attrNumber(img, 'data-oh'),
          areas: map ? Array.from(map.querySelectorAll('area')) : [],
          boxes: [] as HTMLElement[],
        }
      })
      .filter((record) => record.url)
    if (records.length) return records
  }

  // ② <img> 模块（无 usemap）：旧版店招 layer 输出（img + 兄弟 data-w=area 热点层），
  // 以及没有热点的居中图片；宽度达到模块尺寸才认作装修图片，避免误抓小图标。
  const overlayBlocks = Array.from(document.querySelectorAll<HTMLImageElement>('img'))
    .filter((img) => !img.getAttribute('usemap'))
    .filter((img) => attrNumber(img, 'width') >= 750)
  if (overlayBlocks.length) {
    return overlayBlocks.map((img) => ({
      kind: 'img' as const,
      name: '',
      url: img.getAttribute('src') || '',
      declaredW: attrNumber(img, 'width'),
      declaredH: attrNumber(img, 'height'),
      dataW: attrNumber(img, 'data-ow'),
      dataH: attrNumber(img, 'data-oh'),
      areas: [] as HTMLAreaElement[],
      boxes: img.parentElement
        ? Array.from(img.parentElement.querySelectorAll<HTMLElement>('[data-w="area"]'))
        : [],
    }))
  }

  // ③ 定位图层结构：带背景图的 div + 绝对定位锚点
  const explicit = Array.from(document.querySelectorAll<HTMLElement>('[data-putu-image]'))
  const candidates = explicit.length
    ? explicit
    : Array.from(document.querySelectorAll<HTMLElement>('div')).filter((element) => {
        const url = getBackgroundUrl(element)
        const width = px(element.style, 'width')
        const height = px(element.style, 'height')
        return Boolean(url && width >= 750 && height >= 80)
      })

  if (!candidates.length) throw new Error('没有识别到带背景图和尺寸的装修模块')
  return candidates.map((element, index) => {
    const explicitHotspots = Array.from(
      element.querySelectorAll<HTMLElement>('[data-putu-hotspot], [data-w="area"]'),
    )
    const hotspotElements = explicitHotspots.length
      ? explicitHotspots
      : Array.from(element.querySelectorAll<HTMLElement>('a')).filter(
          (anchor) => px(anchor.style, 'width') > 0 && px(anchor.style, 'height') > 0,
        )
    return {
      kind: 'bg' as const,
      name: element.dataset.putuName || '',
      url: getBackgroundUrl(element),
      declaredW: px(element.style, 'width') || CANVAS_WIDTH,
      declaredH: px(element.style, 'height'),
      dataW: 0,
      dataH: 0,
      areas: [] as HTMLAreaElement[],
      boxes: hotspotElements,
    }
  })
}

/** 同步导入：只用代码里声明的尺寸（测试与无网络场景使用）。 */
export function importStoreCode(code: string): ImageAsset[] {
  return parseImportCode(code).map((record, index) => buildImportedAsset(record, index))
}

export interface ImportStoreResult {
  images: ImageAsset[]
  /** 尝试联网取尺寸但失败的图片数（已按兜底尺寸导入，可在右侧点「重新识别」补救） */
  missingSize: number
}

/**
 * 导入的推荐入口：先解析结构，再给「代码里没写尺寸、也没有 data-ow」的真实 <img>
 * 联网加载自然尺寸，避免外部工具（马工等）导出的无尺寸 img 被当成 1920×0 而在画布上消失。
 */
export async function importStoreCodeAsync(code: string): Promise<ImportStoreResult> {
  const records = parseImportCode(code)
  const dimensions = await Promise.all(
    records.map(async (record) => {
      // bg 也要联网取尺寸：定位图层代码里写的是「容器」宽高，未必等于原图尺寸。
      // 沿用容器高度会让导出的 `center center` 背景上下留白（容器比图高），
      // 或裁掉图片（容器比图矮）——这正是"预览上下有空白"的成因。
      if (record.dataW || !record.url) return null
      try {
        return await loadImageDimensions(record.url)
      } catch {
        return false as const
      }
    }),
  )
  let missingSize = 0
  const images = records.map((record, index) => {
    const loaded = dimensions[index]
    if (loaded === false) missingSize += 1
    return buildImportedAsset(record, index, loaded || undefined)
  })
  return { images, missingSize }
}
