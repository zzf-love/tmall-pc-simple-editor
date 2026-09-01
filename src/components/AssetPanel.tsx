import {
  ChevronsLeft,
  ChevronsRight,
  GripVertical,
  ImagePlus,
  Link2,
  Plus,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import type { ImageAsset } from '../types'

interface AssetPanelProps {
  images: ImageAsset[]
  selectedImageId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
  onReorder: (fromId: string, toId: string) => void
  collapsed: boolean
  onToggleCollapsed: () => void
}

export function AssetPanel({
  images,
  selectedImageId,
  onSelect,
  onAdd,
  onDelete,
  onReorder,
  collapsed,
  onToggleCollapsed,
}: AssetPanelProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)

  return (
    <aside className={`asset-panel ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="panel-heading">
        <h2>图片</h2>
        <button
          className="icon-button icon-button--quiet asset-panel__toggle"
          type="button"
          aria-label={collapsed ? '展开图片面板' : '收起图片面板'}
          aria-expanded={!collapsed}
          onClick={onToggleCollapsed}
        >
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
        </button>
      </div>

      {collapsed ? null : (
        <div className="asset-panel__body">
          <button className="add-image-button" type="button" onClick={onAdd}>
            <Plus size={19} />
            添加图片
          </button>
          <button className="url-dropzone" type="button" onClick={onAdd}>
            <Link2 size={18} />
            <span>
              粘贴图片链接
              <small>自动识别尺寸，支持批量</small>
            </span>
          </button>

          <div className="asset-list" aria-label="图片列表">
            {images.map((image, index) => (
              <article
                className={`asset-row ${selectedImageId === image.id ? 'is-selected' : ''} ${
                  draggingId === image.id ? 'is-dragging' : ''
                }`}
                key={image.id}
                draggable
                onDragStart={() => setDraggingId(image.id)}
                onDragEnd={() => setDraggingId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggingId && draggingId !== image.id) onReorder(draggingId, image.id)
                  setDraggingId(null)
                }}
                onClick={() => onSelect(image.id)}
              >
                <div className="asset-row__drag" title="拖动排序">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <GripVertical size={15} />
                </div>
                <img src={image.url} alt="" referrerPolicy="no-referrer" />
                <div className="asset-row__content">
                  <strong title={image.name}>{image.name}</strong>
                  <span>
                    {image.width} × {image.height}
                  </span>
                  <small>{image.hotspots.length} 个热点</small>
                </div>
                <div className="asset-row__menu">
                  <button
                    className="icon-button icon-button--tiny danger-on-hover"
                    type="button"
                    aria-label={`删除 ${image.name}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onDelete(image.id)
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>

          {!images.length && (
            <div className="asset-empty">
              <ImagePlus size={26} />
              <strong>还没有图片</strong>
              <p>粘贴图片库链接后，尺寸会自动读取。</p>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}

