import {
  ChevronDown,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Link2,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import type { Hotspot, ImageAsset } from '../types'

interface InspectorProps {
  image: ImageAsset | null
  hotspot: Hotspot | null
  onUpdateHotspot: (patch: Partial<Hotspot>) => void
  onDeleteHotspot: () => void
  onDuplicateHotspot: () => void
  onUpdateImage: (patch: Partial<ImageAsset>) => void
  onRefreshImage: () => void
  refreshing: boolean
  showHotspots: boolean
  onToggleHotspots: () => void
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <input
        type="number"
        min="0"
        step="1"
        value={Math.round(value)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function HotspotVisibilityToggle({
  checked,
  onToggle,
}: {
  checked: boolean
  onToggle: () => void
}) {
  return (
    <button
      className="inline-switch"
      type="button"
      aria-pressed={checked}
      onClick={onToggle}
    >
      <span className="inline-switch__copy">
        <strong>显示热点与编号</strong>
        <small>{checked ? '画布中显示全部热点标记' : '已隐藏，点击重新显示'}</small>
      </span>
      <span className={`switch ${checked ? 'is-on' : ''}`} aria-hidden="true" />
    </button>
  )
}

export function Inspector({
  image,
  hotspot,
  onUpdateHotspot,
  onDeleteHotspot,
  onDuplicateHotspot,
  onUpdateImage,
  onRefreshImage,
  refreshing,
  showHotspots,
  onToggleHotspots,
}: InspectorProps) {
  const hotspotNumber = hotspot?.label.match(/\d+/)?.[0] || ''
  const linkReady = Boolean(hotspot?.href.trim())

  return (
    <aside className="inspector">
      <div className="panel-heading">
        <div>
          {hotspot ? (
            <h2 className="hotspot-heading">
              <span>热点设置</span>
              <strong>{hotspotNumber}</strong>
            </h2>
          ) : (
            <>
              <h2>图片设置</h2>
              <span>{image?.name || '未选择内容'}</span>
            </>
          )}
        </div>
      </div>

      {!image && (
        <div className="inspector-empty">
          <ImageIcon size={27} />
          <strong>选择一张图片</strong>
          <p>选中画布或左侧图片后，可在这里修改地址与尺寸。</p>
        </div>
      )}

      {image && hotspot && (
        <>
          <section className="inspector-section">
            <label
              className={`field field--hotspot-link ${linkReady ? 'is-ready' : 'is-missing'}`}
              data-link-state={linkReady ? 'ready' : 'missing'}
            >
              <span>
                链接地址
                <em>{linkReady ? '已填写' : '待填写'}</em>
              </span>
              <div className="field-with-icon">
                <Link2 size={16} />
                <input
                  value={hotspot.href}
                  placeholder="https://detail.tmall.com/item.htm?id=..."
                  aria-invalid={!linkReady}
                  onChange={(event) => onUpdateHotspot({ href: event.target.value })}
                />
              </div>
            </label>
            <label className="field">
              <span>打开方式</span>
              <select
                value={hotspot.target}
                onChange={(event) =>
                  onUpdateHotspot({ target: event.target.value as Hotspot['target'] })
                }
              >
                <option value="_blank">新窗口</option>
                <option value="_self">当前窗口</option>
              </select>
            </label>
          </section>

          <section className="inspector-section">
            <details className="geometry-disclosure">
              <summary>
                <span>位置与尺寸</span>
                <small>
                  {Math.round(hotspot.x)}, {Math.round(hotspot.y)} · {Math.round(hotspot.width)} × {Math.round(hotspot.height)}
                </small>
                <ChevronDown size={15} aria-hidden="true" />
              </summary>
              <div className="number-grid">
                <NumberField label="X" value={hotspot.x} onChange={(x) => onUpdateHotspot({ x })} />
                <NumberField label="Y" value={hotspot.y} onChange={(y) => onUpdateHotspot({ y })} />
                <NumberField
                  label="W"
                  value={hotspot.width}
                  onChange={(width) => onUpdateHotspot({ width })}
                />
                <NumberField
                  label="H"
                  value={hotspot.height}
                  onChange={(height) => onUpdateHotspot({ height })}
                />
              </div>
            </details>
            <HotspotVisibilityToggle checked={showHotspots} onToggle={onToggleHotspots} />
          </section>

          <section className="inspector-section inspector-actions">
            <button className="text-action" type="button" onClick={onDuplicateHotspot}>
              <Copy size={16} />
              复制热点
            </button>
            <button className="text-action text-action--danger" type="button" onClick={onDeleteHotspot}>
              <Trash2 size={16} />
              删除热点
            </button>
          </section>
        </>
      )}

      {image && !hotspot && (
        <section className="inspector-section">
          <HotspotVisibilityToggle checked={showHotspots} onToggle={onToggleHotspots} />
        </section>
      )}

      {image && (
        <section className="inspector-section image-settings">
          <div className="section-title">
            <span>图片信息</span>
            <span className="auto-tag">自动识别</span>
          </div>
          <label className="field">
            <span>图片名称</span>
            <input value={image.name} onChange={(event) => onUpdateImage({ name: event.target.value })} />
          </label>
          <label className="field">
            <span>图片地址</span>
            <textarea
              rows={3}
              value={image.url}
              onChange={(event) => onUpdateImage({ url: event.target.value })}
            />
          </label>
          <div className="image-size-row">
            <div>
              <span>图片尺寸</span>
              <strong>
                {image.width} × {image.height}
              </strong>
            </div>
            <button className="secondary-button secondary-button--compact" type="button" onClick={onRefreshImage}>
              <RefreshCw className={refreshing ? 'is-spinning' : ''} size={15} />
              重新识别
            </button>
          </div>
          <a className="image-open-link" href={image.url} target="_blank" rel="noreferrer">
            <ExternalLink size={14} />
            打开原图
          </a>
        </section>
      )}
    </aside>
  )
}

