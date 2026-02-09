const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    // Modo desarrollo (tu compu)
    mainWindow.loadURL('http://localhost:5000');
  } else {
    // Modo producción (Render)
    mainWindow.loadURL('https://cafeteria-pos.onrender.com');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Cuando Electron esté listo
app.whenReady().then(createWindow);

// Para Windows / Mac
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
