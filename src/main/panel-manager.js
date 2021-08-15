const { BrowserWindow } = require('electron');
const { join } = require('path');
const { language, translate } = require('../eazax/editor-util');
const { calcWindowPosition } = require('../eazax/window-util');

/** 扩展名称 */
const EXTENSION_NAME = translate('name');

/**
 * 面板管理器 (主进程)
 */
const PanelManager = {

    /**
     * 搜索栏实例
     * @type {BrowserWindow}
     */
    search: null,

    /**
     * 打开搜索栏
     * @param {{ onBeforeOpen: () => void, onClosed: () => void }} options 
     */
    openSearchBar(options) {
        // 已打开则关闭
        if (PanelManager.search) {
            return;
        }
        // 收集项目中的文件信息
        options.onBeforeOpen();
        // 窗口尺寸和位置（macOS 标题栏高 28px）
        const winSize = [500, 600],
            winPos = calcWindowPosition(winSize, 'top');
        // 创建窗口
        const win = PanelManager.search = new BrowserWindow({
            width: winSize[0],
            height: winSize[1],
            x: winPos[0],
            y: winPos[1] + 200,
            frame: false,
            resizable: false,
            fullscreenable: false,
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
        // 监听按键
        win.webContents.on('before-input-event', (event, input) => {
            if (input.key === 'Escape') PanelManager.closeSearchBar();
        });
        // 就绪后展示（避免闪烁）
        win.on('ready-to-show', () => win.show());
        // 失焦后
        win.on('blur', () => PanelManager.closeSearchBar());
        // 关闭后
        win.on('closed', () => {
            PanelManager.search = null;
            options.onClosed();
        });
        // 加载页面
        const path = join(__dirname, '../renderer/search/index.html');
        win.loadURL(`file://${path}?lang=${language}`);
        // 调试用的 devtools（detach 模式需要取消失焦自动关闭）
        // win.webContents.openDevTools({ mode: 'detach' });
    },

    /**
     * 关闭搜索栏
     */
    closeSearchBar() {
        if (!PanelManager.search) {
            return;
        }
        PanelManager.search.hide();
        PanelManager.search.close();
        PanelManager.search = null;
    },

    /**
     * 面板实例
     * @type {BrowserWindow}
     */
    settings: null,

    /**
     * 打开面板
     */
    openSettingsPanel() {
        // 已打开则关闭
        if (PanelManager.settings) {
            PanelManager.closeSettingsPanel();
            return;
        }
        // 窗口尺寸和位置（macOS 标题栏高 28px）
        const winSize = [500, 340],
            winPos = calcWindowPosition(winSize, 'center');
        // 创建窗口
        const win = PanelManager.settings = new BrowserWindow({
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
            fullscreenable: false,
            skipTaskbar: false,
            alwaysOnTop: true,
            hasShadow: true,
            show: false,
            webPreferences: {
                nodeIntegration: true,
            },
        });
        // 监听按键
        win.webContents.on('before-input-event', (event, input) => {
            if (input.key === 'Escape') PanelManager.closeSettingsPanel();
        });
        // 就绪后（展示，避免闪烁）
        win.on('ready-to-show', () => win.show());
        // 失焦后
        win.on('blur', () => PanelManager.closeSettingPanel());
        // 关闭后
        win.on('closed', () => (PanelManager.settings = null));
        // 加载页面
        const path = join(__dirname, '../renderer/settings/index.html');
        win.loadURL(`file://${path}?lang=${language}`);
        // 调试用的 devtools（detach 模式需要取消失焦自动关闭）
        // win.webContents.openDevTools({ mode: 'detach' });
    },

    /**
     * 关闭面板
     */
    closeSettingsPanel() {
        if (!PanelManager.settings) {
            return;
        }
        PanelManager.settings.hide();
        PanelManager.settings.close();
        PanelManager.settings = null;
    },

};

module.exports = PanelManager;
