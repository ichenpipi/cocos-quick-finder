const Path = require('path');
const Fs = require('fs');

/** package.json 的路径 */
const PACKAGE_PATH = Path.join(__dirname, '../../package.json');

/** 配置文件路径 */
const CONFIG_PATH = Path.join(__dirname, '../../config.json');

/**
 * 配置管理器
 */
const ConfigManager = {

    /**
     * 默认配置
     */
    get defaultConfig() {
        return {
            version: '1.0',
            autoCheckUpdate: true,
        };
    },

    /**
     * 读取配置
     * @returns {{ hotkey: string, autoCheckUpdate: boolean }}
     */
    get() {
        const configData = ConfigManager.defaultConfig;
        // 配置
        if (Fs.existsSync(CONFIG_PATH)) {
            const localConfig = JSON.parse(Fs.readFileSync(CONFIG_PATH));
            configData.autoCheckUpdate = localConfig.autoCheckUpdate;
        }
        // 快捷键
        const packageData = JSON.parse(Fs.readFileSync(PACKAGE_PATH)),
            menuItem = packageData['contributions']['shortcuts'][0];
        configData.hotkey = menuItem['win'] || '';
        // Done
        return configData;
    },

    /**
     * 保存配置
     * @param {{ hotkey: string, autoCheckUpdate: boolean }} config 配置
     */
    set(config) {
        const configData = ConfigManager.defaultConfig;
        // 配置
        configData.autoCheckUpdate = config.autoCheckUpdate;
        Fs.writeFileSync(CONFIG_PATH, JSON.stringify(configData, null, 2));
        // 快捷键
        const packageData = JSON.parse(Fs.readFileSync(PACKAGE_PATH)),
            menuItem = packageData['contributions']['shortcuts'][0];
        if (config.hotkey && config.hotkey !== '') {
            menuItem['win'] = config.hotkey;
            menuItem['mac'] = config.hotkey;
        } else {
            menuItem['win'] = '';
            menuItem['mac'] = '';
        }
        Fs.writeFileSync(PACKAGE_PATH, JSON.stringify(packageData, null, 2));
    },

};

module.exports = ConfigManager;
