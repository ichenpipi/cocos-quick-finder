const Path = require('path');
const PanelManager = require('./panel-manager');
const ConfigManager = require('../common/config-manager');
const MainUtil = require('../eazax/main-util');
const EditorKit = require('../eazax/editor-kit');
const { checkUpdate } = require('../eazax/editor-util');
const { map } = require('../eazax/file-util');

/**
 * 生命周期：加载
 */
function load() {
    // 监听事件
    EditorKit.register();
    MainUtil.on('match', onMatchEvent);
    MainUtil.on('open', onOpenEvent);
    MainUtil.on('focus', onFocusEvent);
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
    EditorKit.unregister();
    MainUtil.removeAllListeners('match');
    MainUtil.removeAllListeners('open');
    MainUtil.removeAllListeners('focus');
}

/**
 * （渲染进程）关键词匹配事件回调
 * @param {Electron.IpcMainEvent} event 
 * @param {string} keyword 关键词
 */
function onMatchEvent(event, keyword) {
    // 匹配结果
    const results = getMatchedFiles(keyword);
    // 返回结果给渲染进程
    if (event.reply) {
        MainUtil.reply(event, 'match-reply', results);
    } else {
        // 兼容低版本 electron
        MainUtil.send(event.sender, 'match-reply', results);
    }
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
function onFocusEvent(event, path) {
    // 在资源管理器中显示并选中文件
    const uuid = Editor.assetdb.fspathToUuid(path);
    focusOnFile(uuid);
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
 * 数据缓存
 * @type {{ name: string, path: string, extname: string }[]}
 */
let caches = null;

/**
 * 收集项目中的文件信息
 */
async function collectFiles() {
    // 重置缓存
    const _caches = caches = [];
    // 项目目录
    const assetsPath = Editor.url('db://assets/');
    const handler = (path, stat) => {
        // 过滤
        if (filter(path)) {
            const name = Path.basename(path),
                extname = Path.extname(path);
            _caches.push({ name, path, extname });
        }
    }
    // 遍历项目文件
    await map(assetsPath, handler);
    // 发消息通知渲染进程（搜索栏）
    if (PanelManager.search && !PanelManager.search.isDestroyed()) {
        const webContents = PanelManager.search.webContents;
        MainUtil.send(webContents, 'data-update');
    }
}

/**
 * 获取项目中匹配关键词的文件
 * @param {string} keyword 关键词
 * @returns {{ name: string, path: string, extname: string, similarity: number }[]}
 */
function getMatchedFiles(keyword) {
    // 正则（每个关键字之间可以有任意个字符(.*)；不区分大小写(i)；懒惰模式(?)，匹配尽肯少的字符）
    const pattern = keyword.split('').join('.*?'),
        regExp = new RegExp(pattern, 'i');
    // 下面这行正则插入很炫酷，但是性能不好，耗时接近 split + join 的 10 倍
    // const pattern = keyword.replace(/(?<=.)(.)/g, '.*$1');
    // 查找并匹配
    const results = [];
    if (caches) {
        // 从缓存中查找
        for (let i = 0, l = caches.length; i < l; i++) {
            const { name, path, extname } = caches[i];
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
    }
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
    PanelManager.closeSearchBar();
}

/**
 * 打开场景
 * @param {string} uuid uuid
 */
function openScene(uuid) {
    // 打开
    Editor.Panel.open('scene', { uuid });
    // 聚焦
    setTimeout(() => focusOnFile(uuid));
}

/**
 * 打开预制体
 * @param {string} uuid uuid
 */
function openPrefab(uuid) {
    // 打开
    Editor.Ipc.sendToAll('scene:enter-prefab-edit-mode', uuid);
    // 聚焦
    setTimeout(() => focusOnFile(uuid));
}

/**
 * 聚焦到文件（在资源管理器中显示并选中文件）
 * @param {string} uuid uuid
 */
function focusOnFile(uuid) {
    Editor.Ipc.sendToAll('assets:hint', uuid);
    Editor.Selection.select('asset', uuid);
}

module.exports = {

    /**
     * 扩展消息
     */
    messages: {

        /**
         * 打开搜索面板
         * @param {*} event 
         */
        'open-search-panel'(event) {
            const options = {
                /** 打开前 */
                onBeforeOpen: () => {
                    // 收集项目中的文件信息
                    collectFiles();
                },
                /** 关闭后 */
                onClosed: () => {
                    // 清除缓存
                    caches = null;
                },
            };
            PanelManager.openSearchBar(options);
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
