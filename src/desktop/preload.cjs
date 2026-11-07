const { contextBridge, ipcRenderer } = require('electron');
const COMMANDS = new Set(['check-updates', 'update-settings', 'open-update', 'state', 'invalidate', 'connect', 'verify-account', 'show-browser', 'hide-browser', 'disconnect', 'scan', 'import-export', 'open-data-request', 'options', 'select', 'confirm', 'cancel-confirmation', 'run', 'pause', 'resume', 'stop', 'export-report', 'open-original', 'clear-checkpoint', 'demo']);
contextBridge.exposeInMainWorld('wipeditt', {
  command(name, data = {}) {
    if (!COMMANDS.has(name)) return Promise.reject(new Error('Unknown application command.'));
    return ipcRenderer.invoke('wipeditt:command', { name, data });
  },
  onState(callback) {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('wipeditt:state', listener);
    return () => ipcRenderer.removeListener('wipeditt:state', listener);
  }
});
