/**
 * 配置管理器
 * 统一管理配置的导入导出功能，协调各个服务之间的交互
 */
class ConfigurationManager {
    constructor() {
        this.exportService = new ConfigExportService();
        this.importService = new ConfigImportService();
        this.eventListeners = {};
    }

    /**
     * 初始化配置管理器
     * @param {Object} weeklyReporter - WeeklyReporter实例的引用
     */
    initialize(weeklyReporter) {
        this.weeklyReporter = weeklyReporter;
        
        // 检查浏览器兼容性
        this.checkCompatibility();
        
        // 绑定UI事件
        this.bindUIEvents();
    }

    /**
     * 检查浏览器兼容性
     */
    checkCompatibility() {
        const exportCompat = this.exportService.checkBrowserCompatibility();
        const importCompat = this.importService.checkBrowserSupport();

        if (!exportCompat.supported) {
            console.warn('导出功能在当前浏览器中可能不完全支持:', exportCompat.details);
        }

        const importSupported = Object.values(importCompat).every(support => support);
        if (!importSupported) {
            console.warn('导入功能在当前浏览器中可能不完全支持:', importCompat);
        }

        return {
            exportSupported: exportCompat.supported,
            importSupported: importSupported
        };
    }

    /**
     * 绑定UI事件
     */
    bindUIEvents() {
        // 导出按钮事件
        const exportBtn = document.getElementById('exportConfig');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.handleExportClick());
        }

        // 导入按钮事件
        const importBtn = document.getElementById('importConfig');
        if (importBtn) {
            importBtn.addEventListener('click', () => this.handleImportClick());
        }

        // 导入文件选择事件
        const importFileInput = document.getElementById('importFileInput');
        if (importFileInput) {
            importFileInput.addEventListener('change', (e) => this.handleFileSelection(e));
        }

        // 导入对话框确认事件
        const confirmImportBtn = document.getElementById('confirmImport');
        if (confirmImportBtn) {
            confirmImportBtn.addEventListener('click', () => this.handleImportConfirm());
        }

        // 导入对话框取消事件
        const cancelImportBtn = document.getElementById('cancelImport');
        if (cancelImportBtn) {
            cancelImportBtn.addEventListener('click', () => this.hideImportDialog());
        }

        // 关闭导入对话框
        const closeImportDialogBtn = document.getElementById('closeImportDialog');
        if (closeImportDialogBtn) {
            closeImportDialogBtn.addEventListener('click', () => this.hideImportDialog());
        }
    }

    /**
     * 处理导出按钮点击
     */
    async handleExportClick() {
        try {
            if (!this.weeklyReporter) {
                throw new Error('WeeklyReporter实例未初始化');
            }

            // 显示安全警告
            const confirmed = await this.exportService.showSecurityWarning();
            if (!confirmed) {
                return;
            }

            // 显示加载状态
            this.setExportButtonState(true);

            // 获取当前配置
            const configs = this.weeklyReporter.configs || [];
            const currentConfigId = this.weeklyReporter.currentConfigId;

            if (configs.length === 0) {
                throw new Error('没有找到可导出的配置');
            }

            // 执行导出
            await this.exportService.exportAllConfigs(configs, currentConfigId);

            // 显示成功消息
            this.showMessage('success', `配置导出成功！共导出 ${configs.length} 个配置`);

            // 触发导出完成事件
            this.triggerEvent('configExported', {
                configCount: configs.length,
                timestamp: new Date().toISOString(),
                success: true
            });

        } catch (error) {
            console.error('导出配置失败:', error);
            let errorMessage = '导出失败';
            
            // 根据错误类型提供更具体的错误信息
            if (error.message.includes('浏览器不支持')) {
                errorMessage = '您的浏览器不支持文件下载功能，请升级浏览器或使用其他浏览器';
            } else if (error.message.includes('配置数据无效')) {
                errorMessage = '配置数据验证失败，请检查配置完整性';
            } else {
                errorMessage = `导出失败：${error.message}`;
            }
            
            this.showMessage('error', errorMessage);
            
            // 触发导出失败事件
            this.triggerEvent('configExported', {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        } finally {
            this.setExportButtonState(false);
        }
    }

    /**
     * 处理导入按钮点击
     */
    handleImportClick() {
        // 创建隐藏的文件输入框
        let fileInput = document.getElementById('importFileInput');
        if (!fileInput) {
            fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.id = 'importFileInput';
            fileInput.accept = '.json';
            fileInput.style.display = 'none';
            document.body.appendChild(fileInput);
            
            // 绑定事件
            fileInput.addEventListener('change', (e) => this.handleFileSelection(e));
        }

        // 触发文件选择
        fileInput.click();
    }

    /**
     * 处理文件选择
     * @param {Event} event - 文件选择事件
     */
    async handleFileSelection(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            // 显示加载状态
            this.showMessage('info', '正在验证文件...');

            // 导入文件并验证
            const importResult = await this.importService.importConfigs(file);

            if (!importResult.success) {
                throw new Error(importResult.error);
            }

            // 保存导入数据以供后续使用
            this.pendingImportData = importResult;

            // 显示导入选项对话框
            this.showImportDialog(importResult);

        } catch (error) {
            console.error('文件验证失败:', error);
            this.showMessage('error', `文件验证失败：${error.message}`);
        }

        // 清空文件输入框
        event.target.value = '';
    }

    /**
     * 显示导入选项对话框
     * @param {Object} importResult - 导入结果
     */
    showImportDialog(importResult) {
        // 创建导入对话框（如果不存在）
        let dialog = document.getElementById('importOptionsDialog');
        if (!dialog) {
            dialog = this.createImportDialog();
        }

        // 更新对话框内容
        this.updateImportDialogContent(dialog, importResult);

        // 显示对话框
        dialog.style.display = 'block';
    }

    /**
     * 创建导入选项对话框
     * @returns {HTMLElement} - 对话框元素
     */
    createImportDialog() {
        const dialog = document.createElement('div');
        dialog.id = 'importOptionsDialog';
        dialog.className = 'modal';
        
        dialog.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>导入配置选项</h3>
                    <span class="close-modal" id="closeImportDialog">&times;</span>
                </div>
                <div class="modal-body">
                    <div id="importInfo" class="import-info"></div>
                    
                    <div class="import-options">
                        <h4>导入策略:</h4>
                        <div class="option-group">
                            <label>
                                <input type="radio" name="importStrategy" value="replace">
                                替换所有配置 - 删除现有配置，使用导入的配置
                            </label>
                        </div>
                        <div class="option-group">
                            <label>
                                <input type="radio" name="importStrategy" value="merge" checked>
                                合并配置 - 添加新配置，更新相同ID的配置 (推荐)
                            </label>
                        </div>
                        <div class="option-group">
                            <label>
                                <input type="radio" name="importStrategy" value="add_only">
                                仅添加新配置 - 跳过已存在的配置
                            </label>
                        </div>
                    </div>

                    <div class="import-additional-options">
                        <div class="option-group">
                            <label>
                                <input type="checkbox" id="setAsCurrentConfig" checked>
                                设为当前配置 (如果导入单个配置)
                            </label>
                        </div>
                        <div class="option-group">
                            <label>
                                <input type="checkbox" id="createBackupBeforeImport" checked>
                                导入前自动备份现有配置
                            </label>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="cancelImport" class="btn btn-secondary">取消</button>
                    <button id="confirmImport" class="btn btn-primary">确定导入</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // 绑定事件
        const closeBtn = dialog.querySelector('#closeImportDialog');
        const cancelBtn = dialog.querySelector('#cancelImport');
        const confirmBtn = dialog.querySelector('#confirmImport');

        closeBtn.addEventListener('click', () => this.hideImportDialog());
        cancelBtn.addEventListener('click', () => this.hideImportDialog());
        confirmBtn.addEventListener('click', () => this.handleImportConfirm());

        // 点击背景关闭
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                this.hideImportDialog();
            }
        });

        return dialog;
    }

    /**
     * 更新导入对话框内容
     * @param {HTMLElement} dialog - 对话框元素
     * @param {Object} importResult - 导入结果
     */
    updateImportDialogContent(dialog, importResult) {
        const infoDiv = dialog.querySelector('#importInfo');
        const stats = importResult.stats;
        
        infoDiv.innerHTML = `
            <div class="import-stats">
                <h4>文件信息:</h4>
                <p><strong>配置数量:</strong> ${stats.totalConfigs}</p>
                <p><strong>钉钉配置:</strong> ${stats.configsWithDingTalk}</p>
                <p><strong>导出时间:</strong> ${stats.exportDate ? new Date(stats.exportDate).toLocaleString('zh-CN') : '未知'}</p>
                <p><strong>文件版本:</strong> ${stats.version || '未知'}</p>
                <p><strong>文件大小:</strong> ${this.formatFileSize(stats.fileSize)}</p>
            </div>
        `;
    }

    /**
     * 隐藏导入对话框
     */
    hideImportDialog() {
        const dialog = document.getElementById('importOptionsDialog');
        if (dialog) {
            dialog.style.display = 'none';
        }
        
        // 清空待导入数据
        this.pendingImportData = null;
    }

    /**
     * 处理导入确认
     */
    async handleImportConfirm() {
        try {
            if (!this.pendingImportData || !this.weeklyReporter) {
                throw new Error('没有待导入的数据或WeeklyReporter实例未初始化');
            }

            // 获取导入选项
            const options = this.getImportOptions();

            // 显示加载状态
            this.setImportButtonState(true);
            this.showMessage('info', '正在导入配置...');

            // 创建备份（如果需要）
            let backupKey = null;
            if (options.createBackup) {
                try {
                    backupKey = this.importService.createBackup(
                        this.weeklyReporter.configs,
                        this.weeklyReporter.currentConfigId
                    );
                } catch (error) {
                    console.warn('创建备份失败:', error);
                }
            }

            // 合并配置
            const mergeResult = this.importService.mergeConfigurations(
                this.weeklyReporter.configs || [],
                this.pendingImportData.data.configurations.configs,
                options.strategy
            );

            if (!mergeResult.success) {
                throw new Error(mergeResult.error);
            }

            // 更新WeeklyReporter的配置
            this.weeklyReporter.configs = mergeResult.configs;

            // 更新当前配置ID（如果需要）
            if (options.setAsCurrent && mergeResult.configs.length > 0) {
                const importedConfigs = this.pendingImportData.data.configurations.configs;
                if (importedConfigs.length === 1) {
                    // 如果只导入一个配置，设为当前配置
                    this.weeklyReporter.currentConfigId = importedConfigs[0].id;
                } else if (this.pendingImportData.data.configurations.currentConfigId) {
                    // 使用导入文件中指定的当前配置
                    const importedCurrentId = this.pendingImportData.data.configurations.currentConfigId;
                    if (mergeResult.configs.some(config => config.id === importedCurrentId)) {
                        this.weeklyReporter.currentConfigId = importedCurrentId;
                    }
                }
            }

            // 保存到存储
            this.weeklyReporter.saveConfigsToStorage();
            this.weeklyReporter.saveCurrentConfigId();

            // 更新UI
            this.weeklyReporter.populateConfigSelector();
            this.weeklyReporter.loadCurrentConfigToForm();

            // 显示成功消息
            const stats = mergeResult.stats;
            let message = `配置导入成功！`;
            if (stats.added > 0) message += ` 新增: ${stats.added}`;
            if (stats.updated > 0) message += ` 更新: ${stats.updated}`;
            if (stats.skipped > 0) message += ` 跳过: ${stats.skipped}`;

            this.showMessage('success', message);

            // 隐藏对话框
            this.hideImportDialog();

            // 触发导入完成事件
            this.triggerEvent('configImported', {
                strategy: options.strategy,
                stats: mergeResult.stats,
                backupKey,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('导入配置失败:', error);
            this.showMessage('error', `导入失败：${error.message}`);
        } finally {
            this.setImportButtonState(false);
        }
    }

    /**
     * 获取导入选项
     * @returns {Object} - 导入选项
     */
    getImportOptions() {
        const strategyRadios = document.querySelectorAll('input[name="importStrategy"]');
        let strategy = 'merge';
        
        for (const radio of strategyRadios) {
            if (radio.checked) {
                strategy = radio.value;
                break;
            }
        }

        const setAsCurrent = document.getElementById('setAsCurrentConfig')?.checked ?? false;
        const createBackup = document.getElementById('createBackupBeforeImport')?.checked ?? true;

        return {
            strategy,
            setAsCurrent,
            createBackup
        };
    }

    /**
     * 设置导出按钮状态
     * @param {boolean} loading - 是否为加载状态
     */
    setExportButtonState(loading) {
        const btn = document.getElementById('exportConfig');
        if (btn) {
            btn.disabled = loading;
            btn.innerHTML = loading ? 
                '<span>⏳</span> 导出中...' : 
                '<span>📤</span> 导出配置';
        }
    }

    /**
     * 设置导入按钮状态
     * @param {boolean} loading - 是否为加载状态
     */
    setImportButtonState(loading) {
        const confirmBtn = document.getElementById('confirmImport');
        if (confirmBtn) {
            confirmBtn.disabled = loading;
            confirmBtn.innerHTML = loading ? 
                '<span>⏳</span> 导入中...' : 
                '确定导入';
        }
    }

    /**
     * 显示消息
     * @param {string} type - 消息类型 (success, error, info)
     * @param {string} message - 消息内容
     */
    showMessage(type, message) {
        if (this.weeklyReporter) {
            if (type === 'success') {
                this.weeklyReporter.showSuccess(message);
            } else if (type === 'error') {
                this.weeklyReporter.showError(message);
            } else {
                // 临时显示信息（可以后续改进）
                console.info(message);
            }
        }
    }

    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string} - 格式化后的大小
     */
    formatFileSize(bytes) {
        return this.importService.formatFileSize(bytes);
    }

    /**
     * 注册事件监听器
     * @param {string} event - 事件名
     * @param {Function} callback - 回调函数
     */
    on(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }

    /**
     * 移除事件监听器
     * @param {string} event - 事件名
     * @param {Function} callback - 回调函数
     */
    off(event, callback) {
        if (this.eventListeners[event]) {
            const index = this.eventListeners[event].indexOf(callback);
            if (index > -1) {
                this.eventListeners[event].splice(index, 1);
            }
        }
    }

    /**
     * 触发事件
     * @param {string} event - 事件名
     * @param {Object} data - 事件数据
     */
    triggerEvent(event, data) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`事件回调执行失败 (${event}):`, error);
                }
            });
        }
    }

    /**
     * 获取备份列表
     * @returns {Array} - 备份列表
     */
    getBackupList() {
        return this.importService.listBackups();
    }

    /**
     * 恢复备份
     * @param {string} backupKey - 备份键名
     * @returns {Promise<boolean>} - 恢复是否成功
     */
    async restoreBackup(backupKey) {
        try {
            const restoreResult = this.importService.restoreBackup(backupKey);
            
            if (!restoreResult.success) {
                throw new Error(restoreResult.error);
            }

            if (!this.weeklyReporter) {
                throw new Error('WeeklyReporter实例未初始化');
            }

            // 更新配置
            this.weeklyReporter.configs = restoreResult.configs;
            this.weeklyReporter.currentConfigId = restoreResult.currentConfigId;

            // 保存到存储
            this.weeklyReporter.saveConfigsToStorage();
            this.weeklyReporter.saveCurrentConfigId();

            // 更新UI
            this.weeklyReporter.populateConfigSelector();
            this.weeklyReporter.loadCurrentConfigToForm();

            this.showMessage('success', '配置已从备份恢复');
            return true;

        } catch (error) {
            console.error('恢复备份失败:', error);
            this.showMessage('error', `恢复备份失败：${error.message}`);
            return false;
        }
    }

    /**
     * 导出单个配置
     * @param {string} configId - 配置ID
     * @returns {Promise<boolean>} - 导出是否成功
     */
    async exportSingleConfig(configId) {
        try {
            if (!this.weeklyReporter) {
                throw new Error('WeeklyReporter实例未初始化');
            }

            const config = this.weeklyReporter.configs.find(c => c.id === configId);
            if (!config) {
                throw new Error('配置不存在');
            }

            await this.exportService.exportSingleConfig(config);
            this.showMessage('success', '单个配置导出成功！');
            return true;

        } catch (error) {
            console.error('导出单个配置失败:', error);
            this.showMessage('error', `导出失败：${error.message}`);
            return false;
        }
    }
}

// 如果在Node.js环境中，导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigurationManager;
}