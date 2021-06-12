const zh = require('./zh');
const en = require('./en');

/**
 * 多语言
 */
const I18n = {

    /**
     * 中文
     */
    zh,

    /**
     * 英文
     */
    en,

    /**
     * 多语言文本
     * @param {string} lang 语言
     * @param {string} key 关键字
     * @returns {string}
     */
    translate(lang, key) {
        return this[lang] ? this[lang][key] : undefined;
    }

}

module.exports = I18n;
