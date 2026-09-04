// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { generateSignCode, generateStoreCode, importStoreCode, importStoreCodeAsync } from './code'
import { loadImageDimensions } from './editor'
import type { ImageAsset } from '../types'

// 只替换联网取尺寸的函数，其余（uid/CANVAS_WIDTH）保持真实实现
vi.mock('./editor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./editor')>()),
  loadImageDimensions: vi.fn(),
}))

const image: ImageAsset = {
  id: 'image-1',
  name: '主视觉.jpg',
  url: 'https://img.example.com/banner.jpg?a=1&b=2',
  width: 1920,
  height: 649,
  hotspots: [
    {
      id: 'hotspot-1',
      label: '热点 01',
      x: 880,
      y: 66,
      width: 743,
      height: 573,
      href: 'https://detail.tmall.com/item.htm?id=1&skuId=2',
      target: '_blank',
    },
  ],
}

const sign: ImageAsset = {
  id: 'sign-1',
  name: '店招.jpg',
  url: 'https://img.example.com/sign.jpg',
  width: 1920,
  height: 150,
  hotspots: [
    {
      id: 'sign-h1',
      label: '热点 01',
      x: 100,
      y: 30,
      width: 200,
      height: 90,
      href: 'https://a.example.com',
      target: '_blank',
    },
  ],
}

describe('store code', () => {
  it('generates zero-gap code and round-trips its editable fields', () => {
    const code = generateStoreCode([image, { ...image, id: 'image-2', height: 600 }])
    expect(code).toContain('font-size:0')
    expect(code).toContain('height:1249px')
    expect(code.startsWith('<div style="height:1249px;" class="jg_tools_code xx_diy_code"')).toBe(true)
    expect(code).toContain('data-title="热区工坊(天猫版)"')
    expect(code.match(/data-w="mk"/g)).toHaveLength(2)
    expect(code.match(/data-w="area"/g)).toHaveLength(2)
    expect(code).toContain('top:auto;left:auto;line-height:normal')
    expect(code).toContain(`background:transparent url(${image.url.replaceAll('&', '&amp;')})`)
    expect(code).not.toContain('data-putu-')
    // 热点层不应再出现重复的 left:auto/width:auto 后又被覆盖的脏属性
    expect(code).not.toContain('left:auto;top:auto;right:auto')
    const imported = importStoreCode(code)
    expect(imported).toHaveLength(2)
    expect(imported[0].url).toBe(image.url)
    expect(imported[0].hotspots[0]).toMatchObject({
      x: 880,
      y: 66,
      width: 743,
      height: 573,
      href: image.hotspots[0].href,
    })
  })

  it('follows the selected platform width and offset', () => {
    const tmall = generateStoreCode([image], { platform: 'tmall990' })
    expect(tmall).toContain('width:990px')
    expect(tmall).toContain('left:-465px') // -(1920-990)/2
    expect(tmall).toContain('sn-simple-logo jgabs')

    const taobao = generateStoreCode([image], { platform: 'taobao950' })
    expect(taobao).toContain('width:950px')
    expect(taobao).toContain('left:-485px') // -(1920-950)/2
    expect(taobao).toContain('footer-more-trigger')
    expect(taobao).toContain('data-title="热区工坊(淘宝版)"')
    expect(taobao).not.toContain('sn-simple-logo')

    // 基础版：750 模块在 190+10+750 布局右栏，模块中心比屏幕中心右偏 100px，
    // 全屏居中偏移必须是 -685 而不是 -(1920-750)/2=-585（那只会居中到栏）。
    const basic = generateStoreCode([image], { platform: 'taobao750' })
    expect(basic).toContain('width:750px')
    expect(basic).toContain('left:-685px')
    expect(basic).not.toContain('left:-585px')
    expect(basic).toContain('footer-more-trigger')
    expect(basic).toContain('data-title="热区工坊(淘宝基础版)"')
  })

  it('emits an image map and reads it back into original pixel space', () => {
    const code = generateStoreCode([image], { platform: 'tmall990', format: 'imagemap' })
    expect(code).toContain('usemap="#')
    expect(code).toContain('<map name="')
    // 1920 原图缩到 990：坐标同比 × (990/1920)
    expect(code).toContain('coords="454,34,837,329"')
    expect(code).toContain('data-ow="1920"')
    expect(code).not.toContain('background:transparent url')

    const imported = importStoreCode(code)
    expect(imported).toHaveLength(1)
    expect(imported[0].url).toBe(image.url)
    // 借助 data-ow 还原回 1920 原图像素空间，再切通栏导出才不会错位
    expect(imported[0].width).toBe(1920)
    expect(imported[0].hotspots[0]).toMatchObject({ x: 880, y: 66, width: 743, href: image.hotspots[0].href })
  })

  it('parses a real-world image map from a live shop sign without original-size hints', () => {
    // 现网天猫店招（990×150，img usemap + map/area），无 data-ow，按其自身尺寸空间导入
    const live = `<div class="J_TWidget maGong" style="height:150px;margin:0 auto;">
      <img src="//gdp.alicdn.com/x.jpg" width="990" height="150" usemap="#IPNQC" />
      <map name="IPNQC"><area coords="138,92,202,149" href="//kinder.tmall.com/search.htm" target="_blank" /></map></div>`
    const imported = importStoreCode(live)
    expect(imported).toHaveLength(1)
    expect(imported[0].width).toBe(990)
    expect(imported[0].hotspots[0]).toMatchObject({ x: 138, y: 92, width: 64, height: 57 })
  })

  it('parses a real-world layer-format page from a live shop', () => {
    // 现网天猫页面装修（小语言店铺装修工具生成）：990 模块内 1920 通栏 + 6 热点。
    const live = `<div style="height:2188px;" class="jg_tools_code xx_diy_code" data-title="小语言店铺装修工具"><div class="sn-simple-logo jgabs" style="background:none;border:0;padding:0;margin:0;z-index:20;width:990px;height:2188px;top:auto;left:auto;line-height:normal;"><div class="sn-simple-logo jgabs" style="background:none;border:0;padding:0;margin:0;width:1920px;height:2188px;top:auto;left:-465px;"><div style="height:2188px;width:1920px;position:relative;background:transparent url(//gdp.alicdn.com/imgextra/i1/x.jpg) no-repeat center center scroll;overflow:hidden;" data-w="mk"><div class="l__6_314418 sn-simple-logo jgabs" data-w="area" style="left:1018px;top:1890px;width:487px;height:264px;z-index:6;"><a href="//detail.tmall.com/item.htm?id=1056997314246" target="_blank" style="display:block;height:100%;"></a></div><div class="l__1_314418 sn-simple-logo jgabs" data-w="area" style="left:390px;top:713px;width:376px;height:283px;z-index:1;"><a href="//tbshop.m.taobao.com/app/z.html" target="_blank" style="display:block;height:100%;"></a></div></div></div></div></div>`
    const imported = importStoreCode(live)
    expect(imported).toHaveLength(1)
    expect(imported[0].width).toBe(1920)
    expect(imported[0].height).toBe(2188)
    expect(imported[0].hotspots).toHaveLength(2)
    expect(imported[0].hotspots[0]).toMatchObject({
      x: 1018,
      y: 1890,
      width: 487,
      height: 264,
      href: '//detail.tmall.com/item.htm?id=1056997314246',
    })
  })
})

describe('sign code', () => {
  it('generates a fixed-height sign for both formats', () => {
    const map = generateSignCode(sign, 150, { platform: 'tmall990', format: 'imagemap' })
    expect(map).toContain('width:990px;height:150px')
    expect(map).toContain('usemap="#')

    const layer = generateSignCode(sign, 120, { platform: 'taobao950', format: 'layer' })
    expect(layer).toContain('width:950px;height:120px')
    expect(layer).toContain('data-w="area"')
    expect(generateSignCode(undefined, 150)).toBe('')
  })

  it('sign layer is a real 1920 breakthrough, not a scaled module box', () => {
    const tmall = generateSignCode(sign, 150, { platform: 'tmall990', format: 'layer' })
    // 必须有通栏突破结构：990 模块层 + 1920 层 + -465 偏移
    expect(tmall).toContain('width:1920px;height:150px')
    expect(tmall).toContain('left:-465px')
    // 热点用原图像素坐标，不做缩放
    expect(tmall).toContain('left:100px;top:30px;width:200px;height:90px')

    const taobao = generateSignCode(sign, 150, { platform: 'taobao950', format: 'layer' })
    expect(taobao).toContain('left:-485px')

    // 基础版店招仍是 950 宽（页头不随 750 右栏走），偏移按 950 居中 = -485
    const basicLayer = generateSignCode(sign, 150, { platform: 'taobao750', format: 'layer' })
    expect(basicLayer).toContain('width:950px;height:150px')
    expect(basicLayer).toContain('left:-485px')
    expect(basicLayer).not.toContain('width:750px')
    // 基础版店招居中图片同样按 950 宽缩放（1920×150 → 950×74）
    const basicMap = generateSignCode(sign, 150, { platform: 'taobao750', format: 'imagemap' })
    expect(basicMap).toContain('width:950px;height:150px')
    expect(basicMap).toContain('width="950" height="74"')
  })

  it('shifts layer hotspots with the centered background when the image is not 1920 wide', () => {
    // 990 宽的图放进 1920 通栏容器：背景 center center 会左右各留白 (1920-990)/2 = 465。
    // 热点坐标是原图像素，必须跟着平移，否则整组热点偏出模块 465px，线上完全点不到。
    const narrow: ImageAsset = { ...sign, width: 990, height: 150 }
    const code = generateSignCode(narrow, 150, { platform: 'tmall990', format: 'layer' })
    expect(code).toContain('left:565px;top:30px;width:200px;height:90px')

    // 1920 原图不受影响，偏移量为 0
    const full = generateSignCode(sign, 150, { platform: 'tmall990', format: 'layer' })
    expect(full).toContain('left:100px;top:30px;width:200px;height:90px')
  })

  it('shifts layer hotspots vertically when the sign image is taller than the fixed height', () => {
    // 200 高的图裁进 150 的店招：上下各裁 (150-200)/2 = -25，热点 y 同步上移 25
    const tall: ImageAsset = { ...sign, width: 1920, height: 200 }
    const code = generateSignCode(tall, 150, { platform: 'tmall990', format: 'layer' })
    expect(code).toContain('left:100px;top:5px;width:200px;height:90px')
  })

  it('sign imagemap keeps aspect ratio instead of stretching the image', () => {
    // 1920×150 缩到 990 宽，等比高 ≈ 77，而不是被拉成 150
    const code = generateSignCode(sign, 150, { platform: 'tmall990', format: 'imagemap' })
    expect(code).toContain('width="990" height="77"')
    expect(code).toContain('data-ow="1920" data-oh="150"')
  })

  it('round-trips both sign formats back into editable data', () => {
    const layer = generateSignCode(sign, 150, { platform: 'tmall990', format: 'layer' })
    const fromLayer = importStoreCode(layer)
    expect(fromLayer).toHaveLength(1)
    expect(fromLayer[0].width).toBe(1920)
    expect(fromLayer[0].hotspots[0]).toMatchObject({ x: 100, y: 30, width: 200, height: 90 })

    const map = generateSignCode(sign, 150, { platform: 'tmall990', format: 'imagemap' })
    const fromMap = importStoreCode(map)
    expect(fromMap).toHaveLength(1)
    expect(fromMap[0].width).toBe(1920)
    // 缩放成整数 coords 再还原会有 ±1px 取整误差，属于正常范围
    const h = fromMap[0].hotspots[0]
    expect(Math.abs(h.x - 100)).toBeLessThanOrEqual(1)
    expect(Math.abs(h.y - 30)).toBeLessThanOrEqual(1)
    expect(Math.abs(h.width - 200)).toBeLessThanOrEqual(1)
    expect(Math.abs(h.height - 90)).toBeLessThanOrEqual(1)
  })

  it('imports the previous buggy sign-layer output (img + overlay hotspots)', () => {
    // 旧版本店招 layer：990 容器里放缩放过的 img 和 data-w=area 热点层
    const legacy = `<div class="hotzone-sign" style="width:990px;height:150px;position:relative;">
      <img src="//gdp.alicdn.com/s.jpg" width="990" height="150" />
      <div class="putu-sign-1 sn-simple-logo jgabs" data-w="area" style="position:absolute;left:52px;top:15px;width:103px;height:46px;"><a href="//a.com" target="_blank"></a></div>
    </div>`
    const imported = importStoreCode(legacy)
    expect(imported).toHaveLength(1)
    expect(imported[0].width).toBe(990)
    expect(imported[0].hotspots[0]).toMatchObject({ x: 52, y: 15, width: 103, height: 46 })
  })

  it('imports a hotspot-less centered image instead of throwing', () => {
    const plain = '<div class="hotzone-sign" style="width:990px;"><img src="//gdp.alicdn.com/plain.jpg" width="990" height="77" data-ow="1920" data-oh="150" /></div>'
    const imported = importStoreCode(plain)
    expect(imported).toHaveLength(1)
    expect(imported[0]).toMatchObject({ width: 1920, height: 150, hotspots: [] })
  })
})

describe('generic platform (通用版)', () => {
  it('emits a self-contained responsive block with percentage hotspots', () => {
    const code = generateStoreCode([image], { platform: 'generic', format: 'layer' })
    // 图片自适应容器宽度
    expect(code).toContain('width:100%;height:auto')
    // 热点按百分比定位：x 880/1920 = 45.8333%，宽 743/1920 = 38.6979%
    expect(code).toContain('left:45.8333%')
    expect(code).toContain('width:38.6979%')
    // y 66/649 = 10.1695%，高 573/649 = 88.2897%
    expect(code).toContain('top:10.1695%')
    expect(code).toContain('height:88.2897%')
    // 不带任何淘宝/天猫平台痕迹
    expect(code).not.toContain('sn-simple-logo')
    expect(code).not.toContain('footer-more-trigger')
    expect(code).not.toContain('jg_tools_code')
    expect(code).not.toContain('usemap')
    // 纯内联样式，不依赖外部 CSS/JS
    expect(code).not.toContain('<style')
    expect(code).not.toContain('<script')
    // 原图像素写进 width/height 与 data-ow/data-oh，供浏览器算宽高比与再次导入
    expect(code).toContain('width="1920" height="649"')
    expect(code).toContain('data-ow="1920" data-oh="649"')
  })

  it('centred mode caps at the natural width, full-bleed mode fills the container', () => {
    const centred = generateStoreCode([image], { platform: 'generic', format: 'imagemap' })
    expect(centred).toContain('max-width:1920px;margin:0 auto;')

    const full = generateStoreCode([image], { platform: 'generic', format: 'layer' })
    expect(full).toContain('width:100%;line-height:0')
    expect(full).not.toContain('max-width')
  })

  it('round-trips its own output back into the same pixel coordinates', () => {
    const code = generateStoreCode([image], { platform: 'generic', format: 'layer' })
    const imported = importStoreCode(code)
    expect(imported).toHaveLength(1)
    expect(imported[0]).toMatchObject({ width: 1920, height: 649 })
    // 百分比坐标换算回原图像素，允许 1px 的四舍五入误差
    const hotspot = imported[0].hotspots[0]
    expect(hotspot.x).toBeCloseTo(880, -0.5)
    expect(hotspot.y).toBeCloseTo(66, -0.5)
    expect(hotspot.width).toBeCloseTo(743, -0.5)
    expect(hotspot.height).toBeCloseTo(573, -0.5)
    expect(hotspot.href).toBe('https://detail.tmall.com/item.htm?id=1&skuId=2')
  })

  it('stacks multiple images with no gap', () => {
    const second: ImageAsset = { ...image, id: 'image-2', url: 'https://img.example.com/b.jpg', hotspots: [] }
    const code = generateStoreCode([image, second], { platform: 'generic', format: 'layer' })
    expect(code.match(/<img /g)).toHaveLength(2)
    // 外层与每块都压掉行内元素间隙
    expect(code.match(/line-height:0;font-size:0/g)?.length).toBeGreaterThanOrEqual(3)
  })
})

describe('layer container height that differs from the image natural height', () => {
  // 用户线上遇到的形态：容器写 769px，但原图其实是 1920x700。
  // 沿用容器高度会让导出的 center center 背景上下各留白 (769-700)/2 = 34.5px。
  const layerCode = (h: number) =>
    `<div style="height:${h}px;" class="jg_tools_code xx_diy_code"><div class="sn-simple-logo jgabs" style="position:absolute;width:990px;height:${h}px;top:auto;left:auto;"><div class="sn-simple-logo jgabs" style="position:absolute;width:1920px;height:${h}px;top:auto;left:-465px;"><div style="height:${h}px;width:1920px;position:relative;background:transparent url(//img.example.com/k.jpg) no-repeat center center scroll;overflow:hidden;" data-w="mk"><div data-w="area" style="position:absolute;left:300px;top:138px;width:513px;height:584px;"><a href="//a.example.com" target="_blank" style="display:block;width:100%;height:100%;"></a></div></div></div></div></div>`

  it('async import takes the image natural height, not the container height', async () => {
    ;(loadImageDimensions as Mock).mockResolvedValue({ width: 1920, height: 700 })
    const { images } = await importStoreCodeAsync(layerCode(769))
    // 图片按真实原图尺寸导入，而不是容器声明的 769
    expect(images[0]).toMatchObject({ width: 1920, height: 700 })
    // 热点从容器空间减去居中留白 (769-700)/2 = 34.5，落回原图像素空间
    expect(images[0].hotspots[0]).toMatchObject({ x: 300, y: 104, width: 513, height: 584 })
  })

  it('re-exporting the corrected asset leaves no top/bottom gap', async () => {
    ;(loadImageDimensions as Mock).mockResolvedValue({ width: 1920, height: 700 })
    const { images } = await importStoreCodeAsync(layerCode(769))
    const code = generateStoreCode(images, { platform: 'tmall990', format: 'layer' })
    // 容器高度 == 原图高度 → center center 不再留白
    expect(code).toContain('height:700px;width:1920px')
    expect(code).not.toContain('height:769px')
  })

  it('sync import still falls back to the declared container size', () => {
    const imported = importStoreCode(layerCode(769))
    expect(imported[0]).toMatchObject({ width: 1920, height: 769 })
    expect(imported[0].hotspots[0]).toMatchObject({ x: 300, y: 138 })
  })
})

describe('import external code whose img carries no dimensions', () => {
  it('sync import falls back and keeps area coords untouched', () => {
    const code = '<div><img src="//cdn/x.jpg" usemap="#m" /><map name="m"><area coords="10,20,110,170" href="//a.com" /></map></div>'
    const imported = importStoreCode(code)
    expect(imported).toHaveLength(1)
    expect(imported[0]).toMatchObject({ width: 1920, height: 0 })
    expect(imported[0].hotspots[0]).toMatchObject({ x: 10, y: 20, width: 100, height: 150 })
  })

  it('async import fills natural size for a dimension-less usemap img (magong export)', async () => {
    ;(loadImageDimensions as Mock).mockResolvedValueOnce({ width: 990, height: 150 })
    const code = '<div class="J_TWidget maGong"><img src="//gdp.alicdn.com/x.jpg" usemap="#IPNQC" /><map name="IPNQC"><area coords="138,92,202,149" href="//kinder.tmall.com" target="_blank" /></map></div>'
    const { images, missingSize } = await importStoreCodeAsync(code)
    expect(missingSize).toBe(0)
    expect(images[0]).toMatchObject({ width: 990, height: 150 })
    // 无 width 属性时 area 坐标就是原图像素，不再缩放
    expect(images[0].hotspots[0]).toMatchObject({ x: 138, y: 92, width: 64, height: 57 })
  })

  it('async import scales declared-space coords up to natural space', async () => {
    ;(loadImageDimensions as Mock).mockResolvedValueOnce({ width: 1920, height: 300 })
    const code = '<div><img src="//cdn/x.jpg" width="960" height="150" usemap="#m" /><map name="m"><area coords="0,0,480,75" href="//a.com" /></map></div>'
    const { images } = await importStoreCodeAsync(code)
    expect(images[0].width).toBe(1920)
    // area 写在 960 渲染空间，scale=0.5，还原回 1920 空间要 ×2
    expect(images[0].hotspots[0]).toMatchObject({ x: 0, y: 0, width: 960, height: 150 })
  })

  it('async import keeps fallback and counts missingSize when the image cannot load', async () => {
    ;(loadImageDimensions as Mock).mockRejectedValueOnce(new Error('network down'))
    const code = '<div><img src="//cdn/x.jpg" usemap="#m" /><map name="m"><area coords="1,2,3,4" href="//a.com" /></map></div>'
    const { images, missingSize } = await importStoreCodeAsync(code)
    expect(missingSize).toBe(1)
    expect(images[0]).toMatchObject({ width: 1920, height: 0 })
  })
})
