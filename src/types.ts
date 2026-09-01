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

export interface ProjectData {
  version: 1
  name: string
  canvasWidth: number
  images: ImageAsset[]
  updatedAt: string
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

