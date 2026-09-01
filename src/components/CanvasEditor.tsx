import {
  Crosshair,
  Minus,
  MousePointer2,
  Plus,
  Redo2,
  Undo2,
  ZoomIn,
} from 'lucide-react'
import { useRef, useState } from 'react'
import type { EditorMode, HandleDirection, Hotspot, ImageAsset } from '../types'

interface CanvasEditorProps {
  images: ImageAsset[]
  selectedImageId: string | null
  selectedHotspotId: string | null
  mode: EditorMode
  zoom: number
  canUndo: boolean
  canRedo: boolean
  showHotspots: boolean
  onModeChange: (mode: EditorMode) => void
  onZoomChange: (zoom: number) => void
  onSelectImage: (id: string) => void
  onSelectHotspot: (imageId: string, hotspotId: string) => void
  onCreateHotspot: (imageId: string, rectangle: Pick<Hotspot, 'x' | 'y' | 'width' | 'height'>) => void
  onUpdateHotspotTransient: (
    imageId: string,
    hotspotId: string,
    patch: Partial<Hotspot>,
  ) => void
  onFinishTransient: () => void
  onUndo: () => void
  onRedo: () => void
}

type Rectangle = Pick<Hotspot, 'x' | 'y' | 'width' | 'height'>

type DragState = {
  type: 'move' | 'resize'
  imageId: string
  hotspotId: string
  startX: number
  startY: number
  initial: Rectangle
  direction?: HandleDirection
}

const handles: HandleDirection[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

const limit = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

function resizeRectangle(
  initial: Rectangle,
  direction: HandleDirection,
  dx: number,
  dy: number,
  image: ImageAsset,
) {
  let left = initial.x
  let top = initial.y
  let right = initial.x + initial.width
  let bottom = initial.y + initial.height

  if (direction.includes('w')) left = limit(initial.x + dx, 0, right - 20)
  if (direction.includes('e')) right = limit(right + dx, left + 20, image.width)
  if (direction.includes('n')) top = limit(initial.y + dy, 0, bottom - 20)
  if (direction.includes('s')) bottom = limit(bottom + dy, top + 20, image.height)

  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function CanvasEditor({
  images,
  selectedImageId,
  selectedHotspotId,
  mode,
  zoom,
  canUndo,
  canRedo,
  showHotspots,
  onModeChange,
  onZoomChange,
  onSelectImage,
  onSelectHotspot,
  onCreateHotspot,
  onUpdateHotspotTransient,
  onFinishTransient,
  onUndo,
  onRedo,
}: CanvasEditorProps) {
  const drag = useRef<DragState | null>(null)
  const drawStart = useRef<{ imageId: string; x: number; y: number } | null>(null)
  const [drawing, setDrawing] = useState<{ imageId: string; rectangle: Rectangle } | null>(null)
  const totalHeight = images.reduce((sum, image) => sum + image.height, 0)
  const canvasWidth = images[0]?.width || 1920

  const pointerPosition = (event: React.PointerEvent<HTMLElement>, element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left) / zoom,
      y: (event.clientY - rect.top) / zoom,
    }
  }

  const startMove = (
    event: React.PointerEvent<HTMLDivElement>,
    image: ImageAsset,
    hotspot: Hotspot,
  ) => {
    if (mode !== 'select') return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    onSelectHotspot(image.id, hotspot.id)
    drag.current = {
      type: 'move',
      imageId: image.id,
      hotspotId: hotspot.id,
      startX: event.clientX,
      startY: event.clientY,
      initial: hotspot,
    }
  }

  const startResize = (
    event: React.PointerEvent<HTMLSpanElement>,
    image: ImageAsset,
    hotspot: Hotspot,
    direction: HandleDirection,
  ) => {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      type: 'resize',
      direction,
      imageId: image.id,
      hotspotId: hotspot.id,
      startX: event.clientX,
      startY: event.clientY,
      initial: hotspot,
    }
  }

  const updateDrag = (event: React.PointerEvent<HTMLElement>, image: ImageAsset) => {
    const current = drag.current
    if (!current) return
    const dx = (event.clientX - current.startX) / zoom
    const dy = (event.clientY - current.startY) / zoom
    const patch =
      current.type === 'move'
        ? {
            x: limit(current.initial.x + dx, 0, image.width - current.initial.width),
            y: limit(current.initial.y + dy, 0, image.height - current.initial.height),
          }
        : resizeRectangle(current.initial, current.direction!, dx, dy, image)
    onUpdateHotspotTransient(current.imageId, current.hotspotId, patch)
  }

  const endDrag = () => {
    if (!drag.current) return
    drag.current = null
    onFinishTransient()
  }

  const startDraw = (event: React.PointerEvent<HTMLElement>, image: ImageAsset) => {
    onSelectImage(image.id)
    if (mode !== 'draw' || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = pointerPosition(event, event.currentTarget)
    const x = limit(point.x, 0, image.width)
    const y = limit(point.y, 0, image.height)
    drawStart.current = { imageId: image.id, x, y }
    setDrawing({ imageId: image.id, rectangle: { x, y, width: 0, height: 0 } })
  }

  const updateDraw = (event: React.PointerEvent<HTMLElement>, image: ImageAsset) => {
    const start = drawStart.current
    if (!start || start.imageId !== image.id) return
    const point = pointerPosition(event, event.currentTarget)
    const currentX = limit(point.x, 0, image.width)
    const currentY = limit(point.y, 0, image.height)
    setDrawing({
      imageId: image.id,
      rectangle: {
        x: Math.min(start.x, currentX),
        y: Math.min(start.y, currentY),
        width: Math.abs(currentX - start.x),
        height: Math.abs(currentY - start.y),
      },
    })
  }

  const endDraw = () => {
    if (drawing && drawing.rectangle.width >= 20 && drawing.rectangle.height >= 20) {
      onCreateHotspot(drawing.imageId, drawing.rectangle)
      onModeChange('select')
    }
    drawStart.current = null
    setDrawing(null)
  }

  return (
    <main className={`canvas-area is-${mode} ${showHotspots ? '' : 'hotspots-hidden'}`}>
      <div className="canvas-toolbar" aria-label="画布工具栏">
        <div className="tool-group">
          <button
            className={`tool-button ${mode === 'select' ? 'is-active' : ''}`}
            type="button"
            onClick={() => onModeChange('select')}
            title="选择与移动热点 (V)"
          >
            <MousePointer2 size={17} />
            选择
          </button>
          <button
            className={`tool-button ${mode === 'draw' ? 'is-active' : ''}`}
            type="button"
            onClick={() => onModeChange('draw')}
            title="直接在图片上框选热点 (H)"
          >
            <Crosshair size={17} />
            框选热点
          </button>
        </div>
        <div className="tool-divider" />
        <div className="tool-group">
          <button className="tool-button tool-button--icon" type="button" onClick={onUndo} disabled={!canUndo} title="撤销 (Ctrl+Z)">
            <Undo2 size={17} />
          </button>
          <button className="tool-button tool-button--icon" type="button" onClick={onRedo} disabled={!canRedo} title="重做 (Ctrl+Shift+Z)">
            <Redo2 size={17} />
          </button>
        </div>
        {mode === 'draw' && <span className="drawing-hint">在图片上按住鼠标拖拽</span>}
      </div>

      <div className="canvas-scroll">
        <div className="canvas-stage">
          <div className="width-guide" style={{ width: canvasWidth * zoom }}>
            <span>0</span>
            <span>{Math.round(canvasWidth / 4)}</span>
            <span>{Math.round(canvasWidth / 2)}</span>
            <span>{Math.round((canvasWidth / 4) * 3)}</span>
            <span>{canvasWidth}</span>
            <strong>画布宽度 {canvasWidth} px</strong>
          </div>

          {!images.length ? (
            <div className="canvas-empty">
              <div className="canvas-empty__icon">
                <ZoomIn size={27} />
              </div>
              <h2>从一张图片开始</h2>
              <p>粘贴淘宝/天猫图片库链接，尺寸会自动识别。</p>
            </div>
          ) : (
            <div
              className="canvas-document-shell"
              style={{ width: canvasWidth * zoom, height: totalHeight * zoom }}
            >
              <div
                className="canvas-document"
                style={{ width: canvasWidth, height: totalHeight, transform: `scale(${zoom})` }}
              >
                {images.map((image) => (
                  <section
                    className={`canvas-image-wrap ${selectedImageId === image.id ? 'is-selected' : ''}`}
                    key={image.id}
                    style={{ width: image.width, height: image.height }}
                    onPointerDown={(event) => startDraw(event, image)}
                    onPointerMove={(event) => updateDraw(event, image)}
                    onPointerUp={endDraw}
                    onPointerCancel={endDraw}
                  >
                    <img
                      className="canvas-image"
                      src={image.url}
                      width={image.width}
                      height={image.height}
                      alt={image.name}
                      draggable={false}
                      referrerPolicy="no-referrer"
                    />
                    {showHotspots && image.hotspots.map((hotspot) => {
                      const selected = selectedHotspotId === hotspot.id
                      return (
                        <div
                          className={`hotspot ${selected ? 'is-selected' : ''}`}
                          key={hotspot.id}
                          style={{
                            left: hotspot.x,
                            top: hotspot.y,
                            width: hotspot.width,
                            height: hotspot.height,
                          }}
                          onPointerDown={(event) => startMove(event, image, hotspot)}
                          onPointerMove={(event) => updateDrag(event, image)}
                          onPointerUp={endDrag}
                          onPointerCancel={endDrag}
                        >
                          <span className="hotspot__label">{hotspot.label}</span>
                          {selected &&
                            handles.map((direction) => (
                              <span
                                className={`resize-handle resize-handle--${direction}`}
                                key={direction}
                                onPointerDown={(event) => startResize(event, image, hotspot, direction)}
                                onPointerMove={(event) => updateDrag(event, image)}
                                onPointerUp={endDrag}
                                onPointerCancel={endDrag}
                              />
                            ))}
                        </div>
                      )
                    })}
                    {drawing?.imageId === image.id && (
                      <div className="hotspot hotspot--drawing" style={drawing.rectangle}>
                        <span className="hotspot__measure">
                          {Math.round(drawing.rectangle.width)} × {Math.round(drawing.rectangle.height)}
                        </span>
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="canvas-zoom">
        <button
          className="icon-button icon-button--quiet"
          type="button"
          onClick={() => onZoomChange(Math.max(0.2, zoom - 0.1))}
          aria-label="缩小"
        >
          <Minus size={17} />
        </button>
        <button className="zoom-value" type="button" onClick={() => onZoomChange(0.52)}>
          {Math.round(zoom * 100)}%
        </button>
        <button
          className="icon-button icon-button--quiet"
          type="button"
          onClick={() => onZoomChange(Math.min(1, zoom + 0.1))}
          aria-label="放大"
        >
          <Plus size={17} />
        </button>
      </div>
    </main>
  )
}

