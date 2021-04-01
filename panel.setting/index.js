const { readFileSync } = require('fs');

/** i18n */
const translate = Editor.T;

/** 包名 */
const PACKAGE_NAME = 'ccc-quick-finder';

/** 扩展名 */
const EXTENSION_NAME = translate(`${PACKAGE_NAME}.name`);

// 注册面板
Editor.Panel.extend({

  /** HTML */
  template: readFileSync(Editor.url(`packages://${PACKAGE_NAME}/panel.setting/index.html`), 'utf8'),

  /** 样式 */
  style: readFileSync(Editor.url(`packages://${PACKAGE_NAME}/panel.setting/index.css`), 'utf8'),

  /**
   * 当面板渲染成功后触发
   */
  ready() {
    // 创建 Vue 实例
    const app = new window.Vue({

      /**
       * 挂载目标
       * @type {string | Element}
       */
      el: this.shadowRoot,

      /**
       * 数据对象
       */
      data: {
        // 多语言文本
        titleLabel: translate(`${PACKAGE_NAME}.setting`),
        selectLabel: translate(`${PACKAGE_NAME}.select`),
        selectTooltipLabel: translate(`${PACKAGE_NAME}.selectTooltip`),
        customLabel: translate(`${PACKAGE_NAME}.custom`),
        customPlaceholderLabel: translate(`${PACKAGE_NAME}.customPlaceholder`),
        customTooltipLabel: translate(`${PACKAGE_NAME}.customTooltip`),
        referenceLabel: translate(`${PACKAGE_NAME}.reference`),
        repositoryLabel: translate(`${PACKAGE_NAME}.repository`),
        applyLabel: translate(`${PACKAGE_NAME}.apply`),
        // 预设快捷键
        presets: [
          { key: 'custom', name: translate(`${PACKAGE_NAME}.custom`) },
          { key: 'F1', name: 'F1' },
          { key: 'F3', name: 'F3' },
          { key: 'F4', name: 'F4' },
          { key: 'F5', name: 'F5' },
          { key: 'F6', name: 'F6' },
          { key: 'CmdOrCtrl+F', name: 'Cmd/Ctrl + F' },
          { key: 'CmdOrCtrl+B', name: 'Cmd/Ctrl + B' },
          { key: 'CmdOrCtrl+Shift+F', name: 'Cmd/Ctrl + Shift + F' },
        ],
        // 设置
        select: 'F1',
        custom: '',
        // 按钮状态
        isProcessing: false
      },

      /**
       * 实例函数
       * @type {{ [key: string]: Function }}
       */
      methods: {

        /**
         * 选择变化回调
         * @param {*} event 
         */
        onSelectChange(event) {
          if (this.select !== 'custom') {
            this.custom = '';
          }
        },

        /**
         * 自定义输入框内容变化回调
         * @param {*} event 
         */
        onCustomChange(event) {
          if (this.select !== 'custom') {
            this.select = 'custom';
          }
        },

        /**
         * 应用设置
         * @param {*} event 
         */
        onApplyBtnClick(event) {
          if (this.isProcessing) return;
          // 配置
          const config = Object.create(null);
          if (this.select === 'custom') {
            const custom = this.custom;
            // 输入是否有效
            if (custom === '') {
              Editor.warn(`[${EXTENSION_NAME}]`, translate(`${PACKAGE_NAME}.customError`));
              return;
            }
            // 不可以使用双引号（避免 json 值中出现双引号而解析错误，导致插件加载失败）
            if (custom.includes('"')) {
              this.custom = this.custom.replace(/\"/g, '');
              Editor.warn(`[${EXTENSION_NAME}]`, translate(`${PACKAGE_NAME}.quoteError`));
              return;
            }
            config.hotkey = custom;
          } else {
            config.hotkey = this.select;
          }
          // 发消息给主进程保存配置
          this.isProcessing = true;
          Editor.Ipc.sendToMain(`${PACKAGE_NAME}:save-config`, config, (error) => {
            this.isProcessing = false;
          });
        },

        /**
         * 读取设置
         */
        readConfig() {
          Editor.Ipc.sendToMain(`${PACKAGE_NAME}:read-config`, (error, config) => {
            if (error || !config) return;
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
          });
        },

      },

    });

    // 读取配置
    app.readConfig();

  },

});
