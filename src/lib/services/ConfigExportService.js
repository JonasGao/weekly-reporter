/**
 * 配置导出服务
 * 负责导出配置数据到JSON文件
 */
class ConfigExportService {
    constructor() {
        this.version = '1.0';
    }

    /**
     * 导出所有配置到JSON文件
     * @param {Array} configs - 配置数组
     * @param {string} currentConfigId - 当前配置ID
     * @returns {Promise<boolean>} - 导出是否成功
     */
    async exportAllConfigs(configs, currentConfigId) {
        try {
            // 验证输入数据
            if (!this.validateConfigs(configs)) {
                throw new Error('配置数据无效');
            }

            // 生成导出数据
            const exportData = this.generateExportData(configs, currentConfigId);

            // 验证导出数据
            if (!this.validateExportData(exportData)) {
                throw new Error('导出数据生成失败');
            }

            // 创建并下载文件
            await this.downloadConfigFile(exportData);

            return true;
        } catch (error) {
            console.error('导出配置失败:', error);
            throw error;
        }
    }

    /**
     * 生成导出数据结构
     * @param {Array} configs - 配置数组
     * @param {string} currentConfigId - 当前配置ID
     * @returns {Object} - 导出数据对象
     */
    generateExportData(configs, currentConfigId) {
        const exportDate = new Date().toISOString();
        const formattedDate = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');

        return {
            exportMetadata: {
                version: this.version,
                exportDate: exportDate,
                appName: 'Weekly Reporter',
                description: 'Weekly Reporter Configuration Export'
            },
            configurations: {
                configs: this.sanitizeConfigs(configs),
                currentConfigId: currentConfigId
            },
            settings: {
                // 预留给未来的应用设置
            }
        };
    }

    /**
     * 清理配置数据，移除敏感信息的明文显示（可选）
     * @param {Array} configs - 原始配置数组
     * @returns {Array} - 清理后的配置数组
     */
    sanitizeConfigs(configs) {
        // 深拷贝配置数组以避免修改原始数据
        return JSON.parse(JSON.stringify(configs));
    }

    /**
     * 验证配置数据
     * @param {Array} configs - 配置数组
     * @returns {boolean} - 验证是否通过
     */
    validateConfigs(configs) {
        if (!Array.isArray(configs)) {
            return false;
        }

        // 检查每个配置的基本结构
        return configs.every(config => {
            return config && 
                   typeof config.id === 'string' && 
                   typeof config.name === 'string' &&
                   typeof config.apiUrl === 'string' &&
                   typeof config.apiKey === 'string';
        });
    }

    /**
     * 验证导出数据结构
     * @param {Object} exportData - 导出数据
     * @returns {boolean} - 验证是否通过
     */
    validateExportData(exportData) {
        try {
            // 检查基本结构
            if (!exportData || typeof exportData !== 'object') {
                return false;
            }

            // 检查导出元数据
            const metadata = exportData.exportMetadata;
            if (!metadata || !metadata.version || !metadata.exportDate || !metadata.appName) {
                return false;
            }

            // 检查配置数据
            const configurations = exportData.configurations;
            if (!configurations || !Array.isArray(configurations.configs)) {
                return false;
            }

            // 验证配置数组
            return this.validateConfigs(configurations.configs);
        } catch (error) {
            console.error('验证导出数据时出错:', error);
            return false;
        }
    }

    /**
     * 创建并下载JSON配置文件
     * @param {Object} exportData - 导出数据
     * @param {string} customFilename - 自定义文件名（可选）
     */
    downloadConfigFile(exportData, customFilename = null) {
        return new Promise((resolve, reject) => {
            try {
                // 生成JSON字符串
                const jsonString = JSON.stringify(exportData, null, 2);
                
                // 创建Blob对象
                const blob = new Blob([jsonString], { 
                    type: 'application/json;charset=utf-8' 
                });

                // 生成文件名
                const filename = customFilename || this.generateFilename();

                // 创建下载链接
                const url = URL.createObjectURL(blob);
                const downloadLink = document.createElement('a');
                
                downloadLink.href = url;
                downloadLink.download = filename;
                downloadLink.style.display = 'none';

                // 添加到DOM并触发下载
                document.body.appendChild(downloadLink);
                downloadLink.click();

                // 清理
                document.body.removeChild(downloadLink);
                URL.revokeObjectURL(url);

                resolve(true);
            } catch (error) {
                console.error('下载配置文件失败:', error);
                reject(error);
            }
        });
    }

    /**
     * 生成导出文件名
     * @returns {string} - 文件名
     */
    generateFilename() {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
        
        return `weekly-reporter-config-export_${dateStr}_${timeStr}.json`;
    }

    /**
     * 获取导出数据的统计信息
     * @param {Object} exportData - 导出数据
     * @returns {Object} - 统计信息
     */
    getExportStats(exportData) {
        const stats = {
            totalConfigs: 0,
            configsWithDingTalk: 0,
            exportSize: 0,
            exportDate: null
        };

        try {
            if (exportData && exportData.configurations && exportData.configurations.configs) {
                const configs = exportData.configurations.configs;
                stats.totalConfigs = configs.length;
                stats.configsWithDingTalk = configs.filter(config => 
                    config.dingtalk && config.dingtalk.enabled
                ).length;
            }

            if (exportData && exportData.exportMetadata) {
                stats.exportDate = exportData.exportMetadata.exportDate;
            }

            // 计算导出数据大小（估算）
            const jsonString = JSON.stringify(exportData);
            stats.exportSize = new Blob([jsonString]).size;

        } catch (error) {
            console.error('计算导出统计信息失败:', error);
        }

        return stats;
    }

    /**
     * 显示安全警告对话框
     * @returns {Promise<boolean>} - 用户是否确认导出
     */
    showSecurityWarning() {
        return new Promise((resolve) => {
            // 创建安全警告对话框
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'block';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3>⚠️ 安全提醒</h3>
                    </div>
                    <div class="modal-body">
                        <div class="security-warning">
                            <p><strong>您即将导出的配置文件包含以下敏感信息：</strong></p>
                            <ul>
                                <li>API 密钥 (API Keys)</li>
                                <li>钉钉应用密钥 (DingTalk App Secrets)</li>
                                <li>其他认证信息</li>
                            </ul>
                            <p><strong>请注意：</strong></p>
                            <ul>
                                <li>✓ 妥善保管导出的文件</li>
                                <li>✓ 不要分享给未授权人员</li>
                                <li>✓ 建议在安全的存储位置保存</li>
                            </ul>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button id="cancelExport" class="btn btn-secondary">取消</button>
                        <button id="confirmExport" class="btn btn-primary">确定导出</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // 绑定事件
            const cancelBtn = modal.querySelector('#cancelExport');
            const confirmBtn = modal.querySelector('#confirmExport');

            const cleanup = () => {
                document.body.removeChild(modal);
            };

            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });

            confirmBtn.addEventListener('click', () => {
                cleanup();
                resolve(true);
            });

            // 点击背景关闭
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    cleanup();
                    resolve(false);
                }
            });

        });
    }

    /**
     * 导出特定配置
     * @param {Object} config - 单个配置对象
     * @returns {Promise<boolean>} - 导出是否成功
     */
    async exportSingleConfig(config) {
        try {
            if (!config || !this.validateConfigs([config])) {
                throw new Error('配置数据无效');
            }

            const exportData = this.generateExportData([config], config.id);
            await this.downloadConfigFile(exportData, `config_${config.name}_${Date.now()}.json`);

            return true;
        } catch (error) {
            console.error('导出单个配置失败:', error);
            throw error;
        }
    }

    /**
     * 检查浏览器兼容性
     * @returns {Object} - 兼容性检查结果
     */
    checkBrowserCompatibility() {
        const support = {
            fileDownload: false,
            jsonStringify: false,
            blob: false,
            localStorage: false
        };

        try {
            // 检查文件下载支持
            support.fileDownload = 'download' in document.createElement('a');

            // 检查JSON支持
            support.jsonStringify = typeof JSON.stringify === 'function';

            // 检查Blob支持
            support.blob = typeof Blob !== 'undefined';

            // 检查localStorage支持
            support.localStorage = typeof Storage !== 'undefined' && 
                                   typeof localStorage !== 'undefined';

        } catch (error) {
            console.error('浏览器兼容性检查失败:', error);
        }

        return {
            supported: Object.values(support).every(s => s),
            details: support
        };
    }

    /**
     * 格式化文件大小显示
     * @param {number} bytes - 字节数
     * @returns {string} - 格式化后的大小字符串
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// 如果在Node.js环境中，导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigExportService;
}