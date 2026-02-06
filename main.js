const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let serverProcess;

function startServer() {

  const serverPath = path.join(__dirname, 'src', 'app.js');

  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: __dirname
  });

  serverProcess.stdout.on('data', data => {
    console.log('[SERVER]', data.toString());
  });

  serverProcess.stderr.on('data', data => {
    console.error('[SERVER ERROR]', data.toString());
  });
}

function createWindow() {

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true
  });

  setTimeout(() => {
win.loadURL('http://localhost:9090');
  }, 3000);
}

app.whenReady().then(() => {
  startServer();
  createWindow();
});

app.on('quit', () => {
  if (serverProcess) serverProcess.kill();
});
