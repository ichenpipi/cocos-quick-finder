const Path = require('path');
const Fs = require('fs');
const PackageUtil = require('../eazax/package-util');

/** 包名 */
const PACKAGE_NAME = PackageUtil.name;

/** package.json 的路径 */
const PACKAGE_PATH = Path.join(__dirname, '../../package.json');

/** 快捷键行为 */
const ACTION_NAME = 'search';

/** package.json 中的菜单项 key */
const MENU_ITEM_KEY = `i18n:MAIN_MENU.package.title/i18n:${PACKAGE_NAME}.name/i18n:${PACKAGE_NAME}.${ACTION_NAME}`;

/** 配置文件路径 */
const CONFIG_PATH = Path.join(__dirname, '../../config.json');

/**
 * 配置缓存
 */
let configCache = null;

/**
 * 配置管理器
 */
const ConfigManager = {

    /**
     * 配置缓存
     */
    get cache() {
        if (!configCache) {
            ConfigManager.get();
        }
        return configCache;
    },

    /**
     * 默认配置
     */
    get defaultConfig() {
        return {
            version: '1.1',
            openable: ['.fire', '.prefab'],
            autoCheckUpdate: true,
        };
    },

    /**
     * 读取配置
     */
    get() {
        const config = ConfigManager.defaultConfig;
        // 配置
        if (Fs.existsSync(CONFIG_PATH)) {
            const localConfig = JSON.parse(Fs.readFileSync(CONFIG_PATH));
            for (const key in config) {
                if (localConfig[key] !== undefined) {
                    config[key] = localConfig[key];
                }
            }
        }
        // 缓存起来
        configCache = JSON.parse(JSON.stringify(config));

        // 快捷键
        const package = JSON.parse(Fs.readFileSync(PACKAGE_PATH)),
            item = package['main-menu'][MENU_ITEM_KEY];
        config.hotkey = item['accelerator'] || '';

        // Done
        return config;
    },

    /**
     * 保存配置
     * @param {*} value 配置
     */
    set(value) {
        const config = ConfigManager.defaultConfig;
        // 配置
        config.openable = value.openable;
        config.autoCheckUpdate = value.autoCheckUpdate;
        Fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        // 缓存起来
        configCache = JSON.parse(JSON.stringify(config));

        // 快捷键
        const package = JSON.parse(Fs.readFileSync(PACKAGE_PATH)),
            item = package['main-menu'][MENU_ITEM_KEY];
        if (value.hotkey && value.hotkey !== '') {
            item['accelerator'] = value.hotkey;
        } else {
            delete item['accelerator'];
        }
        Fs.writeFileSync(PACKAGE_PATH, JSON.stringify(package, null, 2));
    },

};

module.exports = ConfigManager;
