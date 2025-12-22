/**
 * 配置导入服务
 * 负责从JSON文件导入配置数据并进行验证和合并
 */
class ConfigImportService {
    constructor() {
        this.supportedVersions = ['1.0'];
        this.maxFileSize = 1024 * 1024; // 1MB
    }

    /**
     * 从文件导入配置
     * @param {File} file - 配置文件
     * @param {Object} options - 导入选项
     * @returns {Promise<Object>} - 导入结果
     */
    async importConfigs(file, options = {}) {
        try {
            // 验证文件
            this.validateFile(file);

            // 读取文件内容
            const fileContent = await this.readFileContent(file);

            // 解析JSON
            const importData = this.parseJson(fileContent);

            // 验证导入数据结构
            this.validateImportData(importData);

            // 返回验证后的数据和导入选项
            return {
                success: true,
                data: importData,
                options: this.normalizeOptions(options),
                stats: this.getImportStats(importData)
            };

        } catch (error) {
            console.error('导入配置失败:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * 验证文件基本属性
     * @param {File} file - 文件对象
     */
    validateFile(file) {
        if (!file) {
            throw new Error('请选择一个文件');
        }

        // 检查文件类型
        if (file.type && !file.type.includes('json')) {
            console.warn('文件MIME类型不是JSON，但仍尝试解析');
        }

        // 检查文件扩展名
        if (!file.name.toLowerCase().endsWith('.json')) {
            throw new Error('文件格式错误，请选择JSON文件');
        }

        // 检查文件大小
        if (file.size > this.maxFileSize) {
            throw new Error(`文件过大，最大支持 ${this.formatFileSize(this.maxFileSize)}`);
        }

        // 检查文件是否为空
        if (file.size === 0) {
            throw new Error('文件为空，请选择有效的配置文件');
        }
    }

    /**
     * 读取文件内容
     * @param {File} file - 文件对象
     * @returns {Promise<string>} - 文件内容
     */
    readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const content = event.target.result;
                    if (typeof content !== 'string') {
                        throw new Error('文件内容读取异常');
                    }
                    resolve(content);
                } catch (error) {
                    reject(new Error('读取文件内容失败'));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('文件读取失败'));
            };
            
            reader.readAsText(file, 'utf-8');
        });
    }

    /**
     * 解析JSON内容
     * @param {string} content - JSON字符串
     * @returns {Object} - 解析后的对象
     */
    parseJson(content) {
        try {
            const data = JSON.parse(content);
            if (typeof data !== 'object' || data === null) {
                throw new Error('JSON格式错误');
            }
            return data;
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error('文件格式错误，请确保是有效的JSON文件');
            }
            throw error;
        }
    }

    /**
     * 验证导入数据结构
     * @param {Object} importData - 导入的数据
     */
    validateImportData(importData) {
        // 检查基本结构
        if (!importData || typeof importData !== 'object') {
            throw new Error('配置文件结构不正确');
        }

        // 检查导出元数据
        if (!importData.exportMetadata) {
            throw new Error('缺少导出元数据，文件可能不是有效的配置导出文件');
        }

        const metadata = importData.exportMetadata;
        
        // 检查版本兼容性
        if (!metadata.version) {
            throw new Error('配置文件缺少版本信息');
        }

        if (!this.supportedVersions.includes(metadata.version)) {
            throw new Error(`配置文件版本 ${metadata.version} 不兼容，支持的版本: ${this.supportedVersions.join(', ')}`);
        }

        // 检查应用名称
        if (metadata.appName !== 'Weekly Reporter') {
            console.warn('配置文件可能不是Weekly Reporter导出的文件');
        }

        // 检查配置数据
        if (!importData.configurations) {
            throw new Error('配置文件中没有找到配置数据');
        }

        const configs = importData.configurations.configs;
        if (!Array.isArray(configs)) {
            throw new Error('配置数据格式错误');
        }

        if (configs.length === 0) {
            throw new Error('文件中没有找到有效的配置');
        }

        // 验证每个配置项
        this.validateConfigs(configs);
    }

    /**
     * 验证配置数组
     * @param {Array} configs - 配置数组
     */
    validateConfigs(configs) {
        configs.forEach((config, index) => {
            try {
                this.validateSingleConfig(config);
            } catch (error) {
                throw new Error(`配置项 ${index + 1} 验证失败: ${error.message}`);
            }
        });
    }

    /**
     * 验证单个配置项
     * @param {Object} config - 单个配置
     */
    validateSingleConfig(config) {
        if (!config || typeof config !== 'object') {
            throw new Error('配置项格式错误');
        }

        // 检查必需字段
        const requiredFields = ['id', 'name', 'apiUrl', 'apiKey'];
        for (const field of requiredFields) {
            if (typeof config[field] !== 'string') {
                throw new Error(`缺少必需字段: ${field}`);
            }
        }

        // 验证ID格式
        if (!config.id.trim()) {
            throw new Error('配置ID不能为空');
        }

        // 验证名称
        if (!config.name.trim()) {
            throw new Error('配置名称不能为空');
        }

        // 验证API URL
        if (config.apiUrl && config.apiUrl.trim()) {
            try {
                new URL(config.apiUrl);
            } catch {
                throw new Error('API URL格式无效');
            }
        }

        // 验证钉钉配置（如果存在）
        if (config.dingtalk) {
            this.validateDingTalkConfig(config.dingtalk);
        }
    }

    /**
     * 验证钉钉配置
     * @param {Object} dingtalk - 钉钉配置
     */
    validateDingTalkConfig(dingtalk) {
        if (typeof dingtalk !== 'object') {
            throw new Error('钉钉配置格式错误');
        }

        // 如果启用了钉钉，验证必需字段
        if (dingtalk.enabled) {
            const requiredFields = ['corpId', 'appKey', 'appSecret', 'userId'];
            for (const field of requiredFields) {
                if (typeof dingtalk[field] !== 'string' || !dingtalk[field].trim()) {
                    console.warn(`钉钉配置缺少字段: ${field}`);
                }
            }
        }
    }

    /**
     * 合并配置数据
     * @param {Array} existingConfigs - 现有配置
     * @param {Array} newConfigs - 新配置
     * @param {string} strategy - 合并策略
     * @returns {Object} - 合并结果
     */
    mergeConfigurations(existingConfigs, newConfigs, strategy = 'merge') {
        try {
            let resultConfigs = [];
            let conflicts = [];
            let added = 0;
            let updated = 0;
            let skipped = 0;

            switch (strategy) {
                case 'replace':
                    resultConfigs = [...newConfigs];
                    added = newConfigs.length;
                    break;

                case 'merge':
                    resultConfigs = [...existingConfigs];
                    
                    newConfigs.forEach(newConfig => {
                        const existingIndex = resultConfigs.findIndex(
                            existing => existing.id === newConfig.id
                        );

                        if (existingIndex !== -1) {
                            // 更新现有配置
                            resultConfigs[existingIndex] = { ...newConfig };
                            updated++;
                        } else {
                            // 添加新配置
                            resultConfigs.push({ ...newConfig });
                            added++;
                        }
                    });
                    break;

                case 'add_only':
                    resultConfigs = [...existingConfigs];
                    
                    newConfigs.forEach(newConfig => {
                        const exists = resultConfigs.some(
                            existing => existing.id === newConfig.id
                        );

                        if (!exists) {
                            resultConfigs.push({ ...newConfig });
                            added++;
                        } else {
                            conflicts.push(newConfig.name || newConfig.id);
                            skipped++;
                        }
                    });
                    break;

                default:
                    throw new Error(`不支持的合并策略: ${strategy}`);
            }

            // 处理ID冲突
            resultConfigs = this.resolveIdConflicts(resultConfigs);

            return {
                success: true,
                configs: resultConfigs,
                stats: {
                    total: resultConfigs.length,
                    added,
                    updated,
                    skipped,
                    conflicts
                }
            };

        } catch (error) {
            console.error('合并配置失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 解决ID冲突
     * @param {Array} configs - 配置数组
     * @returns {Array} - 解决冲突后的配置数组
     */
    resolveIdConflicts(configs) {
        const usedIds = new Set();
        
        return configs.map(config => {
            let newId = config.id;
            let counter = 1;

            // 如果ID已存在，生成新的ID
            while (usedIds.has(newId)) {
                newId = `${config.id}_${counter}`;
                counter++;
            }

            usedIds.add(newId);

            if (newId !== config.id) {
                console.warn(`配置ID冲突已解决: ${config.id} -> ${newId}`);
            }

            return {
                ...config,
                id: newId
            };
        });
    }

    /**
     * 标准化导入选项
     * @param {Object} options - 原始选项
     * @returns {Object} - 标准化后的选项
     */
    normalizeOptions(options) {
        return {
            strategy: options.strategy || 'merge',
            setAsCurrent: options.setAsCurrent !== false, // 默认为true
            createBackup: options.createBackup !== false, // 默认为true
            validateUrls: options.validateUrls !== false  // 默认为true
        };
    }

    /**
     * 获取导入统计信息
     * @param {Object} importData - 导入数据
     * @returns {Object} - 统计信息
     */
    getImportStats(importData) {
        const stats = {
            totalConfigs: 0,
            configsWithDingTalk: 0,
            exportDate: null,
            version: null,
            fileSize: 0
        };

        try {
            if (importData.configurations && importData.configurations.configs) {
                const configs = importData.configurations.configs;
                stats.totalConfigs = configs.length;
                stats.configsWithDingTalk = configs.filter(config => 
                    config.dingtalk && config.dingtalk.enabled
                ).length;
            }

            if (importData.exportMetadata) {
                stats.exportDate = importData.exportMetadata.exportDate;
                stats.version = importData.exportMetadata.version;
            }

            // 估算文件大小
            const jsonString = JSON.stringify(importData);
            stats.fileSize = new Blob([jsonString]).size;

        } catch (error) {
            console.error('计算导入统计信息失败:', error);
        }

        return stats;
    }

    /**
     * 创建配置备份
     * @param {Array} configs - 当前配置
     * @param {string} currentConfigId - 当前配置ID
     * @returns {string} - 备份键名
     */
    createBackup(configs, currentConfigId) {
        try {
            const timestamp = new Date().toISOString();
            const backupKey = `weeklyReporter_backup_${Date.now()}`;
            
            const backupData = {
                timestamp,
                configs: JSON.parse(JSON.stringify(configs)),
                currentConfigId,
                version: '1.0'
            };

            localStorage.setItem(backupKey, JSON.stringify(backupData));
            
            // 限制备份数量，保留最新的5个
            this.cleanupOldBackups();

            return backupKey;
        } catch (error) {
            console.error('创建备份失败:', error);
            throw new Error('创建备份失败');
        }
    }

    /**
     * 清理旧备份
     */
    cleanupOldBackups() {
        try {
            const backupKeys = [];
            
            // 查找所有备份键
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('weeklyReporter_backup_')) {
                    backupKeys.push(key);
                }
            }

            // 按时间戳排序（最新的在前）
            backupKeys.sort((a, b) => {
                const timestampA = parseInt(a.split('_')[2]);
                const timestampB = parseInt(b.split('_')[2]);
                return timestampB - timestampA;
            });

            // 删除超过限制的备份
            if (backupKeys.length > 5) {
                const keysToDelete = backupKeys.slice(5);
                keysToDelete.forEach(key => {
                    localStorage.removeItem(key);
                });
            }
        } catch (error) {
            console.error('清理旧备份失败:', error);
        }
    }

    /**
     * 恢复备份
     * @param {string} backupKey - 备份键名
     * @returns {Object} - 恢复的数据
     */
    restoreBackup(backupKey) {
        try {
            const backupData = localStorage.getItem(backupKey);
            if (!backupData) {
                throw new Error('备份不存在');
            }

            const data = JSON.parse(backupData);
            return {
                success: true,
                configs: data.configs,
                currentConfigId: data.currentConfigId,
                timestamp: data.timestamp
            };
        } catch (error) {
            console.error('恢复备份失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 列出所有可用备份
     * @returns {Array} - 备份列表
     */
    listBackups() {
        const backups = [];
        
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('weeklyReporter_backup_')) {
                    try {
                        const data = JSON.parse(localStorage.getItem(key));
                        backups.push({
                            key,
                            timestamp: data.timestamp,
                            configCount: data.configs ? data.configs.length : 0,
                            version: data.version
                        });
                    } catch (error) {
                        console.warn(`无效的备份数据: ${key}`);
                    }
                }
            }

            // 按时间排序（最新的在前）
            backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        } catch (error) {
            console.error('列出备份失败:', error);
        }

        return backups;
    }

    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string} - 格式化后的大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 检查浏览器支持
     * @returns {Object} - 支持情况
     */
    checkBrowserSupport() {
        return {
            fileReader: typeof FileReader !== 'undefined',
            localStorage: typeof Storage !== 'undefined',
            json: typeof JSON !== 'undefined',
            blob: typeof Blob !== 'undefined'
        };
    }
}

// 如果在Node.js环境中，导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigImportService;
}