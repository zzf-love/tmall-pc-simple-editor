import { Check, Copy, FilePlus2, Image as ImageIcon, MousePointer2, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ProjectSlot } from '../types'
import { Modal } from './Modal'

interface ProjectSlotsProps {
  open: boolean
  projects: ProjectSlot[]
  activeId: string
  onClose: () => void
  onSwitch: (id: string) => void
  onCreate: () => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}

const formatUpdatedAt = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '刚刚保存'
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function ProjectSlots({
  open,
  projects,
  activeId,
  onClose,
  onSwitch,
  onCreate,
  onDuplicate,
  onDelete,
}: ProjectSlotsProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) setPendingDeleteId(null)
  }, [open])

  return (
    <Modal
      open={open}
      title="页面存储槽"
      description="每个槽都是一套独立页面；切换前后都会自动保存。"
      wide
      onClose={() => {
        setPendingDeleteId(null)
        onClose()
      }}
      footer={
        <>
          <span className="slot-storage-note">图片只保存链接，因此可以放心创建多个页面。</span>
          <div className="footer-spacer" />
          <button className="primary-button" type="button" onClick={onCreate}>
            <FilePlus2 size={17} />
            新建空白页面
          </button>
        </>
      }
    >
      <div className="slot-list" aria-label="页面存储槽列表">
        {projects.map((project, index) => {
          const hotspotCount = project.images.reduce((sum, image) => sum + image.hotspots.length, 0)
          const active = project.id === activeId
          const pendingDelete = project.id === pendingDeleteId
          return (
            <article className={`slot-row ${active ? 'is-active' : ''}`} key={project.id}>
              <button className="slot-row__main" type="button" onClick={() => onSwitch(project.id)}>
                <span className="slot-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="slot-row__content">
                  <span className="slot-row__title">
                    <strong>{project.name || `未命名页面 ${index + 1}`}</strong>
                    {active && <em><Check size={12} />当前页面</em>}
                  </span>
                  <span className="slot-row__meta">
                    <span><ImageIcon size={13} />{project.images.length} 张图片</span>
                    <span><MousePointer2 size={13} />{hotspotCount} 个热点</span>
                    <span>保存于 {formatUpdatedAt(project.updatedAt)}</span>
                  </span>
                </span>
              </button>
              <div className="slot-row__actions">
                {pendingDelete ? (
                  <>
                    <button className="slot-confirm-delete" type="button" onClick={() => {
                      onDelete(project.id)
                      setPendingDeleteId(null)
                    }}>
                      确认删除
                    </button>
                    <button className="slot-cancel-delete" type="button" onClick={() => setPendingDeleteId(null)}>
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <button className="slot-action" type="button" onClick={() => onDuplicate(project.id)} title="复制为新页面">
                      <Copy size={15} />
                      复制
                    </button>
                    <button
                      className="slot-action slot-action--danger"
                      type="button"
                      disabled={projects.length === 1}
                      onClick={() => setPendingDeleteId(project.id)}
                      title={projects.length === 1 ? '至少保留一个存储槽' : '删除存储槽'}
                    >
                      <Trash2 size={15} />
                      删除
                    </button>
                  </>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </Modal>
  )
}

