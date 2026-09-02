// 平台与导出格式的全部差异集中在这里。
//
// 两点实测依据（来自线上已稳定运行两年的天猫店招代码）：
//   1. 平台不清洗 HTML —— 自定义 class、data-* 属性、usemap/map/area 全部原样保留。
//   2. 外层 class 不必是系统类 —— 现网样本用的是第三方工具的 `J_TWidget maGong`，
//      照样生效。所以"必须用 sn-simple-logo 才能突破"这个前提并不成立。
//
// 因此本文件提供两套导出格式，由使用者按自己后台的实际表现选择，
// 而不是替他赌一个未经验证的结构。

export type PlatformId = 'tmall990' | 'taobao950' | 'taobao750'
export type CodeFormat = 'layer' | 'imagemap'
export type ProjectKind = 'page' | 'sign'

export interface PlatformConfig {
  id: PlatformId
  label: string
  /** 后台自定义内容区的可编辑宽度 */
  width: number
  /** 突破全屏时用的系统类名（layer 格式才会用到） */
  systemClass: string
  /** 生成代码里写入的 data-title */
  title: string
  /** 后台前置操作提示 */
  setupHint: string
}

export const PLATFORMS: Record<PlatformId, PlatformConfig> = {
  tmall990: {
    id: 'tmall990',
    label: '天猫 · 990',
    width: 990,
    systemClass: 'sn-simple-logo jgabs',
    title: '热区工坊(天猫版)',
    setupHint: '后台先添加 990 布局，再把「自定义内容区」拖进去。',
  },
  taobao950: {
    id: 'taobao950',
    label: '淘宝 专业/智能版 · 950',
    width: 950,
    systemClass: 'footer-more-trigger',
    title: '热区工坊(淘宝版)',
    setupHint: '后台「布局管理」先添加 950 布局，再拖入「自定义内容区」。',
  },
  taobao750: {
    id: 'taobao750',
    label: '淘宝 基础版 · 750',
    width: 750,
    systemClass: 'footer-more-trigger',
    title: '热区工坊(淘宝基础版)',
    setupHint: '后台使用 190+750 布局，代码放右栏「自定义内容区」。',
  },
}

export const PLATFORM_LIST = Object.values(PLATFORMS)

export const CODE_FORMATS: { id: CodeFormat; label: string; hint: string }[] = [
  {
    id: 'layer',
    label: '定位图层',
    hint: '绝对定位 div + a 覆盖层。支持整图通栏（1920），热点可任意重叠。',
  },
  {
    id: 'imagemap',
    label: '图片热区',
    hint: 'img usemap + map/area。结构最短、兼容性最好，但不做通栏突破。',
  },
]

/** 店招固定高度：120 = 仅招牌（保留系统导航）；150 = 招牌 + 自制导航 */
export const SIGN_HEIGHTS = [
  { value: 120, label: '120 · 仅招牌（保留系统导航）' },
  { value: 150, label: '150 · 招牌 + 自制导航' },
] as const
