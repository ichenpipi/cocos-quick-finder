const MainEvent = require('../eazax/main-event');
const EditorMainKit = require('../eazax/editor-main-kit');
const { checkUpdate } = require('../eazax/editor-main-util');
const ConfigManager = require('../common/config-manager');
const Finder = require('./finder');
const Opener = require('./opener');
const PanelManager = require('./panel-manager');

/**
 * 生命周期：加载
 */
function load() {
    // 监听事件
    EditorMainKit.register();
    MainEvent.on('match', onMatchEvent);
    MainEvent.on('open', onOpenEvent);
    MainEvent.on('focus', onFocusEvent);
    // 自动检查更新
    const config = ConfigManager.get();
    if (config.autoCheckUpdate) {
        // 延迟一段时间
        const delay = 6 * 60 * 1000;
        setTimeout(() => checkUpdate(false), delay);
    }
}

/**
 * 生命周期：卸载
 */
function unload() {
    // 关闭搜索栏
    PanelManager.closeSearchBar();
    // 取消事件监听
    EditorMainKit.unregister();
    MainEvent.removeAllListeners('match');
    MainEvent.removeAllListeners('open');
    MainEvent.removeAllListeners('focus');
}

/**
 * （渲染进程）关键词匹配事件回调
 * @param {Electron.IpcMainEvent} event 
 * @param {string} keyword 关键词
 */
function onMatchEvent(event, keyword) {
    // 匹配结果
    const results = Finder.getMatchedFiles(keyword);
    // 返回结果给渲染进程
    if (event.reply) {
        MainEvent.reply(event, 'match-reply', results);
    } else {
        // 兼容 Electron 4.x 及以下版本
        MainEvent.send(event.sender, 'match-reply', results);
    }
}

/**
 * （渲染进程）打开文件事件回调
 * @param {Electron.IpcMainEvent} event 
 * @param {string} path 路径
 */
function onOpenEvent(event, path) {
    // 打开文件
    Opener.openFile(path);
    // 关闭搜索栏
    PanelManager.closeSearchBar();
}

/**
 * （渲染进程）聚焦文件事件回调
 * @param {Electron.IpcMainEvent} event 
 * @param {string} path 路径
 */
function onFocusEvent(event, path) {
    // 在资源管理器中显示并选中文件
    const uuid = Editor.assetdb.fspathToUuid(path);
    Opener.focusOnFile(uuid);
}

/**
 * 打开搜索栏
 */
function openSearchBar() {
    const options = {
        /** 打开前 */
        onBeforeOpen: async () => {
            // 收集项目中的文件信息
            await Finder.collectFiles();
            // 发消息通知渲染进程（搜索栏）
            if (PanelManager.search) {
                const webContents = PanelManager.search.webContents;
                MainEvent.send(webContents, 'data-update');
            }
        },
        /** 关闭后 */
        onClosed: () => {
            // 清除缓存
            Finder.clearCaches();
        },
    };
    PanelManager.openSearchBar(options);
}

module.exports = {

    /**
     * 扩展消息
     */
    messages: {

        /**
         * 打开搜索栏
         * @param {*} event 
         */
        'open-search-bar'(event) {
            openSearchBar();
        },

        /**
         * 打开设置面板
         * @param {*} event 
         */
        'open-settings-panel'(event) {
            PanelManager.openSettingsPanel();
        },

        /**
         * 检查更新
         * @param {*} event 
         */
        'menu-check-update'(event) {
            checkUpdate(true);
        },

    },

    load,

    unload,

};
