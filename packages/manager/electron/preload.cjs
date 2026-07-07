/**
 * Chronicle Manager — Electron Preload Script
 *
 * Minimal bridge between renderer (Vue SPA) and Node.js backend.
 * Exposes safe APIs via contextBridge for future use (file system access,
 * native dialogs, etc.).
 */

const { contextBridge, ipcRenderer, webUtils } = require('electron');

// ── Auth token injection for child windows ──────────────────
// Electron BrowserWindows don't reliably share localStorage for
// file:// origins. The main process passes the auth token as a
// _auth query param; we extract it before Vue boots and clean
// the URL so no application code ever sees it.
(function injectAuthFromUrl() {
  try {
    const qs = new URLSearchParams(window.location.search);
    const token = qs.get('_auth');
    if (token) {
      localStorage.setItem('chronicle_auth', token);
      // Clean the URL — remove _auth from query without reload
      const url = new URL(window.location.href);
      url.searchParams.delete('_auth');
      window.history.replaceState(null, '', url.toString());
    }
  } catch (_) {}
})();

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
  openExternalLogin: (baseUrl) => ipcRenderer.invoke('open-external-login', baseUrl),
  onLoginCallback: (callback) => {
    ipcRenderer.on('login-callback', (_event, token) => callback(token));
  },

  // Print: write standalone HTML to a temp file and open in system browser
  openPrintInBrowser: (html, title) => ipcRenderer.invoke('open-print-in-browser', html, title),

  // Safe subset of process.env
  env: {
    VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || '',
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
  compressBackground: (options) => ipcRenderer.invoke('build:compress-background', options),
  // Build trigger
  triggerBuild: (options) => ipcRenderer.invoke('build:astro', options),

  // Generic invoke for composables that need custom IPC calls
  invoke: (channel, ...args) => {
    const allowed = [
      'fs:readYaml', 'fs:writeYaml', 'fs:readJson', 'fs:writeJson',
      'fs:readDir', 'fs:exists', 'fs:mkdir',
      'fs:readText', 'fs:writeText', 'fs:deleteDir', 'fs:deleteFile',
      'fs:getRepoRoot', 'fs:getDataDir', 'fs:writeBase64', 'fs:copyFile', 'fs:autoCopyBg',
      'build:astro', 'build:compress-background',
    ]
    if (allowed.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args)
    }
    return Promise.reject(new Error(`IPC channel not allowed: ${channel}`))
  },
});
