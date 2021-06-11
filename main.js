const { BrowserWindow, ipcMain } = require('electron');
const Fs = require('fs');
const Path = require('path');
const ConfigManager = require('./config-manager');

/** 包名 */
const PACKAGE_NAME = 'ccc-quick-finder';

/**
 * i18n
 * @param {string} key
 * @returns {string}
 */
const translate = (key) => Editor.T(`${PACKAGE_NAME}.${key}`);

/** 扩展名 */
const EXTENSION_NAME = translate('name');

module.exports = {

  /**
   * 扩展消息
   * @type {{ [key: string]: Function }}
   */
  messages: {

    /**
     * 打开搜索面板
     */
    'open-search-panel'() {
      openSearchBar();
    },

    /**
     * 打开设置面板
     */
    'open-setting-panel'() {
      openSettingPanel();
    },

    /**
     * 读取配置
     * @param {any} event 
     */
    'read-config'(event) {
      const config = ConfigManager.read();
      event.reply(null, config);
    },

    /**
     * 保存配置
     * @param {any} event 
     * @param {any} config 
     */
    'save-config'(event, config) {
      ConfigManager.save(config);
      event.reply(null, true);
    },

  },

  /**
   * 生命周期：加载
   */
  load() {
    // 监听事件
    ipcMain.on(`${PACKAGE_NAME}:match-keyword`, onMatchKeywordEvent);
    ipcMain.on(`${PACKAGE_NAME}:open`, onOpenEvent);
    ipcMain.on(`${PACKAGE_NAME}:focus`, onFocusEvent);
  },

  /**
   * 生命周期：卸载
   */
  unload() {
    // 取消事件监听
    ipcMain.removeAllListeners(`${PACKAGE_NAME}:match-keyword`);
    ipcMain.removeAllListeners(`${PACKAGE_NAME}:open`);
    ipcMain.removeAllListeners(`${PACKAGE_NAME}:focus`);
  },

}

/**
 * （渲染进程）关键词匹配事件回调
 * @param {*} event 
 * @param {string} keyword 
 */
function onMatchKeywordEvent(event, keyword) {
  // 匹配结果
  const results = getMatchFiles(keyword);
  // 返回结果给渲染进程
  event.reply(`${PACKAGE_NAME}:match-keyword-reply`, results);
}

/**
 * （渲染进程）打开文件事件回调
 * @param {*} event 
 * @param {string} path 路径
 */
function onOpenEvent(event, path) {
  openFile(path);
}

/**
 * （渲染进程）聚焦文件事件回调
 * @param {*} event 
 * @param {string} path 路径
 */
function onFocusEvent(event, path) {
  // 在资源管理器中显示并选中文件
  const uuid = Editor.assetdb.fspathToUuid(path);
  focusOnFile(uuid);
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
    winPos = getPosition(winSize),
    win = searchBar = new BrowserWindow({
      width: winSize[0],
      height: winSize[1],
      x: winPos[0],
      y: winPos[1],
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
        nodeIntegration: true
      },
    });
  // 加载页面（并传递当前语言）
  const lang = Editor.lang;
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
  // win.on('closed', () => (searchBar = null));
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
  // 先隐藏再关闭
  // 在 2.4.5 版本中，扩展如果安装在局部，关闭搜索栏会引发编辑器闪退
  // 原因未知，修改为先隐藏再关闭就没问题了（离谱）
  searchBar.hide();
  // 关闭
  searchBar.close();
  // 移除引用
  searchBar = null;
}

/**
 * 打开设置面板
 */
function openSettingPanel() {
  Editor.Panel.open(`${PACKAGE_NAME}.setting`);
}

/**
 * 获取窗口位置
 * @param {[number, number]} size 窗口尺寸
 * @returns {[number, number]}
 */
function getPosition(size) {
  // 根据编辑器窗口的位置和尺寸来计算
  const editorWin = BrowserWindow.getFocusedWindow(),
    editorSize = editorWin.getSize(),
    editorPos = editorWin.getPosition(),
    // 需要注意一个问题：窗口的位置值必须是整数，否则修改不会生效
    // 毕竟像素应该是显示器上的最低单位了，合理
    x = Math.floor(editorPos[0] + (editorSize[0] / 2) - (size[0] / 2)),
    y = Math.floor(editorPos[1] + 200);
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
  const assetsPath = Editor.url('db://assets/'),
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
  // if (extname !== '.fire' && extname !== '.prefab') {
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
    Editor.warn(`[${EXTENSION_NAME}]`, translate('dataError'));
  }
  // Done
  return results;
}

/**
 * 打开文件
 * @param {string} path 路径
 */
function openFile(path) {
  const extname = Path.extname(path),
    uuid = Editor.assetdb.fspathToUuid(path);
  // 文件格式
  switch (extname) {
    case '.fire':
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
  Editor.Panel.open('scene', { uuid });
}

/**
 * 打开预制体
 * @param {string} uuid uuid
 */
function openPrefab(uuid) {
  Editor.Ipc.sendToAll('scene:enter-prefab-edit-mode', uuid);
}

/**
 * 聚焦到文件（在资源管理器中显示并选中文件）
 * @param {string} uuid uuid
 */
function focusOnFile(uuid) {
  Editor.Ipc.sendToAll('assets:hint', uuid);
  Editor.Selection.select('asset', uuid);
}
