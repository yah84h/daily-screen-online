// Exposes the disk media cache to the configured TV site only.
const { contextBridge, ipcRenderer } = require('electron');
const arg = (name) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) || '';
const origin = arg('ezaati-origin');

if (location.protocol === 'file:') {
  contextBridge.exposeInMainWorld('playerSettings', {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (next) => ipcRenderer.invoke('settings:save', next),
    retry: () => ipcRenderer.invoke('screen:retry'),
  });
} else if (location.origin === origin) {
  const listeners = new Map();
  ipcRenderer.on('media:progress', (_e, { id, loaded, total }) => listeners.get(id)?.(loaded, total));
  let next = 0;
  contextBridge.exposeInMainWorld('ezaatiDesktop', {
    version: arg('ezaati-version'),
    async prepareMedia(url, options = {}) {
      const id = ++next;
      if (typeof options.onProgress === 'function') listeners.set(id, options.onProgress);
      try {
        return await ipcRenderer.invoke('media:prepare', {
          url: String(url),
          base: location.href,
          kind: options.kind,
          id,
        });
      } finally {
        listeners.delete(id);
      }
    },
    forgetMedia: (url, options = {}) => ipcRenderer.invoke('media:forget', { url: String(url), base: location.href, explicit: options.explicit === true }),
    clearMediaCache: () => ipcRenderer.invoke('media:clear'),
  });
}
