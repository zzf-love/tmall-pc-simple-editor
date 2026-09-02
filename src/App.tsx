import {
  Check,
  ChevronDown,
  Code2,
  Download,
  Eye,
  FileInput,
  FilePlus2,
  FolderOpen,
  HelpCircle,
  Import,
  Layers3,
  Save,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AssetPanel } from './components/AssetPanel'
import { CanvasEditor } from './components/CanvasEditor'
import { Inspector } from './components/Inspector'
import { Modal } from './components/Modal'
import { ProjectSlots } from './components/ProjectSlots'
import { useImageHistory } from './hooks/useImageHistory'
import { generateSignCode, generateStoreCode, importStoreCode, HIDE_NAV_CSS } from './lib/code'
import type { CodeFormat, PlatformId, ProjectKind } from './lib/platform'
import { CODE_FORMATS, PLATFORMS, PLATFORM_LIST, SIGN_HEIGHTS } from './lib/platform'
import {
  CANVAS_WIDTH,
  clampHotspot,
  downloadText,
  imageNameFromUrl,
  loadImageDimensions,
  projectFromImages,
  safeFileName,
  uid,
} from './lib/editor'
import type {
  EditorMode,
  Hotspot,
  ImageAsset,
  ProjectData,
  ProjectSlot,
  ProjectWorkspace,
} from './types'

const STORAGE_KEY = 'putu-editor-project-v1'
const WORKSPACE_KEY = 'putu-editor-workspace-v1'
const HOTSPOT_VISIBILITY_KEY = 'putu-editor-hotspot-visibility-v1'
const ASSET_PANEL_KEY = 'putu-editor-asset-panel-v1'

function createProjectSlot(name: string, images: ImageAsset[]): ProjectSlot {
  return {
    id: uid('project'),
    ...projectFromImages(name, images),
  }
}

function cloneImagesForSlot(images: ImageAsset[]) {
  return images.map((image) => ({
    ...image,
    id: uid('image'),
    hotspots: image.hotspots.map((hotspot) => ({ ...hotspot, id: uid('hotspot') })),
  }))
}

function persistWorkspace(projects: ProjectSlot[], activeId: string) {
  const workspace: ProjectWorkspace = { version: 1, activeId, projects }
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace))
}

function loadInitialWorkspace(): ProjectWorkspace {
  try {
    const savedWorkspace = localStorage.getItem(WORKSPACE_KEY)
    if (savedWorkspace) {
      const workspace = JSON.parse(savedWorkspace) as ProjectWorkspace
      if (workspace.version === 1 && Array.isArray(workspace.projects) && workspace.projects.length) {
        const activeId = workspace.projects.some((project) => project.id === workspace.activeId)
          ? workspace.activeId
          : workspace.projects[0].id
        return { ...workspace, activeId }
      }
    }

    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const project = JSON.parse(saved) as ProjectData
      if (project.version === 1 && Array.isArray(project.images)) {
        const migrated = createProjectSlot(project.name || '未命名店铺页', project.images)
        const workspace = { version: 1 as const, activeId: migrated.id, projects: [migrated] }
        persistWorkspace(workspace.projects, workspace.activeId)
        return workspace
      }
    }
  } catch {
    // Fall through to a clean first slot if local data is malformed.
  }

  const first = createProjectSlot('未命名店铺页', [])
  return { version: 1, activeId: first.id, projects: [first] }
}

function extractUrls(value: string) {
  const matches = value.match(/https?:\/\/[^\s<>"']+/gi) || []
  return [...new Set(matches.map((url) => url.replace(/[\])，。,；;]+$/, '')))]
}

function loadHotspotVisibility() {
  try {
    return localStorage.getItem(HOTSPOT_VISIBILITY_KEY) !== 'hidden'
  } catch {
    return true
  }
}

function loadAssetPanelCollapsed() {
  try {
    return localStorage.getItem(ASSET_PANEL_KEY) === 'collapsed'
  } catch {
    return false
  }
}

function App() {
  const initialWorkspace = useMemo(loadInitialWorkspace, [])
  const initialProject =
    initialWorkspace.projects.find((project) => project.id === initialWorkspace.activeId) ||
    initialWorkspace.projects[0]
  const [projects, setProjects] = useState(initialWorkspace.projects)
  const [activeProjectId, setActiveProjectId] = useState(initialProject.id)
  const [documentName, setDocumentName] = useState(initialProject.name)
  const {
    images,
    commit,
    replace,
    updateTransient,
    finishTransient,
    undo,
    redo,
    canUndo,
    canRedo,
    revision,
  } = useImageHistory(initialProject.images)
  const [selectedImageId, setSelectedImageId] = useState<string | null>(initialProject.images[0]?.id || null)
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(
    initialProject.images[0]?.hotspots[0]?.id || null,
  )
  const [mode, setMode] = useState<EditorMode>('select')
  const [zoom, setZoom] = useState(0.52)
  const [showHotspots, setShowHotspots] = useState(loadHotspotVisibility)
  const [assetPanelCollapsed, setAssetPanelCollapsed] = useState(loadAssetPanelCollapsed)
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [codeOpen, setCodeOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [slotsOpen, setSlotsOpen] = useState(false)
  const [addUrls, setAddUrls] = useState('')
  const [fallbackWidth, setFallbackWidth] = useState(1920)
  const [fallbackHeight, setFallbackHeight] = useState(0)
  const [importCode, setImportCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)
  const projectInput = useRef<HTMLInputElement>(null)
  const [platform, setPlatform] = useState<PlatformId>('tmall990')
  const [codeFormat, setCodeFormat] = useState<CodeFormat>('layer')
  const [projectKind, setProjectKind] = useState<ProjectKind>('page')
  const [signHeight, setSignHeight] = useState<number>(150)

  const generatedCode = useMemo(
    () =>
      projectKind === 'sign'
        ? generateSignCode(images[0], signHeight, { platform, format: codeFormat })
        : generateStoreCode(images, { platform, format: codeFormat }),
    [images, projectKind, signHeight, platform, codeFormat],
  )
  const totalHotspots = images.reduce((sum, image) => sum + image.hotspots.length, 0)

  const selectedImage = images.find((image) => image.id === selectedImageId) || null
  const selectedHotspot =
    selectedImage?.hotspots.find((hotspot) => hotspot.id === selectedHotspotId) || null

  const notify = useCallback((message: string) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = window.setTimeout(() => {
      setToast(null)
      toastTimer.current = null
    }, 2400)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(HOTSPOT_VISIBILITY_KEY, showHotspots ? 'visible' : 'hidden')
    } catch {
      // The preference is non-critical when browser storage is unavailable.
    }
  }, [showHotspots])

  useEffect(() => {
    try {
      localStorage.setItem(ASSET_PANEL_KEY, assetPanelCollapsed ? 'collapsed' : 'expanded')
    } catch {
      // The preference is non-critical when browser storage is unavailable.
    }
  }, [assetPanelCollapsed])

  useEffect(() => () => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
  }, [])

  useEffect(() => {
    const project = projectFromImages(documentName, images)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
    setProjects((current) => {
      const next = current.map((slot) =>
        slot.id === activeProjectId ? { id: activeProjectId, ...project } : slot,
      )
      persistWorkspace(next, activeProjectId)
      return next
    })
  }, [activeProjectId, documentName, images, revision])

  const snapshotCurrentProject = (current: ProjectSlot[]) => {
    const snapshot: ProjectSlot = {
      id: activeProjectId,
      ...projectFromImages(documentName, images),
    }
    return current.map((project) => (project.id === activeProjectId ? snapshot : project))
  }

  const activateProject = (project: ProjectSlot, nextProjects: ProjectSlot[], message: string) => {
    persistWorkspace(nextProjects, project.id)
    setProjects(nextProjects)
    setActiveProjectId(project.id)
    setDocumentName(project.name)
    replace(structuredClone(project.images))
    setSelectedImageId(project.images[0]?.id || null)
    setSelectedHotspotId(project.images[0]?.hotspots[0]?.id || null)
    setMode('select')
    setSlotsOpen(false)
    notify(message)
  }

  const switchProject = (id: string) => {
    if (id === activeProjectId) {
      setSlotsOpen(false)
      return
    }
    const nextProjects = snapshotCurrentProject(projects)
    const target = nextProjects.find((project) => project.id === id)
    if (!target) return
    activateProject(target, nextProjects, `已切换到“${target.name}”`)
  }

  const createBlankProject = () => {
    const savedProjects = snapshotCurrentProject(projects)
    const project = createProjectSlot(`未命名页面 ${savedProjects.length + 1}`, [])
    activateProject(project, [...savedProjects, project], '已新建空白页面')
  }

  const duplicateProject = (id: string) => {
    const savedProjects = snapshotCurrentProject(projects)
    const source = savedProjects.find((project) => project.id === id)
    if (!source) return
    const copy = createProjectSlot(`${source.name} 副本`, cloneImagesForSlot(source.images))
    const sourceIndex = savedProjects.findIndex((project) => project.id === id)
    const nextProjects = [...savedProjects]
    nextProjects.splice(sourceIndex + 1, 0, copy)
    activateProject(copy, nextProjects, `已复制“${source.name}”`)
  }

  const deleteProject = (id: string) => {
    if (projects.length <= 1) return notify('至少需要保留一个存储槽')
    const savedProjects = snapshotCurrentProject(projects)
    const removed = savedProjects.find((project) => project.id === id)
    const nextProjects = savedProjects.filter((project) => project.id !== id)
    if (id === activeProjectId) {
      const target = nextProjects[0]
      activateProject(target, nextProjects, `已删除“${removed?.name || '页面'}”并切换页面`)
      return
    }
    persistWorkspace(nextProjects, activeProjectId)
    setProjects(nextProjects)
    notify(`已删除“${removed?.name || '页面'}”`)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        event.shiftKey ? redo() : undo()
        return
      }
      if (editing) return
      if (event.key.toLowerCase() === 'v') setMode('select')
      if (event.key.toLowerCase() === 'h') setMode('draw')
      if (event.key === 'Escape') setMode('select')
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedHotspotId) {
        event.preventDefault()
        deleteSelectedHotspot()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const selectImage = (id: string) => {
    setSelectedImageId(id)
    setSelectedHotspotId(null)
  }

  const selectHotspot = (imageId: string, hotspotId: string) => {
    setSelectedImageId(imageId)
    setSelectedHotspotId(hotspotId)
  }

  const updateHotspot = (patch: Partial<Hotspot>, transient = false) => {
    if (!selectedImage || !selectedHotspot) return
    const updater = (current: ImageAsset[]) =>
      current.map((image) =>
        image.id === selectedImage.id
          ? {
              ...image,
              hotspots: image.hotspots.map((hotspot) =>
                hotspot.id === selectedHotspot.id
                  ? clampHotspot({ ...hotspot, ...patch }, image)
                  : hotspot,
              ),
            }
          : image,
      )
    transient ? updateTransient(updater) : commit(updater)
  }

  const updateHotspotById = (
    imageId: string,
    hotspotId: string,
    patch: Partial<Hotspot>,
  ) => {
    updateTransient((current) =>
      current.map((image) =>
        image.id === imageId
          ? {
              ...image,
              hotspots: image.hotspots.map((hotspot) =>
                hotspot.id === hotspotId ? clampHotspot({ ...hotspot, ...patch }, image) : hotspot,
              ),
            }
          : image,
      ),
    )
  }

  const updateImage = (patch: Partial<ImageAsset>) => {
    if (!selectedImage) return
    commit((current) => current.map((image) => (image.id === selectedImage.id ? { ...image, ...patch } : image)))
  }

  const createHotspot = (imageId: string, rectangle: Pick<Hotspot, 'x' | 'y' | 'width' | 'height'>) => {
    const image = images.find((item) => item.id === imageId)
    if (!image) return
    const id = uid('hotspot')
    const hotspot = clampHotspot(
      {
        id,
        label: `热点 ${String(image.hotspots.length + 1).padStart(2, '0')}`,
        ...rectangle,
        href: '',
        target: '_blank',
      },
      image,
    )
    commit((current) =>
      current.map((item) => (item.id === imageId ? { ...item, hotspots: [...item.hotspots, hotspot] } : item)),
    )
    setShowHotspots(true)
    selectHotspot(imageId, id)
    notify('热点已添加，右侧可粘贴商品链接')
  }

  function deleteSelectedHotspot() {
    if (!selectedImage || !selectedHotspotId) return
    commit((current) =>
      current.map((image) =>
        image.id === selectedImage.id
          ? { ...image, hotspots: image.hotspots.filter((hotspot) => hotspot.id !== selectedHotspotId) }
          : image,
      ),
    )
    setSelectedHotspotId(null)
    notify('热点已删除')
  }

  const duplicateHotspot = () => {
    if (!selectedImage || !selectedHotspot) return
    const hotspot = clampHotspot(
      {
        ...selectedHotspot,
        id: uid('hotspot'),
        label: `热点 ${String(selectedImage.hotspots.length + 1).padStart(2, '0')}`,
        x: selectedHotspot.x + 24,
        y: selectedHotspot.y + 24,
      },
      selectedImage,
    )
    commit((current) =>
      current.map((image) =>
        image.id === selectedImage.id ? { ...image, hotspots: [...image.hotspots, hotspot] } : image,
      ),
    )
    setSelectedHotspotId(hotspot.id)
    notify('热点副本已创建')
  }

  const deleteImage = (id: string) => {
    const index = images.findIndex((image) => image.id === id)
    commit((current) => current.filter((image) => image.id !== id))
    if (selectedImageId === id) {
      const next = images[index + 1] || images[index - 1]
      setSelectedImageId(next?.id || null)
      setSelectedHotspotId(null)
    }
    notify('图片已移除')
  }

  const reorderImages = (fromId: string, toId: string) => {
    commit((current) => {
      const from = current.findIndex((image) => image.id === fromId)
      const to = current.findIndex((image) => image.id === toId)
      if (from < 0 || to < 0) return current
      const next = [...current]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const addImages = async () => {
    const urls = extractUrls(addUrls)
    if (!urls.length) return notify('请粘贴至少一个 http(s) 图片链接')
    setBusy(true)
    const results = await Promise.allSettled(urls.map((url) => loadImageDimensions(url)))
    const added: ImageAsset[] = []
    let failed = 0
    results.forEach((result, index) => {
      const dimensions =
        result.status === 'fulfilled'
          ? result.value
          : fallbackWidth > 0 && fallbackHeight > 0
            ? { width: fallbackWidth, height: fallbackHeight }
            : null
      if (!dimensions) {
        failed += 1
        return
      }
      added.push({
        id: uid('image'),
        name: imageNameFromUrl(urls[index], images.length + index),
        url: urls[index],
        width: dimensions.width,
        height: dimensions.height,
        hotspots: [],
      })
    })
    setBusy(false)
    if (!added.length) return notify('图片读取失败，可补充备用宽高后重试')
    commit((current) => [...current, ...added])
    setSelectedImageId(added[0].id)
    setSelectedHotspotId(null)
    setAddOpen(false)
    setAddUrls('')
    notify(`已添加 ${added.length} 张图片${failed ? `，${failed} 张读取失败` : '，尺寸已自动识别'}`)
  }

  const refreshImage = async () => {
    if (!selectedImage) return
    setRefreshing(true)
    try {
      const size = await loadImageDimensions(selectedImage.url)
      updateImage(size)
      notify(`尺寸已更新为 ${size.width} × ${size.height}`)
    } catch (error) {
      notify(error instanceof Error ? error.message : '图片尺寸识别失败')
    } finally {
      setRefreshing(false)
    }
  }

  const doImportCode = () => {
    try {
      const imported = importStoreCode(importCode)
      replace(imported)
      setSelectedImageId(imported[0]?.id || null)
      setSelectedHotspotId(imported[0]?.hotspots[0]?.id || null)
      setImportOpen(false)
      setImportCode('')
      notify(`已从代码恢复 ${imported.length} 张图片和 ${imported.reduce((sum, image) => sum + image.hotspots.length, 0)} 个热点`)
    } catch (error) {
      notify(error instanceof Error ? error.message : '代码导入失败')
    }
  }

  const importProjectFile = async (file: File) => {
    try {
      const project = JSON.parse(await file.text()) as ProjectData
      if (project.version !== 1 || !Array.isArray(project.images)) throw new Error('不是有效的项目文件')
      replace(project.images)
      setDocumentName(project.name || file.name.replace(/\.putu\.json$/i, ''))
      setSelectedImageId(project.images[0]?.id || null)
      setSelectedHotspotId(project.images[0]?.hotspots[0]?.id || null)
      setImportOpen(false)
      notify('项目文件已导入')
    } catch (error) {
      notify(error instanceof Error ? error.message : '项目文件读取失败')
    }
  }

  const saveProject = () => {
    const project = projectFromImages(documentName, images)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
    downloadText(
      `${safeFileName(documentName)}.putu.json`,
      JSON.stringify(project, null, 2),
      'application/json;charset=utf-8',
    )
    notify('草稿已保存到浏览器并下载项目文件')
  }

  const copyCode = async () => {
    await navigator.clipboard.writeText(generatedCode)
    notify('装修代码已复制')
  }

  const preview = () => {
    if (!images.length) return notify('请先添加图片')
    const windowRef = window.open('', '_blank')
    if (!windowRef) return notify('浏览器阻止了预览窗口，请允许弹窗后重试')
    windowRef.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${documentName} · 预览</title><style>html,body{margin:0;padding:0;background:#f1f4f8;}body{display:flex;justify-content:center;overflow-x:hidden}.preview{width:990px;background:#fff;min-height:100vh}</style></head><body><div class="preview">${generatedCode}</div></body></html>`)
    windowRef.document.close()
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-group">
          {/* 版本徽标跟随当前所选平台，避免支持了淘宝却还挂着「天猫版」 */}
          <div className="brand-mark" aria-label={`热区工坊 HotZone Studio · ${PLATFORMS[platform].label}`}>
            <span className="brand-mark__name">热区工坊</span>
            <span className="brand-mark__edition">{PLATFORMS[platform].label}</span>
          </div>
          <div className="header-separator" />
          <label className="document-name">
            <span className="sr-only">项目名称</span>
            <input value={documentName} onChange={(event) => setDocumentName(event.target.value)} />
          </label>
          <button className="slot-trigger" type="button" onClick={() => setSlotsOpen(true)}>
            <Layers3 size={15} />
            <span>存储槽</span>
            <strong>{Math.max(1, projects.findIndex((project) => project.id === activeProjectId) + 1)}/{projects.length}</strong>
            <ChevronDown size={14} />
          </button>
          <span className="save-state">
            <Check size={13} />
            已自动保存
          </span>
        </div>
        <nav className="header-actions" aria-label="项目操作">
          <button className="header-button header-button--new" type="button" onClick={createBlankProject}>
            <FilePlus2 size={17} />
            新建页面
          </button>
          <button className="header-button" type="button" onClick={() => setImportOpen(true)}>
            <Import size={17} />
            导入代码
          </button>
          <button className="header-button" type="button" onClick={saveProject}>
            <Save size={17} />
            保存草稿
          </button>
          <button className="header-button" type="button" onClick={preview}>
            <Eye size={17} />
            预览
          </button>
          <button className="primary-button" type="button" onClick={() => setCodeOpen(true)} disabled={!images.length}>
            <Code2 size={18} />
            生成代码
          </button>
          <button className="icon-button help-button" type="button" aria-label="使用帮助" onClick={() => setHelpOpen(true)}>
            <HelpCircle size={19} />
          </button>
        </nav>
      </header>

      <div className={`workspace ${assetPanelCollapsed ? 'is-assets-collapsed' : ''}`}>
        <AssetPanel
          images={images}
          selectedImageId={selectedImageId}
          onSelect={selectImage}
          onAdd={() => setAddOpen(true)}
          onDelete={deleteImage}
          onReorder={reorderImages}
          collapsed={assetPanelCollapsed}
          onToggleCollapsed={() => setAssetPanelCollapsed((collapsed) => !collapsed)}
        />
        <CanvasEditor
          images={images}
          selectedImageId={selectedImageId}
          selectedHotspotId={selectedHotspotId}
          mode={mode}
          zoom={zoom}
          canUndo={canUndo}
          canRedo={canRedo}
          showHotspots={showHotspots}
          onModeChange={setMode}
          onZoomChange={setZoom}
          onSelectImage={selectImage}
          onSelectHotspot={selectHotspot}
          onCreateHotspot={createHotspot}
          onUpdateHotspotTransient={updateHotspotById}
          onFinishTransient={finishTransient}
          onUndo={undo}
          onRedo={redo}
        />
        <Inspector
          image={selectedImage}
          hotspot={selectedHotspot}
          onUpdateHotspot={(patch) => updateHotspot(patch)}
          onDeleteHotspot={deleteSelectedHotspot}
          onDuplicateHotspot={duplicateHotspot}
          onUpdateImage={updateImage}
          onRefreshImage={refreshImage}
          refreshing={refreshing}
          showHotspots={showHotspots}
          onToggleHotspots={() => setShowHotspots((visible) => !visible)}
        />
      </div>

      <footer className="status-bar">
        <div><span>画布宽度</span><strong>{CANVAS_WIDTH} px</strong></div>
        <i />
        <div><span>图片</span><strong>{images.length}</strong></div>
        <i />
        <div><span>热点</span><strong>{totalHotspots}</strong></div>
        <i />
        <div className="gap-status"><Check size={15} /><span>图片间隙</span><strong>0 px</strong></div>
        <div className="status-spacer" />
        <span className="shortcut-tip">V 选择 · H 框选热点 · Delete 删除 · Ctrl Z 撤销</span>
      </footer>

      <ProjectSlots
        open={slotsOpen}
        projects={projects}
        activeId={activeProjectId}
        onClose={() => setSlotsOpen(false)}
        onSwitch={switchProject}
        onCreate={createBlankProject}
        onDuplicate={duplicateProject}
        onDelete={deleteProject}
      />

      <Modal
        open={addOpen}
        title="添加图片"
        description="每行一个图片库链接，也可以一次粘贴多条；尺寸会自动读取。"
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <button className="secondary-button" type="button" onClick={() => setAddOpen(false)}>取消</button>
            <button className="primary-button" type="button" disabled={busy || !addUrls.trim()} onClick={addImages}>
              {busy ? <span className="button-spinner" /> : <Upload size={17} />}
              {busy ? '正在识别…' : '识别并添加'}
            </button>
          </>
        }
      >
        <label className="field field--large">
          <span>图片地址</span>
          <textarea
            autoFocus
            rows={7}
            value={addUrls}
            placeholder={'https://img.alicdn.com/imgextra/.../your-image.jpg\n每行粘贴一个图片链接'}
            onChange={(event) => setAddUrls(event.target.value)}
          />
          <small>支持 img.alicdn.com 等可公开访问的 http(s) 图片。</small>
        </label>
        <div className="fallback-size">
          <div>
            <strong>无法读取时使用备用尺寸</strong>
            <span>通常不需要填写；遇到防盗链时再补充。</span>
          </div>
          <label><span>宽</span><input type="number" min="1" value={fallbackWidth} onChange={(e) => setFallbackWidth(Number(e.target.value))} /></label>
          <label><span>高</span><input type="number" min="0" value={fallbackHeight} onChange={(e) => setFallbackHeight(Number(e.target.value))} placeholder="自动" /></label>
        </div>
      </Modal>

      <Modal
        open={importOpen}
        title="导入并继续编辑"
        description="可识别本工具生成的代码，也尽量兼容旧工具的背景图与热点结构。"
        wide
        onClose={() => setImportOpen(false)}
        footer={
          <>
            <button className="secondary-button" type="button" onClick={() => projectInput.current?.click()}>
              <FolderOpen size={16} />
              导入项目文件
            </button>
            <div className="footer-spacer" />
            <button className="secondary-button" type="button" onClick={() => setImportOpen(false)}>取消</button>
            <button className="primary-button" type="button" disabled={!importCode.trim()} onClick={doImportCode}>
              <FileInput size={17} />
              解析代码
            </button>
          </>
        }
      >
        <label className="field field--large">
          <span>粘贴 HTML 装修代码</span>
          <textarea
            className="code-input"
            autoFocus
            rows={13}
            value={importCode}
            placeholder="<div class=&quot;jg_tools_code xx_diy_code&quot;>...</div>"
            onChange={(event) => setImportCode(event.target.value)}
          />
        </label>
        <input
          ref={projectInput}
          type="file"
          accept=".json,.putu.json,application/json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void importProjectFile(file)
            event.target.value = ''
          }}
        />
      </Modal>

      <Modal
        open={codeOpen}
        title="装修代码已生成"
        description={
          projectKind === 'sign'
            ? `店招单图 · ${PLATFORMS[platform].width}×${signHeight}，${images[0]?.hotspots.length ?? 0} 个热点。`
            : `共 ${images.length} 张图片、${totalHotspots} 个热点，已按 0 px 间隙拼接。`
        }
        wide
        onClose={() => setCodeOpen(false)}
        footer={
          <>
            <span className="code-safety"><Check size={14} /> {PLATFORMS[platform].setupHint}</span>
            <div className="footer-spacer" />
            <button className="secondary-button" type="button" onClick={() => downloadText(`${safeFileName(documentName)}.html`, generatedCode, 'text/html;charset=utf-8')}>
              <Download size={16} />
              下载 HTML
            </button>
            <button className="primary-button" type="button" onClick={copyCode}>
              <Code2 size={17} />
              复制代码
            </button>
          </>
        }
      >
        <div className="export-options">
          <label>
            <span>项目类型</span>
            <select value={projectKind} onChange={(event) => setProjectKind(event.target.value as ProjectKind)}>
              <option value="page">页面装修（多图拼接）</option>
              <option value="sign">店招（单图 · 固定高度）</option>
            </select>
          </label>
          <label>
            <span>平台</span>
            <select value={platform} onChange={(event) => setPlatform(event.target.value as PlatformId)}>
              {PLATFORM_LIST.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
            <small>数字是后台自定义内容区的宽度，要和「布局管理」里添加的布局一致</small>
          </label>
          <label>
            <span>代码格式</span>
            <select value={codeFormat} onChange={(event) => setCodeFormat(event.target.value as CodeFormat)}>
              {CODE_FORMATS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          {projectKind === 'sign' && (
            <label>
              <span>店招高度</span>
              <select value={signHeight} onChange={(event) => setSignHeight(Number(event.target.value))}>
                {SIGN_HEIGHTS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <p className="export-hint">
          {CODE_FORMATS.find((item) => item.id === codeFormat)?.hint}
          {projectKind === 'sign' && ' 店招代码粘到「店铺招牌 → 自定义招牌 → 源码」。'}
        </p>
        <textarea className="generated-code" rows={projectKind === 'sign' ? 12 : 17} readOnly value={generatedCode} onFocus={(event) => event.currentTarget.select()} />
        {projectKind === 'sign' && signHeight === 150 && (
          <details className="export-extra">
            <summary>自制导航需要隐藏系统导航（点开复制 CSS）</summary>
            <p>粘到「系统导航 → 显示设置」的 CSS 框里。注意：店招图片代码不要粘进这个框。</p>
            <textarea className="generated-code" rows={3} readOnly value={HIDE_NAV_CSS} onFocus={(event) => event.currentTarget.select()} />
          </details>
        )}
      </Modal>

      <Modal open={helpOpen} title="三步完成店铺页面" onClose={() => setHelpOpen(false)}>
        <ol className="help-steps">
          <li><span>1</span><div><strong>粘贴图片链接</strong><p>点击左侧“添加图片”，可一次粘贴多条链接并自动读取尺寸。</p></div></li>
          <li><span>2</span><div><strong>直接框选热点</strong><p>点击“框选热点”后在图片上拖拽；再在右侧粘贴商品链接。</p></div></li>
          <li><span>3</span><div><strong>生成并复制代码</strong><p>所有图片自动无缝拼接；以后可导入代码或项目文件继续修改。</p></div></li>
        </ol>
        <div className="help-note"><Sparkles size={17} /><span>项目会自动保存在当前浏览器中，建议同时下载草稿文件备份。</span></div>
      </Modal>

      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          <button type="button" aria-label="关闭提示" onClick={() => setToast(null)}><X size={15} /></button>
        </div>
      )}
    </div>
  )
}

export default App

