const Path = require('path');

/**
 * 文件打开器
 */
const Opener = {

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
                Opener.openScene(uuid);
                break;
            case '.prefab':
                // 打开预制体
                Opener.openPrefab(uuid);
                break;
            default:
                // 聚焦到文件
                Opener.focusOnFile(uuid);
                break;
        }
    },

    /**
     * 打开场景
     * @param {string} uuid uuid
     */
    openScene(uuid) {
        // 打开
        Editor.Panel.open('scene', { uuid });
        // 聚焦
        setTimeout(() => Opener.focusOnFile(uuid));
    },

    /**
     * 打开预制体
     * @param {string} uuid uuid
     */
    openPrefab(uuid) {
        // 打开
        Editor.Ipc.sendToAll('scene:enter-prefab-edit-mode', uuid);
        // 聚焦
        setTimeout(() => Opener.focusOnFile(uuid));
    },

    /**
     * 聚焦到文件（在资源管理器中显示并选中文件）
     * @param {string} uuid uuid
     */
    focusOnFile(uuid) {
        Editor.Ipc.sendToAll('assets:hint', uuid);
        Editor.Selection.select('asset', uuid);
    },

};

module.exports = Opener;
