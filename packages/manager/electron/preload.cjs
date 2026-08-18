/**
 * Chronicle Manager — Electron Preload Script
 *
 * Minimal bridge between renderer (Vue SPA) and Node.js backend.
 * Exposes safe APIs via contextBridge for future use (file system access,
 * native dialogs, etc.).
 */

const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('chronicleElectron', {
  // Platform info
  platform: process.platform,
  isElectron: true,

  // Resolve File object → filesystem path (Electron 32+).
  // Falls back to empty string for non-backed files (in-memory blobs, etc.).
  getPathForFile: (file) => webUtils.getPathForFile(file),

  // Read a file from disk by absolute path → base64 string.
  // Used as fallback when fileMap is empty (page refresh) and
  // fetch('file:///...') is blocked by CSP or SOP.
  readFileByPath: (absPath) => ipcRenderer.invoke('read-file-by-path', absPath),

  // Window controls (frameless window)
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onMaximizeChange: (callback) => {
    ipcRenderer.on('window-maximize-change', (_event, isMaximized) => callback(isMaximized));
  },

  // Generic invoke with an explicit allow-list (git:sync / git:status etc.)
  invoke(channel, ...args) {
    const allowed = ['git:sync', 'git:status', 'posts:reindex', 'fs:getStorageStats'];
    if (allowed.includes(channel)) return ipcRenderer.invoke(channel, ...args);
    return Promise.reject(new Error('IPC channel not allowed: ' + channel));
  },

  // IPC channels (placeholder for future use)
  send(channel, data) {
    const allowed = ['open-file', 'save-file', 'set-title'];
    if (allowed.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  on(channel, callback) {
    const allowed = ['file-opened', 'file-saved'];
    if (allowed.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },

  // Browser login for Passkey 2FA (WebAuthn not available in Electron)
  // (removed — local-first Aurora has no login)

  // Print: write standalone HTML to a temp file and open in system browser
  openPrintInBrowser: (html, title) => ipcRenderer.invoke('open-print-in-browser', html, title),

  // Safe subset of process.env
  env: {
  },

  // ═══════════════════════════════════════════════════════════
  // File system operations (replaces Host API)
  // All paths are relative to the repository root.
  // ═══════════════════════════════════════════════════════════
  readYaml: (relativePath) => ipcRenderer.invoke('fs:readYaml', relativePath),
  writeYaml: (relativePath, data) => ipcRenderer.invoke('fs:writeYaml', relativePath, data),
  readJson: (relativePath) => ipcRenderer.invoke('fs:readJson', relativePath),
  writeJson: (relativePath, data) => ipcRenderer.invoke('fs:writeJson', relativePath, data),
  readDir: (relativePath) => ipcRenderer.invoke('fs:readDir', relativePath),
  exists: (relativePath) => ipcRenderer.invoke('fs:exists', relativePath),
  mkdir: (relativePath) => ipcRenderer.invoke('fs:mkdir', relativePath),
  getRepoRoot: () => ipcRenderer.invoke('fs:getRepoRoot'),
  getDataDir: () => ipcRenderer.invoke('fs:getDataDir'),
  readText: (relativePath) => ipcRenderer.invoke('fs:readText', relativePath),
  writeText: (relativePath, content) => ipcRenderer.invoke('fs:writeText', relativePath, content),
  deleteDir: (relativePath) => ipcRenderer.invoke('fs:deleteDir', relativePath),
  deleteFile: (relativePath) => ipcRenderer.invoke('fs:deleteFile', relativePath),
  writeBase64: (relativePath, base64) => ipcRenderer.invoke('fs:writeBase64', relativePath, base64),
  copyFile: (sourceAbs, destRel) => ipcRenderer.invoke('fs:copyFile', sourceAbs, destRel),
  convertBackgroundVideo: (options) => ipcRenderer.invoke('video:convert-background', options),
  compressBackground: (options) => ipcRenderer.invoke('build:compress-background', options),
  // Build trigger
  triggerBuild: (options) => ipcRenderer.invoke('build:astro', options),

  // Generic invoke for composables that need custom IPC calls
  invoke: (channel, ...args) => {
    const allowed = [
      'fs:readYaml', 'fs:writeYaml', 'fs:readJson', 'fs:writeJson',
      'fs:readDir', 'fs:exists', 'fs:mkdir',
      'fs:readText', 'fs:writeText', 'fs:deleteDir', 'fs:deleteFile', 'fs:deletePlugin',
      'fs:getRepoRoot', 'fs:getDataDir', 'fs:writeBase64', 'fs:copyFile', 'fs:autoCopyBg',
      'build:astro', 'build:compress-background', 'video:convert-background',
    ]
    if (allowed.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args)
    }
    return Promise.reject(new Error(`IPC channel not allowed: ${channel}`))
  },
});
