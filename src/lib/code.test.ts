// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { generateSignCode, generateStoreCode, importStoreCode } from './code'
import type { ImageAsset } from '../types'

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

    const basic = generateStoreCode([image], { platform: 'taobao750' })
    expect(basic).toContain('width:750px')
    expect(basic).toContain('left:-585px') // -(1920-750)/2
  })

  it('emits an image map and reads it back', () => {
    const code = generateStoreCode([image], { platform: 'tmall990', format: 'imagemap' })
    expect(code).toContain('usemap="#')
    expect(code).toContain('<map name="')
    // 1920 原图缩到 990：坐标同比 × (990/1920)
    expect(code).toContain('coords="454,34,837,329"')
    expect(code).not.toContain('background:transparent url')

    const imported = importStoreCode(code)
    expect(imported).toHaveLength(1)
    expect(imported[0].url).toBe(image.url)
    expect(imported[0].hotspots[0]).toMatchObject({ x: 454, y: 34, href: image.hotspots[0].href })
  })

  it('parses a real-world image map from a live shop sign', () => {
    // 现网天猫店招（990×150，img usemap + map/area），验证外部结构可导入
    const live = `<div class="J_TWidget maGong" style="height:150px;margin:0 auto;">
      <img src="//gdp.alicdn.com/x.jpg" width="990" height="150" usemap="#IPNQC" />
      <map name="IPNQC"><area coords="138,92,202,149" href="//kinder.tmall.com/search.htm" target="_blank" /></map></div>`
    const imported = importStoreCode(live)
    expect(imported).toHaveLength(1)
    expect(imported[0].width).toBe(990)
    expect(imported[0].hotspots[0]).toMatchObject({ x: 138, y: 92, width: 64, height: 57 })
  })

  it('generates a fixed-height sign for both formats', () => {
    const map = generateSignCode(image, 150, { platform: 'tmall990', format: 'imagemap' })
    expect(map).toContain('width:990px;height:150px')
    expect(map).toContain('usemap="#')

    const layer = generateSignCode(image, 120, { platform: 'taobao950', format: 'layer' })
    expect(layer).toContain('width:950px;height:120px')
    expect(layer).toContain('data-w="area"')
    expect(generateSignCode(undefined, 150)).toBe('')
  })
})

