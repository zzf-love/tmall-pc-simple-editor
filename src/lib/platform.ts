// 平台与导出格式的全部差异集中在这里。
//
// 两点实测依据（来自线上已稳定运行两年的天猫店招代码）：
//   1. 平台不清洗 HTML —— 自定义 class、data-* 属性、usemap/map/area 全部原样保留。
//   2. 外层 class 不必是系统类 —— 现网样本用的是第三方工具的 `J_TWidget maGong`，
//      照样生效。所以"必须用 sn-simple-logo 才能突破"这个前提并不成立。
//
// 因此本文件提供两套导出格式，由使用者按自己后台的实际表现选择，
// 而不是替他赌一个未经验证的结构。

export type PlatformId = 'tmall990' | 'taobao950' | 'taobao750' | 'generic'
export type CodeFormat = 'layer' | 'imagemap'
export type ProjectKind = 'page' | 'sign'

export interface PlatformConfig {
  id: PlatformId
  label: string
  /** 顶栏开关用的短名 */
  shortLabel: string
  /** 后台「自定义内容区」页面模块的可编辑宽度 */
  width: number
  /** 店招模块宽度（淘宝 C 店店招统一 950，基础版也不例外） */
  signWidth: number
  /**
   * layer 通栏：1920 图层相对页面模块左边的偏移，使整图相对「屏幕」居中。
   * - 居中模块（990/950）：-(1920-模块宽)/2
   * - 基础版 750：模块在 190+10+750=950 布局的右栏，模块中心比屏幕中心
   *   右偏 100px，所以是 -(1920-750)/2-100 = -685，不能套居中公式。
   */
  breakthroughLeft: number
  /** 突破全屏时用的系统类名（layer 格式才会用到） */
  systemClass: string
  /** 生成代码里写入的 data-title */
  title: string
  /** 页面模块后台前置操作提示 */
  setupHint: string
  /** 店招后台操作提示（缺省与页面相同） */
  signSetupHint?: string
  /**
   * 通用版：不依赖任何平台的模块宽度与系统类名，输出按容器宽度自适应、
   * 热点用百分比定位的独立 HTML。width/breakthroughLeft/systemClass 对它无意义。
   */
  responsive?: boolean
}

export const PLATFORMS: Record<PlatformId, PlatformConfig> = {
  tmall990: {
    id: 'tmall990',
    label: '天猫 · 990',
    shortLabel: '天猫',
    width: 990,
    signWidth: 990,
    breakthroughLeft: -465,
    systemClass: 'sn-simple-logo jgabs',
    title: '热区工坊(天猫版)',
    setupHint: '后台先添加 990 布局，再把「自定义内容区」拖进去。',
  },
  taobao950: {
    id: 'taobao950',
    label: '淘宝 · 950',
    shortLabel: '淘宝',
    width: 950,
    signWidth: 950,
    breakthroughLeft: -485,
    systemClass: 'footer-more-trigger',
    title: '热区工坊(淘宝版)',
    setupHint: '后台「布局管理」先添加 950 布局，再拖入「自定义内容区」。',
  },
  taobao750: {
    id: 'taobao750',
    label: '基础版 · 750',
    shortLabel: '基础版',
    width: 750,
    signWidth: 950,
    breakthroughLeft: -685,
    systemClass: 'footer-more-trigger',
    title: '热区工坊(淘宝基础版)',
    setupHint:
      '基础版只有「左 190 + 右 750」一种布局：后台「布局管理」建好该布局，把「自定义内容区」拖到右侧 750 栏，代码必须粘在右侧 750 模块里，粘错栏会整体偏移。',
    signSetupHint: '基础版店招仍是 950 宽：代码粘到「店铺招牌 → 自定义招牌 → 源码」。',
  },
  generic: {
    id: 'generic',
    label: '通用版 · 自适应',
    shortLabel: '通用',
    // 通用版没有固定模块宽度。这里的 1920 只是名义值（与 editor 的 CANVAS_WIDTH 一致，
    // 不从那边 import 是为了避免 platform → editor → types → platform 的循环依赖）；
    // 实际输出按容器宽度自适应，「居中显示」时的最大宽度取原图宽。
    width: 1920,
    signWidth: 1920,
    breakthroughLeft: 0,
    systemClass: '',
    title: '热区工坊',
    setupHint: '粘到任意网站的 HTML 区域即可，只用内联样式，不需要额外 CSS 或 JS。',
    responsive: true,
  },
}

export const PLATFORM_LIST = Object.values(PLATFORMS)

export function isPlatformId(value: unknown): value is PlatformId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PLATFORMS, value)
}

/** 店招模块宽度 */
export function signWidthOf(platform: PlatformId) {
  return PLATFORMS[platform].signWidth
}

/** 店招通栏的左偏移：店招在页头是居中模块，套居中公式即可 */
export function signBreakthroughLeft(platform: PlatformId) {
  return -Math.round((1920 - PLATFORMS[platform].signWidth) / 2)
}

// 标签按"用户看到的效果"来写，不用实现名词——装修的人不关心 div 还是 usemap。
export const CODE_FORMATS: { id: CodeFormat; label: string; sub: string; hint: string }[] = [
  {
    id: 'layer',
    label: '全屏通栏',
    sub: '图片铺满屏幕宽度',
    hint: '图片按 1920 整幅输出，左右两侧不留白，视觉冲击最强。热点可以随意重叠。适合首页大海报。',
  },
  {
    id: 'imagemap',
    label: '居中显示',
    sub: '图片按模块宽度',
    hint: '图片按模块宽度居中显示，两侧留白。代码最短、最不容易出问题，和大多数现成装修的结构一致。',
  },
]

/** 店招固定高度：120 = 仅招牌（保留系统导航）；150 = 招牌 + 自制导航 */
export const SIGN_HEIGHTS = [
  { value: 120, label: '120 · 仅招牌（保留系统导航）' },
  { value: 150, label: '150 · 招牌 + 自制导航' },
] as const
