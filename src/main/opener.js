const Path = require('path');

/**
 * 支持快速打开的文件类型列表
 */
const OPENABLE = [
    '.scene', '.prefab', '.effect',
    '.jpg', '.jpeg', '.png',
    '.ts', '.js', '.json', '.txt', '.md',
    '.doc', '.xls', '.xlsx', '.csv',
];

/**
 * 文件打开器
 */
const Opener = {

    /**
     * 打开文件
     * @param {string} path 路径
     */
    async open(path) {
        const uuid = await Opener.fspathToUuid(path);
        // 聚焦
        Opener.focusOnFile(uuid);
        // 打开
        const ext = Path.extname(path);
        if (OPENABLE.indexOf(ext) !== -1) {
            Editor.Message.send('asset-db', 'open-asset', uuid);
        }
    },

    /**
     * 聚焦到文件（在资源管理器中显示并选中文件）
     * @param {string} uuid uuid
     */
    focusOnFile(uuid) {
        Editor.Selection.clear('asset');
        Editor.Selection.select('asset', [uuid]);
    },

    /**
     * 通过绝对路径获取 uuid
     * @param {string} path 路径
     * @returns {Promise<string>}
     */
    fspathToUuid(path) {
        return Editor.Message.request('asset-db', 'query-uuid', path);
    },

};

module.exports = Opener;
