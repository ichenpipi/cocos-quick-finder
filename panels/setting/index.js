const { ipcRenderer, shell } = require('electron');
const { getUrlParam } = require('../../utils/browser-utils');
const ConfigManager = require('../../config-manager');
const I18n = require('../../i18n/i18n');

/** 包名 */
const PACKAGE_NAME = 'ccc-quick-finder';

/** 语言 */
const LANG = getUrlParam('lang');

/**
 * i18n
 * @param {string} key
 * @returns {string}
 */
const translate = (key) => I18n.translate(LANG, key);

// 应用
const App = {

  /**
   * 数据
   */
  data() {
    return {
      // 多语言文本
      titleLabel: translate('setting'),
      selectLabel: translate('select'),
      selectTooltipLabel: translate('selectTooltip'),
      customLabel: translate('custom'),
      customPlaceholderLabel: translate('customPlaceholder'),
      customTooltipLabel: translate('customTooltip'),
      referenceLabel: translate('reference'),
      acceleratorLabel: translate('accelerator'),
      repositoryLabel: translate('repository'),
      applyLabel: translate('apply'),
      // 预设快捷键
      presets: [
        { key: 'custom', name: translate('custom') },
        { key: 'F1', name: 'F1' },
        { key: 'F3', name: 'F3' },
        { key: 'F4', name: 'F4' },
        { key: 'F5', name: 'F5' },
        { key: 'F6', name: 'F6' },
        { key: 'CmdOrCtrl+F', name: 'Cmd/Ctrl + F' },
        { key: 'CmdOrCtrl+B', name: 'Cmd/Ctrl + B' },
        { key: 'CmdOrCtrl+Shift+F', name: 'Cmd/Ctrl + Shift + F' },
      ],
      // 选择
      select: 'F1',
      // 自定义
      custom: '',
    };
  },

  /**
   * 监听器
   * @type {{ [key: string]: Function }}
   */
  watch: {

    /**
     * 选择快捷键
     */
    select(value) {
      if (value !== 'custom') {
        this.custom = '';
      }
    },

    /**
     * 自定义
     */
    custom(value) {
      if (value !== '' && this.select !== 'custom') {
        this.select = 'custom';
      }
    },

  },

  /**
   * 实例函数
   * @type {{ [key: string]: Function }}
   */
  methods: {

    /**
     * 应用按钮点击回调
     * @param {*} event 
     */
    onApplyBtnClick(event) {
      // 保存配置
      this.setConfig();
    },

    /**
     * 获取配置
     */
    getConfig() {
      const config = ConfigManager.get();
      if (!config) return;
      const presets = this.presets,
        hotkey = config.hotkey;
      // 预设按键
      for (let i = 0, l = presets.length; i < l; i++) {
        if (presets[i].key === hotkey) {
          this.select = hotkey;
          this.custom = '';
          return;
        }
      }
      // 自定义按键
      this.select = 'custom';
      this.custom = hotkey;
    },

    /**
     * 保存配置
     */
    setConfig() {
      const config = Object.create(null);
      if (this.select === 'custom') {
        const custom = this.custom;
        // 输入是否有效
        if (custom === '') {
          ipcRenderer.send(`${PACKAGE_NAME}:print`, {
            type: 'warn',
            content: translate('customError'),
          });
          return;
        }
        // 不可以使用双引号（避免 json 值中出现双引号而解析错误，导致插件加载失败）
        if (custom.includes('"')) {
          this.custom = this.custom.replace(/\"/g, '');
          ipcRenderer.send(`${PACKAGE_NAME}:print`, {
            type: 'warn',
            content: translate('quoteError'),
          });
          return;
        }
        config.hotkey = custom;
      } else {
        config.hotkey = this.select;
      }
      ConfigManager.set(config);
    },

  },

  /**
   * 生命周期：实例被挂载
   */
  mounted() {
    // 下一帧
    this.$nextTick(() => {

    });
    // 获取配置
    this.getConfig();
    // 覆盖 a 标签点击回调（使用默认浏览器打开网页）
    const links = document.querySelectorAll('a[href]');
    links.forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        const url = link.getAttribute('href');
        shell.openExternal(url);
      });
    });
  },

  /**
   * 生命周期：实例销毁前
   */
  beforeDestroy() {

  },

};

// 创建实例
const app = Vue.createApp(App);
// 挂载
app.mount('#app');
