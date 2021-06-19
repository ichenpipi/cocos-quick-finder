const { BrowserWindow, ipcMain } = require('electron');
const Fs = require('fs');
const Path = require('path');
const ConfigManager = require('./config-manager');
const Updater = require('./updater');

/** 包名 */
const PACKAGE_NAME = require('../package.json').name;

/**
 * i18n
 * @param {string} key
 * @returns {string}
 */
const translate = (key) => Editor.I18n.t(`${PACKAGE_NAME}.${key}`);

/** 扩展名称 */
const EXTENSION_NAME = translate('name');

/**
 * 函数
 */
exports.methods = {

  /**
   * 打开搜索面板
   */
  openSearchPanel() {
    openSearchBar();
  },

  /**
   * 打开设置面板
   */
  openSettingPanel() {
    openSettingPanel();
  },

  /**
   * 检查更新
   */
  checkUpdate() {
    checkUpdate(true);
  },

};

/**
 * 生命周期：加载
 */
exports.load = function () {
  // 监听事件
  ipcMain.on(`${PACKAGE_NAME}:match-keyword`, onMatchKeywordEvent);
  ipcMain.on(`${PACKAGE_NAME}:open`, onOpenEvent);
  ipcMain.on(`${PACKAGE_NAME}:focus`, onFocusEvent);
  ipcMain.on(`${PACKAGE_NAME}:print`, onPrintEvent);
  // 自动检查更新
  const config = ConfigManager.get();
  if (config.autoCheckUpdate) {
    checkUpdate(false);
  }
}

/**
 * 生命周期：卸载
 */
exports.unload = function () {
  // 取消事件监听
  ipcMain.removeAllListeners(`${PACKAGE_NAME}:match-keyword`);
  ipcMain.removeAllListeners(`${PACKAGE_NAME}:open`);
  ipcMain.removeAllListeners(`${PACKAGE_NAME}:focus`);
  ipcMain.removeAllListeners(`${PACKAGE_NAME}:print`);
}

/**
 * （渲染进程）关键词匹配事件回调
 * @param {Electron.IpcMainEvent} event 
 * @param {string} keyword 关键词
 */
function onMatchKeywordEvent(event, keyword) {
  // 匹配结果
  const results = getMatchFiles(keyword);
  // 返回结果给渲染进程
  event.reply(`${PACKAGE_NAME}:match-keyword-reply`, results);
}

/**
 * （渲染进程）打开文件事件回调
 * @param {Electron.IpcMainEvent} event 
 * @param {string} path 路径
 */
function onOpenEvent(event, path) {
  openFile(path);
}

/**
 * （渲染进程）聚焦文件事件回调
 * @param {Electron.IpcMainEvent} event 
 * @param {string} path 路径
 */
async function onFocusEvent(event, path) {
  // 在资源管理器中显示并选中文件
  const uuid = await Editor.Message.request('asset-db', 'query-uuid', path);
  focusOnFile(uuid);
}

/**
 * （渲染进程）打印事件回调
 * @param {Electron.IpcMainEvent} event 
 * @param {{ type: string, content: string }} options 选项
 */
function onPrintEvent(event, options) {
  const { type, content } = options,
    message = `[${EXTENSION_NAME}] ${content}`;
  switch (type) {
    default:
    case 'log': {
      console.log(message);
      break;
    }
    case 'warn': {
      console.warn(message);
      break;
    }
    case 'error': {
      console.error(message);
      break;
    }
    case 'success': {
      console.info(message);
      break;
    }
  }
}

/**
 * 搜索栏实例
 * @type {BrowserWindow}
 */
let searchBar = null;

/**
 * 缓存
 * @type {{ name: string, path: string, extname: string }[]}
 */
let cache = null;

/**
 * 打开搜索栏
 */
function openSearchBar() {
  // 已打开则关闭
  if (searchBar) {
    closeSearchBar();
    return;
  }
  // 创建窗口
  const winSize = [500, 600],
    winPos = getPosition(winSize, 'top'),
    win = searchBar = new BrowserWindow({
      width: winSize[0],
      height: winSize[1],
      x: winPos[0],
      y: winPos[1] + 200,
      frame: false,
      resizable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      transparent: true,
      opacity: 0.95,
      backgroundColor: '#00000000',
      hasShadow: false,
      show: false,
      webPreferences: {
        nodeIntegration: true,
      },
    });
  // 加载页面（并传递当前语言）
  const lang = Editor.I18n.getLanguage();
  win.loadURL(`file://${__dirname}/panels/search/index.html?lang=${lang}`);
  // 监听按键（ESC 关闭）
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape') {
      closeSearchBar();
    }
  });
  // 就绪后展示（避免闪烁）
  win.on('ready-to-show', () => win.show());
  // 展示后（缓存数据）
  win.on('show', () => (cache = getAllFiles()));
  // 失焦后（自动关闭）
  win.on('blur', () => closeSearchBar());
  // 关闭后（移除引用）
  win.on('closed', () => (searchBar = null));
  // 调试用的 devtools（detach 模式需要取消失焦自动关闭）
  // win.webContents.openDevTools({ mode: 'detach' });
}

/**
 * 关闭搜索栏
 */
function closeSearchBar() {
  if (!searchBar) {
    return;
  }
  // 移除缓存
  cache = null;
  // 隐藏
  searchBar.hide();
  // 关闭
  searchBar.close();
  // 移除引用
  searchBar = null;
}

/**
 * 设置面板实例
 * @type {BrowserWindow}
 */
let settingPanel = null;

/**
 * 打开设置面板
 */
function openSettingPanel() {
  // 已打开则关闭
  if (settingPanel) {
    closeSettingPanel();
    return;
  }
  // 创建窗口
  const winSize = [500, 355],
    winPos = getPosition(winSize, 'center'),
    win = settingPanel = new BrowserWindow({
      width: winSize[0],
      height: winSize[1],
      minWidth: winSize[0],
      minHeight: winSize[1],
      x: winPos[0],
      y: winPos[1] - 100,
      frame: true,
      title: `${EXTENSION_NAME} | Cocos Creator`,
      autoHideMenuBar: true,
      resizable: true,
      minimizable: false,
      maximizable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      show: false,
      webPreferences: {
        nodeIntegration: true,
      },
    });
  // 加载页面（并传递当前语言）
  const lang = Editor.I18n.getLanguage();
  win.loadURL(`file://${__dirname}/panels/setting/index.html?lang=${lang}`);
  // 监听按键（ESC 关闭）
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape') {
      closeSettingPanel();
    }
  });
  // 就绪后展示（避免闪烁）
  win.on('ready-to-show', () => win.show());
  // 失焦后（自动关闭）
  win.on('blur', () => closeSettingPanel());
  // 关闭后（移除引用）
  win.on('closed', () => (settingPanel = null));
  // 调试用的 devtools（detach 模式需要取消失焦自动关闭）
  // win.webContents.openDevTools({ mode: 'detach' });
}

/**
 * 关闭搜索栏
 */
function closeSettingPanel() {
  if (!settingPanel) {
    return;
  }
  // 先隐藏再关闭
  settingPanel.hide();
  // 关闭
  settingPanel.close();
  // 移除引用
  settingPanel = null;
}

/**
 * 获取窗口位置
 * @param {[number, number]} size 窗口尺寸
 * @param {'top' | 'center'} anchor 锚点
 * @returns {[number, number]}
 */
function getPosition(size, anchor) {
  // 根据编辑器窗口的位置和尺寸来计算
  const editorWin = BrowserWindow.getFocusedWindow(),
    editorSize = editorWin.getSize(),
    editorPos = editorWin.getPosition();
  // 注意：原点 (0, 0) 在屏幕左上角
  // 另外，窗口的位置值必须是整数，否则修改无效（像素的最小粒度为 1）
  const x = Math.floor(editorPos[0] + (editorSize[0] / 2) - (size[0] / 2));
  let y;
  switch (anchor || 'top') {
    case 'top': {
      y = Math.floor(editorPos[1]);
      break;
    }
    case 'center': {
      y = Math.floor(editorPos[1] + (editorSize[1] / 2) - (size[1] / 2));
      break;
    }
  }
  return [x, y];
}

/**
 * 遍历文件/文件夹并执行函数
 * @param {Fs.PathLike} path 路径
 * @param {(filePath: Fs.PathLike, stat: Fs.Stats) => void} handler 处理函数
 */
function map(path, handler) {
  if (!Fs.existsSync(path)) {
    return
  }
  const stats = Fs.statSync(path);
  if (stats.isFile()) {
    handler(path, stats);
  } else {
    const names = Fs.readdirSync(path);
    for (const name of names) {
      map(Path.join(path, name), handler);
    }
  }
}

/**
 * 获取项目中所有文件
 * @returns {{ name: string, path: string, extname: string }[]}
 */
function getAllFiles() {
  const assetsPath = Path.join(Editor.Project.path, 'assets/'),
    results = [];
  const handler = (path, stat) => {
    // 过滤
    if (filter(path)) {
      const name = Path.basename(path),
        extname = Path.extname(path);
      results.push({ name, path, extname });
    }
  }
  // 遍历项目文件
  map(assetsPath, handler);
  // Done
  return results;
}

/**
 * 过滤文件
 * @param {string} path 路径
 * @returns {boolean}
 */
function filter(path) {
  // 扩展名
  const extname = Path.extname(path);
  // 排除 meta 文件和没有扩展名的文件
  if (extname === '.meta' || extname === '') {
    return false;
  }
  // 只要场景和预制体
  // if (extname !== '.scene' && extname !== '.prefab') {
  //   return false;
  // }
  // 可用
  return true;
}

/**
 * 获取项目中匹配关键词的文件
 * @param {string} keyword 关键词
 * @returns {{ name: string, path: string, extname: string, similarity: number }[]}
 */
function getMatchFiles(keyword) {
  const results = [];
  // 正则（每个关键字之间可以有任意个字符(.*)；不区分大小写(i)；懒惰模式(?)，匹配尽肯少的字符）
  const pattern = keyword.split('').join('.*?'),
    regExp = new RegExp(pattern, 'i');
  // 下面这行正则插入很炫酷，但是性能不好，耗时接近 split + join 的 10 倍
  // const pattern = keyword.replace(/(?<=.)(.)/g, '.*$1');
  // 查找并匹配
  if (cache && cache.length > 0) {
    // 从缓存中查找
    for (let i = 0, l = cache.length; i < l; i++) {
      const { name, path, extname } = cache[i];
      // 匹配
      const match = name.match(regExp);
      if (match) {
        // 相似度
        const similarity = match[0].length;
        results.push({ name, path, extname, similarity });
      }
    }
    // 排序（similarity 越小，匹配的长度越短，匹配度越高）
    results.sort((a, b) => a.similarity - b.similarity);
  } else {
    console.warn(`[${EXTENSION_NAME}]`, translate('dataError'));
  }
  // Done
  return results;
}

/**
 * 打开文件
 * @param {string} path 路径
 */
async function openFile(path) {
  const extname = Path.extname(path),
    uuid = await Editor.Message.request('asset-db', 'query-uuid', path);
  // 文件格式
  switch (extname) {
    case '.scene':
      // 打开场景
      openScene(uuid);
      break;
    case '.prefab':
      // 打开预制体
      openPrefab(uuid);
      break;
    default:
      // 聚焦到文件
      focusOnFile(uuid);
      break;
  }
  // 隐藏搜索栏
  closeSearchBar();
}

/**
 * 打开场景
 * @param {string} uuid uuid
 */
function openScene(uuid) {
  Editor.Message.send('scene', 'open-scene', uuid);
}

/**
 * 打开预制体
 * @param {string} uuid uuid
 */
function openPrefab(uuid) {
  Editor.Message.send('scene', 'open-scene', uuid);
}

/**
 * 在资源管理器中显示并选中文件
 * @param {string} uuid uuid
 */
function focusOnFile(uuid) {
  const Selection = Editor.Selection;
  Selection.clear('asset');
  Selection.select('asset', uuid);
}

/**
 * 检查更新
 * @param {boolean} logWhatever 无论有无更新都打印提示
 */
async function checkUpdate(logWhatever) {
  const hasNewVersion = await Updater.check();
  // 打印到控制台
  if (hasNewVersion) {
    console.info(`[${EXTENSION_NAME}]`, translate('hasNewVersion'));
  } else if (logWhatever) {
    console.log(`[${EXTENSION_NAME}]`, translate('currentLatest'));
  }
}
