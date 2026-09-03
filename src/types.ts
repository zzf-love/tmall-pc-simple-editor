import type { CodeFormat, PlatformId, ProjectKind } from './lib/platform'

export type OpenTarget = '_blank' | '_self'

export interface Hotspot {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  href: string
  target: OpenTarget
}

export interface ImageAsset {
  id: string
  name: string
  url: string
  width: number
  height: number
  hotspots: Hotspot[]
}

/** 随存储槽一起记住的编辑器选择（平台/格式/项目类型/店招高度） */
export interface SlotSettings {
  platform: PlatformId
  codeFormat: CodeFormat
  projectKind: ProjectKind
  signHeight: number
}

export interface ProjectData {
  version: 1
  name: string
  canvasWidth: number
  images: ImageAsset[]
  updatedAt: string
  settings?: SlotSettings
}

export interface ProjectSlot extends ProjectData {
  id: string
}

export interface ProjectWorkspace {
  version: 1
  activeId: string
  projects: ProjectSlot[]
}

export type EditorMode = 'select' | 'draw'

export type HandleDirection =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'

