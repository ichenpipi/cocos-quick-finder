const Fs = require('fs');
const Path = require('path');

/** package.json 的路径 */
const packageFilePath = Path.join(__dirname, 'package.json');

/** package.json 中的 key */
const itemKey = 'i18n:MAIN_MENU.package.title/i18n:ccc-quick-finder.name/i18n:ccc-quick-finder.search';

/** 配置管理器 */
const ConfigManager = {

    /**
     * 保存配置
     * @param {{ hotkey: string }} config 配置
     */
    save(config) {
        const jsonData = JSON.parse(Fs.readFileSync(packageFilePath)),
            item = jsonData['main-menu'][itemKey];
        // 快捷键
        if (item['accelerator'] !== config.hotkey) {
            item['accelerator'] = config.hotkey;
            Fs.writeFileSync(packageFilePath, JSON.stringify(jsonData, null, 2));
        }
    },

    /**
     * 读取配置
     * @returns {{ hotkey: string }}
     */
    read() {
        const jsonData = JSON.parse(Fs.readFileSync(packageFilePath)),
            config = Object.create(null);
        // 快捷键
        config.hotkey = jsonData['main-menu'][itemKey]['accelerator'];
        // Done
        return config;
    }

}

module.exports = ConfigManager;
