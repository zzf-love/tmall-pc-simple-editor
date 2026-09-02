// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { generateStoreCode, importStoreCode } from './code'
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
})

