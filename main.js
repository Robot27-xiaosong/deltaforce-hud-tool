const { app, BrowserWindow, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow = null;
let sess = null; // 当前导出会话

const FPS = 30;
const W = 1920;
const H = 1080;

function getFfmpegPath() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'ffmpeg.exe');
  try { return require('ffmpeg-static'); } catch (e) { return null; }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920, height: 1140, minWidth: 1280, minHeight: 720,
    title: '三角洲全面战场自定义局内提示工具',
    backgroundColor: '#05070a', autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true, nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  mainWindow.loadFile('card.html');
  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url); return { action: 'deny' };
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

/* ══════════════ 导出: 隐藏抓取窗口 + ffmpeg 管道 ══════════════ */
/* 关键点: 屏幕只有 1536x960 逻辑像素, 1920x1080 的舞台塞不进可见窗口,
   直接对主窗口 capturePage 只能得到 1903x1154 且被裁切 => 视频错位。
   这里改用独立的隐藏窗口, 内容区开到 1920x1080 逻辑像素,
   舞台按 1/devicePixelRatio 缩放后抓取, 精确还原 1920x1080。 */

function buildArgs(fmt, filePath, needScale) {
  const head = ['-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-i', 'pipe:0', '-an'];
  const vf = needScale ? ['-vf', `scale=${W}:${H}:flags=lanczos`] : [];
  if (fmt === 'webm') {
    // 带 alpha 的透明视频（ffprobe 看不到 vp9 的 alpha 平面，但浏览器/剪辑软件能正常识别）
    return [...head, ...vf,
      '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0',
      '-crf', '18', '-b:v', '0', '-row-mt', '1',
      '-r', String(FPS), '-fps_mode', 'cfr', filePath];
  }
  return [...head, ...vf,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-r', String(FPS), '-fps_mode', 'cfr',
    '-movflags', '+faststart', filePath];
}

function spawnEncoder(sessRef, needScale) {
  const p = spawn(getFfmpegPath(), buildArgs(sessRef.fmt, sessRef.filePath, needScale),
    { windowsHide: true });
  sessRef.proc = p;
  p.stderr.on('data', d => {
    sessRef.stderr = (sessRef.stderr + d.toString()).slice(-20000);
  });
  p.on('error', e => { sessRef.procErr = e ? e.message : 'ffmpeg 启动失败'; });
  p.stdin.on('error', e => { sessRef.procErr = e ? e.message : 'ffmpeg 管道写入失败'; });
  return p;
}

function pushFrame(buf) {
  return new Promise((resolve, reject) => {
    const s = sess;
    if (!s || !s.proc) return reject(new Error('编码器未启动'));
    if (s.procErr) return reject(new Error(s.procErr));
    const st = s.proc.stdin;
    let settled = false;
    function onDrain() { cleanup(); resolve(); }
    function onErr(e) { cleanup(); reject(e || new Error('ffmpeg 管道写入失败')); }
    function cleanup() {
      if (settled) return; settled = true;
      st.removeListener('drain', onDrain);
      st.removeListener('error', onErr);
    }
    st.once('drain', onDrain);
    st.once('error', onErr);
    if (st.write(buf)) onDrain();
  });
}

function destroySession(s) {
  try { if (s.proc && !s.proc.killed) s.proc.kill(); } catch (e) { /* noop */ }
  try { if (s.cap && !s.cap.isDestroyed()) s.cap.destroy(); } catch (e) { /* noop */ }
}

ipcMain.handle('export-open', async (event, cfg) => {
  if (sess) return { error: '已有一个导出进行中' };
  const fmt = cfg.format === 'webm' ? 'webm' : 'mp4';
  const owner = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(owner, {
    title: '导出视频',
    defaultPath: cfg.defaultName || 'DF提示.mp4',
    filters: fmt === 'webm'
      ? [{ name: 'WebM 视频（带透明通道）', extensions: ['webm'] }]
      : [{ name: 'MP4 视频', extensions: ['mp4'] }],
  });
  if (canceled || !filePath) return { canceled: true };

  const ffmpeg = getFfmpegPath();
  if (!ffmpeg || !fs.existsSync(ffmpeg)) {
    return { error: '找不到 ffmpeg.exe，请重新安装本工具' };
  }

  // 1) 建一个隐藏窗口, 先用小尺寸探测实际抓取缩放系数
  const cap = new BrowserWindow({
    show: false, width: 420, height: 320,
    backgroundColor: '#00000000',
    transparent: cfg.bg === 'transparent',
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  });
  try {
    await cap.loadURL('data:text/html;charset=utf-8,<body style="margin:0"></body>');
    const probe = await cap.webContents.capturePage({ x: 0, y: 0, width: 200, height: 200 });
    const ps = probe.getSize();
    if (!ps || !ps.width) throw new Error('无法测量显示器缩放系数');
    const scale = ps.width / 200;
    if (!(scale > 0.1 && scale < 10)) throw new Error('显示器缩放系数异常: ' + scale);

    // 2) 内容区开到足够装下 1920x1080 舞台（缩放到 1/scale 后）
    cap.setContentSize(Math.ceil(W / scale) + 8, Math.ceil(H / scale) + 40);
    const cb = cap.getContentBounds();
    let s = 1 / scale;
    s = Math.min(s, cb.width / W, cb.height / H); // 窗口仍不够大时再缩一点, 交给 ffmpeg 放大回 1920x1080

    const rect = {
      x: 0, y: 0,
      width: Math.round(W * s),
      height: Math.round(H * s),
    };
    const needScale = Math.round(rect.width * scale) !== W || Math.round(rect.height * scale) !== H;

    // 3) 载入真正的卡片页面并等字体就绪
    await cap.loadFile(path.join(__dirname, 'card.html'));
    await cap.webContents.executeJavaScript('document.fonts.ready.then(function(){return 1;})');

    sess = {
      cap, fmt, filePath, rect, needScale,
      proc: null, stderr: '', procErr: null, frames: 0, scale,
    };
    return { canceled: false, filePath, width: W, height: H };
  } catch (e) {
    try { cap.destroy(); } catch (e2) { /* noop */ }
    return { error: '初始化导出失败: ' + (e && e.message ? e.message : e) };
  }
});

ipcMain.handle('export-setup', async (event, { bg }) => {
  if (!sess) return { error: '没有进行中的导出' };
  const s = sess.rect.width / W;
  const transparent = bg === 'transparent';
  const bgCss = transparent ? 'transparent' : (bg === 'chroma' ? '#0400f4' : '#000000');
  await sess.cap.webContents.executeJavaScript(`(function(){
    var im = 'important';
    document.querySelectorAll('canvas').forEach(function(c){ c.style.setProperty('display','none',im); });
    ['sidebar','stageBar'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.style.setProperty('display','none',im);
    });
    if (${transparent ? 'true' : 'false'}) {
      document.documentElement.style.setProperty('background','transparent',im);
      document.body.style.setProperty('background','transparent',im);
      ['app','stageArea','wrap'].forEach(function(id){
        var el = document.getElementById(id);
        if (el) el.style.setProperty('background','transparent',im);
      });
    }
    var st = document.getElementById('stage');
    st.className = '';
    st.style.cssText =
      'position:fixed!important;left:0!important;top:0!important;margin:0!important;' +
      'transform-origin:0 0!important;transform:scale(${s})!important;' +
      'z-index:2147483647!important;width:${W}px!important;height:${H}px!important;' +
      'overflow:hidden!important;background:${bgCss}!important;';
    return true;
  })()`);
  return { ok: true };
});

ipcMain.handle('export-prepare', async (event, rec) => {
  if (!sess) return { error: '没有进行中的导出' };
  const json = JSON.stringify(rec || {});
  await sess.cap.webContents.executeJavaScript(`(function(){
    if (typeof resetAll === 'function') resetAll();
    var rec = ${json};
    window.__rec = rec;
    if (rec.type === 'icon') {
      elT.textContent = rec.t; elTW.textContent = rec.t;
      elS.textContent = rec.s || '';
      elI.src = 'assets/' + rec.icon + '.png';
    } else {
      elT2.textContent = rec.t; elT2W.textContent = rec.t;
      elS2.textContent = rec.s || '';
      if (typeof fitToastWidth === 'function') fitToastWidth(rec);
    }
    return true;
  })()`);
  // 等图标解码完成，避免前几帧空白
  await sess.cap.webContents.executeJavaScript(`(function(){
    var rec = window.__rec || {};
    if (rec.type !== 'icon') return Promise.resolve(true);
    if (elI.complete && elI.naturalWidth) return Promise.resolve(true);
    return new Promise(function(res){
      elI.onload = res; elI.onerror = res; setTimeout(res, 3000);
    });
  })()`);
  return { ok: true };
});

ipcMain.handle('export-frame', async (event, { t, enterDur, hold, kind }) => {
  if (!sess) return { error: '没有进行中的导出' };
  const js = `(function(){
    var rec = window.__rec;
    var t = ${t}, enterDur = ${enterDur}, hold = ${hold};
    if (rec.type === 'icon') {
      if (t <= enterDur) renderEnter(t);
      else if (t <= enterDur + hold) renderEnter(enterDur);
      else { renderEnter(enterDur); renderExit(t - enterDur - hold); }
    } else {
      if (t <= enterDur) renderEnter2(rec, t);
      else if (t <= enterDur + hold) renderEnter2(rec, enterDur);
      else { renderEnter2(rec, enterDur); renderExit2(t - enterDur - hold); }
    }
    return true;
  })()`;
  await sess.cap.webContents.executeJavaScript(js);
  // 渲染后等两帧确保已经绘制到合成器，再抓取
  await sess.cap.webContents.executeJavaScript(
    'new Promise(function(r){ requestAnimationFrame(function(){ requestAnimationFrame(r); }); })');

  const img = await sess.cap.webContents.capturePage(sess.rect);
  const buf = img.toPNG();
  if (!buf || !buf.length) return { error: '抓取到第 ' + (sess.frames + 1) + ' 帧时返回空图像' };

  if (!sess.proc) {
    const sz = img.getSize();
    const need = !sz || sz.width !== W || sz.height !== H;
    spawnEncoder(sess, need);
    sess.needScale = need;
  }
  await pushFrame(buf);
  sess.frames++;
  return { ok: true, frame: sess.frames };
});

ipcMain.handle('export-close', async () => {
  const s = sess;
  if (!s) return { error: '没有进行中的导出' };
  sess = null;
  if (!s.proc) { destroySession(s); return { error: '没有写入任何帧' }; }

  return new Promise(resolve => {
    const timeout = Math.max(120000, s.frames * 1500);
    const timer = setTimeout(() => {
      try { s.proc.kill(); } catch (e) { /* noop */ }
      finish({ error: 'ffmpeg 编码超时\n' + (s.stderr || '').split('\n').slice(-6).join('\n') });
    }, timeout);
    let done = false;
    function finish(result) {
      if (done) return; done = true;
      clearTimeout(timer);
      destroySession(s);
      if (result.error) { try { fs.unlinkSync(s.filePath); } catch (e) { /* noop */ } }
      resolve(result);
    }
    s.proc.on('close', code => {
      clearTimeout(timer);
      if (code === 0) {
        let size = 0;
        try { size = fs.statSync(s.filePath).size; } catch (e) { /* noop */ }
        finish({ filePath: s.filePath, size, frames: s.frames });
      } else {
        finish({
          error: 'ffmpeg 退出码 ' + code +
            '\n' + (s.procErr || '') + '\n' +
            (s.stderr || '').split('\n').slice(-8).join('\n'),
        });
      }
    });
    try { s.proc.stdin.end(); } catch (e) { /* noop */ }
  });
});

ipcMain.handle('export-abort', async () => {
  const s = sess;
  if (!s) return { ok: true };
  sess = null;
  destroySession(s);
  try { fs.unlinkSync(s.filePath); } catch (e) { /* noop */ }
  return { ok: true };
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
