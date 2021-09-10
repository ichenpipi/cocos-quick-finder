const Path = require('path');
const ConfigManager = require('../common/config-manager');

/**
 * 文件打开器
 */
const Opener = {

    /**
     * 尝试打开文件
     * @param {string} path 路径
     */
    tryOpen(path) {
        const extname = Path.extname(path),
            uuid = Opener.fspathToUuid(path);
        // 是否配置了快速打开
        const { openable } = ConfigManager.cache;
        if (openable.indexOf(extname) !== -1) {
            Opener.open(extname, uuid);
        }
        // 聚焦到文件（不延迟的话打开预制体会报错）
        setTimeout(() => Opener.focusOnFile(uuid));
    },

    /**
     * 打开文件
     * @param {string} extname 扩展名
     * @param {string} uuid Uuid
     */
    open(extname, uuid) {
        switch (extname) {
            case '.fire': {
                Opener.openScene(uuid);
                break;
            }
            case '.prefab': {
                Opener.openPrefab(uuid);
                break;
            }
            case '.ts':
            case '.js':
            case '.json':
            case '.txt':
            case '.md': {
                Opener.openText(uuid);
                break;
            }
        }
    },

    /**
     * 打开场景
     * @param {string} uuid Uuid
     */
    openScene(uuid) {
        Editor.Panel.open('scene', { uuid });
    },

    /**
     * 打开预制体
     * @param {string} uuid Uuid
     */
    openPrefab(uuid) {
        Editor.Ipc.sendToAll('scene:enter-prefab-edit-mode', uuid);
    },

    /**
     * 打开文本文件
     * @param {string} uuid Uuid
     */
    openText(uuid) {
        Editor.Ipc.sendToMain('assets:open-text-file', uuid);
    },

    /**
     * 聚焦到文件（在资源管理器中显示并选中文件）
     * @param {string} uuid Uuid
     */
    focusOnFile(uuid) {
        Editor.Ipc.sendToAll('assets:hint', uuid);
        Editor.Selection.select('asset', uuid);
    },

    /**
     * 通过绝对路径获取 uuid
     * @param {string} path 路径
     * @returns {string}
     */
    fspathToUuid(path) {
        return Editor.assetdb.fspathToUuid(path);
    },

};

module.exports = Opener;
