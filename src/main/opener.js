const Path = require('path');

/**
 * 文件打开器
 */
const Opener = {

    /**
     * 打开文件
     * @param {string} path 路径
     */
    open(path) {
        const extname = Path.extname(path),
            uuid = Opener.fspathToUuid(path);
        // 文件格式
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
        // 聚焦到文件
        Opener.focusOnFile(uuid);
        // setTimeout(() => Opener.focusOnFile(uuid));
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
     * 打开文本文件
     * @param {string} uuid uuid
     */
    openText(uuid) {
        Editor.Ipc.sendToMain('assets:open-text-file', uuid);
    },

    /**
     * 聚焦到文件（在资源管理器中显示并选中文件）
     * @param {string} uuid uuid
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
