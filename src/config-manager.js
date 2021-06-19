const Path = require('path');
const Fs = require('fs');

/** package.json 的路径 */
const packageFilePath = Path.join(__dirname, '../package.json');

/** 配置文件路径 */
const configPath = Path.join(__dirname, '../config.json');

/** 默认配置 */
const defaultConfig = {
    version: "1.0",
    autoCheckUpdate: true,
};

/**
 * 配置管理器
 */
const ConfigManager = {

    /**
     * 读取配置
     * @returns {{ hotkey: string, autoCheckUpdate: boolean }}
     */
    get() {
        const configData = { ...defaultConfig };
        // 快捷键
        const packageData = JSON.parse(Fs.readFileSync(packageFilePath));
        const item = packageData['contributions']['shortcuts'][0];
        configData.hotkey = item['win'];
        // 配置
        if (Fs.existsSync(configPath)) {
            const localConfig = JSON.parse(Fs.readFileSync(configPath));
            configData.autoCheckUpdate = localConfig.autoCheckUpdate;
        } else {
            configData.autoCheckUpdate = defaultConfig.autoCheckUpdate;
        }
        // Done
        return configData;
    },

    /**
     * 保存配置
     * @param {{ hotkey: string, autoCheckUpdate: boolean }} config 配置
     */
    set(config) {
        // 配置
        const configData = { ...defaultConfig };
        configData.autoCheckUpdate = config.autoCheckUpdate;
        Fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
        // 快捷键
        const packageData = JSON.parse(Fs.readFileSync(packageFilePath)),
            item = packageData['contributions']['shortcuts'][0];
        if (item['win'] !== config.hotkey) {
            item['win'] = config.hotkey;
            item['mac'] = config.hotkey;
            Fs.writeFileSync(packageFilePath, JSON.stringify(packageData, null, 2));
        }
    },

};

module.exports = ConfigManager;
