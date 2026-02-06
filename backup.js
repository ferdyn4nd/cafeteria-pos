// ===============================
// BACKUP AUTOMATICO SQLITE
// ===============================

const fs = require('fs');
const path = require('path');

// Rutas
const DB_FILE = path.join(__dirname, 'db.sqlite');
const BACKUP_DIR = 'C:/PROYECTOS/backups-pos';

// Fecha bonita
function getDate() {
  const d = new Date();

  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  const h = String(d.getHours()).padStart(2,'0');
  const min = String(d.getMinutes()).padStart(2,'0');

  return `${y}-${m}-${day}_${h}-${min}`;
}

// Crear carpeta si no existe
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Nombre backup
const backupName = `backup_${getDate()}.sqlite`;

const backupPath = path.join(BACKUP_DIR, backupName);

// Copiar
fs.copyFileSync(DB_FILE, backupPath);

console.log('✅ Backup creado:', backupPath);
