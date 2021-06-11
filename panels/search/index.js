const { ipcRenderer } = require('electron');
const BrowserUtils = require('../../utils/browser-utils.js');

/** 包名 */
const PACKAGE_NAME = 'ccc-quick-finder';

// 应用
const App = {

  /**
   * 数据
   */
  data() {
    return {
      /** 输入框占位符文本 */
      placeholder: '',
      /** 确认按钮文本 */
      button: '',
      /** 输入的关键字 */
      keyword: '',
      /** 关键词匹配返回的结果 */
      results: [],
      /** 当前选中的项目 */
      curItem: null,
      /** 当前选中的项目下标 */
      curIndex: -1,
      /** 分段加载定时器 */
      loadHandler: null,
    };
  },

  /**
   * 实例函数
   * @type {{ [key: string]: Function }}
   */
  methods: {

    /**
     * 输入框更新回调
     * @param {*} event 
     */
    onInputChange(event) {
      // 取消分帧加载
      if (this.loadHandler) {
        clearTimeout(this.loadHandler);
        this.loadHandler = null;
      }
      // 取消当前选中
      this.curItem = null;
      this.curIndex = -1;
      // 关键字为空或无效时不进行搜索
      const keyword = this.keyword;
      if (keyword === '' || keyword.includes('...')) {
        this.results.length = 0;
        return;
      }
      // 发消息给主进程进行关键词匹配
      ipcRenderer.send(`${PACKAGE_NAME}:match-keyword`, keyword);
    },

    /**
     * 确认按钮点击回调
     * @param {*} event 
     */
    onEnterBtnClick(event) {
      const item = this.curItem;
      if (!item) {
        if (this.keyword !== '') {
          // 输入框文本错误动画
          const input = this.$refs.input;
          input.classList.add('input-error');
          setTimeout(() => input.classList.remove('input-error'), 500);
        }
      } else {
        this.keyword = item.name;
        // 发消息给主进程
        ipcRenderer.send(`${PACKAGE_NAME}:open`, item.path);
      }
      // 聚焦到输入框（此时焦点在按钮或列表上）
      this.focusOnInputField();
    },

    /**
     * 上箭头按键回调
     * @param {*} event 
     */
    onUpBtnClick(event) {
      // 阻止默认事件（光标移动）
      event.preventDefault();
      // 循环选择
      if (this.curIndex > 0) {
        this.curIndex--;
      } else {
        this.curIndex = this.results.length - 1;
      }
      // 更新选择
      this.updateSelected();
    },

    /**
     * 下箭头按键回调
     * @param {*} event 
     */
    onDownBtnClick(event) {
      // 阻止默认事件（光标移动）
      event.preventDefault();
      // 循环选择
      if (this.curIndex >= this.results.length - 1) {
        this.curIndex = 0;
      } else {
        this.curIndex++;
      }
      // 更新选择
      this.updateSelected();
    },

    /**
     * 更新当前的选择
     */
    updateSelected() {
      this.curItem = this.results[this.curIndex];
      this.keyword = this.curItem.name;
      // 只有当目标元素不在可视区域内才滚动
      const id = `item-${this.curIndex}`;
      document.getElementById(id).scrollIntoViewIfNeeded(false);
    },

    /**
     * 左箭头按键回调
     * @param {*} event 
     */
    onLeftBtnClick(event) {
      // 是否已选中项目
      if (!this.curItem) return;
      // 阻止默认事件（光标移动）
      event.preventDefault();
      // 在资源管理器中显示并选中文件
      this.showFileInAssets();
    },

    /**
     * 右箭头按键回调
     * @param {*} event 
     */
    onRightBtnClick(event) {
      // 是否已选中项目
      if (!this.curItem) return;
      // 阻止默认事件（光标移动）
      event.preventDefault();
      // 在资源管理器中显示并选中文件
      this.showFileInAssets();
    },

    /**
     * 在资源管理器中显示并选中文件
     */
    showFileInAssets() {
      // 当前选中文件路径
      const path = this.curItem.path;
      // 发消息给主进程
      ipcRenderer.send(`${PACKAGE_NAME}:focus`, path);
    },

    /**
     * 结果点击回调
     * @param {{ name: string, path: string, extname: string }} item 数据
     * @param {number} index 下标
     */
    onResultClick(item, index) {
      this.curIndex = parseInt(index);
      this.curItem = item;
      this.keyword = item.name;
      // 添加组件
      this.onEnterBtnClick(null);
      // 聚焦到输入框（此时焦点在列表上）
      // 换成在 onEnterBtnClick 里统一处理了
      // this.focusOnInputField();
    },

    /**
     * 聚焦到输入框
     */
    focusOnInputField() {
      this.$refs.input.focus();
    },

    /**
     * 更新语言
     */
    updateLang() {
      const lang = BrowserUtils.getUrlParam('lang'),
        texts = lang.includes('zh') ? zh : en;
      this.placeholder = texts.placeholder;
      this.button = texts.button;
    },

    /**
     * （主进程）匹配关键词回调
     * @param {*} event 
     * @param {{ name: string, path: string, extname: string }[]} results 结果
     */
    onMatchKeywordReply(event, results) {
      // 确保清除已有数据
      this.results.length = 0;
      // 当只有一个结果时直接选中
      if (results.length === 1) {
        this.results = results;
        this.curIndex = 0;
        this.curItem = results[0];
        return;
      }
      // 结果数量多时分段加载
      if (results.length >= 300) {
        // 每次加载的数量
        const threshold = 150;
        // 分段加载函数
        const load = () => {
          const length = results.length,
            count = length >= threshold ? threshold : length,
            part = results.splice(0, count);
          // 加载一部分
          this.results.push(...part);
          // 是否还有数据
          if (results.length > 0) {
            // 下一波继续
            this.loadHandler = setTimeout(load);
          } else {
            // Done
            this.loadHandler = null;
          }
        }
        // 开始加载
        load();
        return;
      }
      // 数量不多，更新结果列表
      this.results = results;
    },

    /**
     * 获取图标
     * @param {string} extname 扩展名
     * @returns {string}
     */
    getIcon(extname) {
      const iconName = iconMap[extname] || 'asset';
      return `../../images/assets/${iconName}.png`;
    },

  },

  /**
   * 生命周期：实例被挂载
   */
  mounted() {
    // 监听事件
    ipcRenderer.on(`${PACKAGE_NAME}:match-keyword-reply`, this.onMatchKeywordReply.bind(this));
    // 下一帧
    this.$nextTick(() => {
      // 更新语言
      this.updateLang();
      // 聚焦到输入框
      this.focusOnInputField()
    });
  },

  /**
   * 生命周期：实例销毁前
   */
  beforeDestroy() {
    // 取消事件监听
    ipcRenderer.removeAllListeners(`${PACKAGE_NAME}:match-keyword-reply`);
  },

};

// 创建实例
const app = Vue.createApp(App);
// 挂载
app.mount('#app');

/** 多语言：中文 */
const zh = {
  placeholder: '请输入文件名称...',
  button: 'GO',
}

/** 多语言：英语 */
const en = {
  placeholder: 'Enter file name...',
  button: 'GO',
}

/** 文件扩展名对应图标表 */
const iconMap = {
  '.anim': 'animation-clip',
  '.prefab': 'prefab',
  '.fire': 'scene',
  '.scene': 'scene',
  '.effect': 'shader',
  '.mesh': 'mesh',
  '.FBX': 'mesh',
  '.mtl': 'material',
  '.pmtl': 'physics-material',
  '.pac': 'auto-atlas',
  '.ts': 'typescript',
  '.js': 'javascript',
  '.coffee': 'coffeescript',
  '.json': 'json',
  '.md': 'markdown',
  '.html': 'html',
  '.css': 'css',
  '.txt': 'text',
  '.ttf': 'ttf-font',
  '.fnt': 'bitmap-font',
  '.mp3': 'audio-clip',
  '.png': 'atlas',
  '.jpg': 'atlas',
  '.plist': 'sprite-atlas',
}
