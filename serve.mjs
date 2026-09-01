import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'dist')
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

const port = Number(process.env.PUTU_PORT) || 47317
const url = `http://127.0.0.1:${port}/`

const openBrowser = () => {
  if (process.env.PUTU_NO_OPEN === '1') return
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
  } else {
    spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], {
      detached: true,
      stdio: 'ignore',
    }).unref()
  }
}

const server = createServer(async (request, response) => {
  try {
    const requestPath = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname)
    const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '')
    let filePath = normalize(join(root, relative))
    if (!filePath.startsWith(normalize(root))) throw new Error('invalid path')
    try {
      const info = await stat(filePath)
      if (info.isDirectory()) filePath = join(filePath, 'index.html')
    } catch {
      filePath = join(root, 'index.html')
    }
    const content = await readFile(filePath)
    response.writeHead(200, { 'Content-Type': mime[extname(filePath).toLowerCase()] || 'application/octet-stream' })
    response.end(content)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found')
  }
})

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.log(`PC端简易装修(天猫版)已经在运行：${url}`)
    openBrowser()
    process.exit(0)
  }
  throw error
})

server.listen(port, '127.0.0.1', () => {
  console.log('')
  console.log(`  PC端简易装修(天猫版)已启动：${url}`)
  console.log('  关闭此窗口即可停止；项目内容会自动保存在浏览器中。')
  console.log('')
  openBrowser()
})

