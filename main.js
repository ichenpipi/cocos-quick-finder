const ConfigManager = require('./config-manager');
const FileUtil = require('./utils/file-utils');
const { BrowserWindow, ipcMain } = require('electron');
const Path = require('path');

/** i18n */
const translate = Editor.T;

/** 包名 */
const PACKAGE_NAME = 'ccc-quick-finder';

/** 扩展名 */
const EXTENSION_NAME = translate(`${PACKAGE_NAME}.name`);

module.exports = {

  /**
   * 搜索栏实例
   * @type {BrowserWindow}
   */
  searchBar: null,

  /**
   * 缓存
   * @type {{ name: string, path: string, extname: string }[]}
   */
  cache: null,

  /**
   * 扩展消息
   * @type {{ [key: string]: Function }}
   */
  messages: {

    /**
     * 打开搜索面板
     */
    'open-search-panel'() {
      this.showSearchBar();
    },

    /**
     * 打开设置面板
     */
    'open-setting-panel'() {
      Editor.Panel.open(`${PACKAGE_NAME}.setting`);
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
    ipcMain.on(`${PACKAGE_NAME}:get-lang`, this.onGetLangEvent.bind(this));
    ipcMain.on(`${PACKAGE_NAME}:match-keyword`, this.onMatchKeywordEvent.bind(this));
    ipcMain.on(`${PACKAGE_NAME}:open`, this.onOpenEvent.bind(this));
    ipcMain.on(`${PACKAGE_NAME}:focus`, this.onFocusEvent.bind(this));
  },

  /**
   * 生命周期：卸载
   */
  unload() {
    // 取消事件监听
    ipcMain.removeAllListeners(`${PACKAGE_NAME}:get-lang`);
    ipcMain.removeAllListeners(`${PACKAGE_NAME}:match-keyword`);
    ipcMain.removeAllListeners(`${PACKAGE_NAME}:open`);
    ipcMain.removeAllListeners(`${PACKAGE_NAME}:focus`);
  },

  /**
   * （渲染进程）获取语言事件回调
   * @param {*} event 
   */
  onGetLangEvent(event) {
    const lang = Editor.lang;
    event.reply(`${PACKAGE_NAME}:get-lang-reply`, lang);
  },

  /**
   * （渲染进程）关键词匹配事件回调
   * @param {*} event 
   * @param {string} keyword 
   */
  onMatchKeywordEvent(event, keyword) {
    // 匹配结果
    const results = this.getMatchFiles(keyword);
    // 返回结果给渲染进程
    event.reply(`${PACKAGE_NAME}:match-keyword-reply`, results);
  },

  /**
   * （渲染进程）打开文件事件回调
   * @param {*} event 
   * @param {string} path 路径
   */
  onOpenEvent(event, path) {
    this.openFile(path);
  },

  /**
   * （渲染进程）聚焦文件事件回调
   * @param {*} event 
   * @param {string} path 路径
   */
  onFocusEvent(event, path) {
    // 在资源管理器中显示并选中文件
    const uuid = Editor.assetdb.fspathToUuid(path);
    this.showFileInAssets(uuid);
  },

  /**
   * 展示搜索栏
   */
  showSearchBar() {
    // 已打开则关闭
    if (this.searchBar) {
      this.hideSearchBar();
      return;
    }
    // 创建窗口
    const win = this.searchBar = new BrowserWindow({
      width: 500,
      height: 600,
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
    // 加载页面
    win.loadURL(`file://${__dirname}/search/index.html`);
    // 调试用的 devtools（detach 模式需要将失焦自动隐藏关掉）
    // win.webContents.openDevTools({ mode: 'detach' });
    // 监听 ESC 按键（隐藏搜索栏）
    win.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'Escape') this.hideSearchBar();
    });
    // 展示后缓存数据
    win.on('show', () => (this.cache = this.getAllFiles()));
    // 失焦后自动隐藏
    win.on('blur', () => this.hideSearchBar());
    // 就绪后展示（避免闪烁）
    win.on('ready-to-show', () => win.show());
  },

  /**
   * 隐藏搜索栏
   */
  hideSearchBar() {
    if (!this.searchBar) return;
    this.searchBar.close();
    this.searchBar = null;
    // 清除缓存
    this.cache = null;
  },

  /**
   * 获取项目中所有文件
   * @returns {{ name: string, path: string, extname: string }[]}
   */
  getAllFiles() {
    const assetsPath = Editor.url('db://assets/'),
      results = [];
    const handler = (path, stat) => {
      // 过滤
      if (this.filter(path)) {
        const name = Path.basename(path),
          extname = Path.extname(path);
        results.push({ name, path, extname });
      }
    }
    // 遍历项目文件
    FileUtil.map(assetsPath, handler);
    // Done
    return results;
  },

  /**
   * 过滤文件
   * @param {string} path 路径
   * @returns {boolean}
   */
  filter(path) {
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
  },

  /**
   * 获取项目中匹配关键词的文件
   * @param {string} keyword 关键词
   * @returns {{ name: string, path: string, extname: string, similarity: number }[]}
   */
  getMatchFiles(keyword) {
    const results = [],
      cache = this.cache;
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
        if (regExp.test(name)) {
          const similarity = name.match(regExp)[0].length;
          results.push({ name, path, extname, similarity });
        }
      }
      // 排序（similarity 越小，匹配的长度越短，匹配度越高）
      results.sort((a, b) => a.similarity - b.similarity);
    } else {
      Editor.warn(`[${EXTENSION_NAME}]`, translate(`${PACKAGE_NAME}.dataError`));
    }
    // Done
    return results;
  },

  /**
   * 打开文件
   * @param {string} path 路径
   */
  openFile(path) {
    const extname = Path.extname(path),
      uuid = Editor.assetdb.fspathToUuid(path);
    // 文件格式
    switch (extname) {
      case '.fire':
        // 打开场景
        this.openScene(uuid);
        break;
      case '.prefab':
        // 打开预制体
        this.openPrefab(uuid);
        break;
      default:
        // 在资源管理器中显示并选中文件
        this.showFileInAssets(uuid);
        break;
    }
    // 隐藏搜索栏
    this.hideSearchBar();
  },

  /**
   * 打开场景
   * @param {string} uuid uuid
   */
  openScene(uuid) {
    Editor.Panel.open('scene', { uuid });
  },

  /**
   * 打开预制体
   * @param {string} uuid uuid
   */
  openPrefab(uuid) {
    Editor.Ipc.sendToAll('scene:enter-prefab-edit-mode', uuid);
  },

  /**
   * 在资源管理器中显示并选中文件
   * @param {string} uuid uuid
   */
  showFileInAssets(uuid) {
    Editor.Ipc.sendToAll('assets:hint', uuid);
    Editor.Selection.select('asset', uuid);
  },

}
