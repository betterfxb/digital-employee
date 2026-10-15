/**
 * S30 Electron桌面壳（Windows）：
 * 启动序：选空闲端口 → 起Next standalone服务（仅127.0.0.1监听）→ 等端口就绪 → 开窗加载
 * 授权闸在web侧激活门（/api/license/status + /api/license/import），本壳不重复验签（单一实现防漂移）
 * 数据目录 %APPDATA%/获客中台/data（Program Files非管理员不可写）；验签公钥随包分发，私钥永不随包
 */
const { app, BrowserWindow, shell, session } = require('electron');
// 注意：Electron内置模块net会阴影Node的net（node:前缀也逃不掉），端口选取/探活一律走http模块
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

/** extraResources原样拷贝到resources目录（不过滤node_modules、不进asar），路径直取process.resourcesPath */
function resP(name) { return app.isPackaged ? path.join(process.resourcesPath, name) : path.join(__dirname, 'resources', name); }
const STANDALONE_DIR = resP('standalone');
const PUB_SRC = resP('license_pub.pem');
const ICON_SRC = resP('icon.ico');

let serverProc = null;
let mainWindow = null;
let quitting = false;

function pickPort() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => { const p = srv.address().port; srv.close(() => resolve(p)); });
  });
}

function waitPort(port, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 2000 }, (res) => { res.resume(); resolve(); });
      req.on('error', () => { if (Date.now() - start > timeoutMs) reject(new Error('本地服务启动超时')); else setTimeout(tryOnce, 400); });
      req.on('timeout', () => { req.destroy(); if (Date.now() - start > timeoutMs) reject(new Error('本地服务启动超时')); else setTimeout(tryOnce, 400); });
    };
    tryOnce();
  });
}

function startServer(port) {
  const dataDir = path.join(app.getPath('userData'), 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const pubDst = path.join(dataDir, 'license_pub.pem');
  if (!fs.existsSync(pubDst) && fs.existsSync(PUB_SRC)) fs.copyFileSync(PUB_SRC, pubDst);
  // token加密主密钥：首启随机生成落数据目录（单机密钥，仅本机数据解密用）
  const keyFile = path.join(dataDir, '.master_key');
  let masterKey;
  if (fs.existsSync(keyFile)) masterKey = fs.readFileSync(keyFile, 'utf8').trim();
  if (!masterKey) { masterKey = randomBytes(32).toString('hex'); fs.writeFileSync(keyFile, masterKey, { mode: 0o600 }); }
  const env = {
    ...process.env,
    DATA_DIR: dataDir,
    PORT: String(port),
    HOSTNAME: '127.0.0.1',
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    TOKEN_MASTER_KEY: masterKey,
    // 打包态execPath是electron.exe，必须以Node模式跑standalone服务（否则被当成新应用启动）
    ELECTRON_RUN_AS_NODE: '1',
  };
  serverProc = spawn(process.execPath, [path.join(STANDALONE_DIR, 'server.js')], {
    cwd: STANDALONE_DIR,
    env,
    windowsHide: true,
    stdio: process.env.DESKTOP_DEBUG ? 'inherit' : 'ignore',
  });
  // 服务意外退出 → 整个应用退出（避免留下无服务的空壳窗口）
  serverProc.on('exit', (code) => { if (!quitting) { quitting = true; app.exit(code || 0); } });
  serverProc.on('error', (e) => { console.error('[desktop] 服务进程启动失败', e); });
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1360, height: 860, minWidth: 1100, minHeight: 700,
    title: '获客中台',
    icon: fs.existsSync(ICON_SRC) ? ICON_SRC : undefined,
    autoHideMenuBar: true,
    backgroundColor: '#F7F6F3',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  mainWindow.loadURL(`http://127.0.0.1:${port}/`);
  // 外链走系统浏览器；站内导航限制在本机服务
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(`http://127.0.0.1:${port}`)) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  // 桌面壳不需要任何浏览器权限（通知/摄像头/定位等全部拒绝）
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  try {
    const port = await pickPort();
    startServer(port);
    await waitPort(port);
    createWindow(port);
  } catch (e) {
    console.error('[desktop] 启动失败', e);
    app.exit(1);
  }
});

app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
app.on('window-all-closed', () => { console.log('[desktop] window-all-closed'); quitting = true; if (serverProc) serverProc.kill(); app.quit(); });
app.on('before-quit', () => { console.log('[desktop] before-quit'); quitting = true; if (serverProc) serverProc.kill(); });
