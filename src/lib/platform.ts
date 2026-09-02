// 平台与导出格式的全部差异集中在这里。
//
// 两点实测依据（来自线上已稳定运行两年的天猫店招代码）：
//   1. 平台不清洗 HTML —— 自定义 class、data-* 属性、usemap/map/area 全部原样保留。
//   2. 外层 class 不必是系统类 —— 现网样本用的是第三方工具的 `J_TWidget maGong`，
//      照样生效。所以"必须用 sn-simple-logo 才能突破"这个前提并不成立。
//
// 因此本文件提供两套导出格式，由使用者按自己后台的实际表现选择，
// 而不是替他赌一个未经验证的结构。

// 淘宝基础版（190+750 两栏）已移除：其现存状态无法证实，且 750 那一栏不在
// 页面中心，用 -(1920-750)/2 会居中到栏而不是页面，通栏必然偏移。
// 若日后确认仍在使用，需要按 190+750 的实际布局单独推导偏移，而不是套用公式。
export type PlatformId = 'tmall990' | 'taobao950'
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
    label: '淘宝 · 950',
    width: 950,
    systemClass: 'footer-more-trigger',
    title: '热区工坊(淘宝版)',
    setupHint: '后台「布局管理」先添加 950 布局，再拖入「自定义内容区」。',
  },
}

export const PLATFORM_LIST = Object.values(PLATFORMS)

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
