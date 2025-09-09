// 智能周报生成工具主要功能脚本

class WeeklyReporter {
    constructor() {
        this.configs = [];
        this.currentConfigId = null;
        this.history = [];
        this.contentProcessor = new AiContentProcessor();
        this.init();
    }

    init() {
        this.loadConfigs();
        this.loadHistory();
        this.bindEvents();
        this.loadSavedData();
        this.renderHistoryTable();
    }

    // 绑定事件监听器
    bindEvents() {
        try {
            // 配置相关
            const configSelector = document.getElementById('configSelector');
            if (configSelector) {
                configSelector.addEventListener('change', () => this.loadSelectedConfig());
            }
            
            const saveConfigBtn = document.getElementById('saveConfig');
            if (saveConfigBtn) {
                saveConfigBtn.addEventListener('click', () => this.saveConfig());
            }
            
            const newConfigBtn = document.getElementById('newConfig');
            if (newConfigBtn) {
                newConfigBtn.addEventListener('click', () => this.createNewConfig());
            }
            
            const deleteConfigBtn = document.getElementById('deleteConfig');
            if (deleteConfigBtn) {
                deleteConfigBtn.addEventListener('click', () => this.deleteCurrentConfig());
            }
            
            // 主要功能按钮
            const generateReportBtn = document.getElementById('generateReport');
            if (generateReportBtn) {
                generateReportBtn.addEventListener('click', () => this.generateReport());
            }
            
            const clearAllBtn = document.getElementById('clearAll');
            if (clearAllBtn) {
                clearAllBtn.addEventListener('click', () => this.clearAllInputs());
            }
            
            const saveDataBtn = document.getElementById('saveData');
            if (saveDataBtn) {
                saveDataBtn.addEventListener('click', () => this.saveData());
            }
            
            const loadDataBtn = document.getElementById('loadData');
            if (loadDataBtn) {
                loadDataBtn.addEventListener('click', () => this.loadData());
            }
            
            // 结果操作按钮
            const copyReportBtn = document.getElementById('copyReport');
            if (copyReportBtn) {
                copyReportBtn.addEventListener('click', () => this.copyReport());
            }
            
            const downloadReportBtn = document.getElementById('downloadReport');
            if (downloadReportBtn) {
                downloadReportBtn.addEventListener('click', () => this.downloadReport());
            }
            
            const printReportBtn = document.getElementById('printReport');
            if (printReportBtn) {
                printReportBtn.addEventListener('click', () => this.printReport());
            }
            
            // 错误消息关闭
            const closeErrorBtn = document.getElementById('closeError');
            if (closeErrorBtn) {
                closeErrorBtn.addEventListener('click', () => this.hideError());
                console.log('成功绑定 closeError 按钮点击事件');
            } else {
                console.error('找不到ID为 closeError 的元素');
            }
            
            const closeSuccessBtn = document.getElementById('closeSuccess');
            if (closeSuccessBtn) {
                closeSuccessBtn.addEventListener('click', () => this.hideSuccess());
                console.log('成功绑定 closeSuccess 按钮点击事件');
            } else {
                console.error('找不到ID为 closeSuccess 的元素');
            }

            // 输入框自动保存
            const inputs = ['lastWeekPlan', 'lastWeekWork', 'nextWeekPlan', 'additionalNotes'];
            inputs.forEach(inputId => {
                const inputElement = document.getElementById(inputId);
                if (inputElement) {
                    inputElement.addEventListener('input', () => this.autoSave());
                }
            });
            
            // 历史记录相关
            const clearHistoryBtn = document.getElementById('clearHistory');
            if (clearHistoryBtn) {
                clearHistoryBtn.addEventListener('click', () => this.clearHistory());
            }
            
            const exportHistoryBtn = document.getElementById('exportHistory');
            if (exportHistoryBtn) {
                exportHistoryBtn.addEventListener('click', () => this.exportHistory());
            }
            
            // 历史记录详情模态框关闭按钮
            const closeHistoryDetailBtn = document.getElementById('closeHistoryDetail');
            if (closeHistoryDetailBtn) {
                closeHistoryDetailBtn.addEventListener('click', () => this.closeHistoryDetail());
            }
            
            // 点击模态框外部关闭
            const historyDetailModal = document.getElementById('historyDetailModal');
            if (historyDetailModal) {
                window.addEventListener('click', (event) => {
                    if (event.target === historyDetailModal) {
                        this.closeHistoryDetail();
                    }
                });
            }
        } catch (error) {
            console.error('绑定事件时出错:', error);
        }
    }

    // 配置管理
    loadConfigs() {
        try {
            // 从本地存储加载配置
            const savedConfigs = localStorage.getItem('weeklyReporter_configs');
            if (savedConfigs) {
                this.configs = JSON.parse(savedConfigs);
            } else {
                // 初始化默认配置
                this.configs = [{
                    id: this.generateId(),
                    name: '默认配置',
                    apiUrl: '',
                    apiKey: ''
                }];
                this.saveConfigsToStorage();
            }
            
            // 加载最后使用的配置ID
            const lastUsedConfigId = localStorage.getItem('weeklyReporter_currentConfigId');
            if (lastUsedConfigId && this.configs.some(config => config.id === lastUsedConfigId)) {
                this.currentConfigId = lastUsedConfigId;
            } else if (this.configs.length > 0) {
                this.currentConfigId = this.configs[0].id;
            }
            
            // 填充配置选择器
            this.populateConfigSelector();
            
            // 加载当前配置到表单
            this.loadCurrentConfigToForm();
        } catch (error) {
            console.error('加载配置时出错:', error);
            this.showError('配置加载失败');
        }
    }
    
    // 生成唯一ID
    generateId() {
        return 'config_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    // 填充配置选择器
    populateConfigSelector() {
        const selector = document.getElementById('configSelector');
        if (!selector) return;
        
        // 清空现有选项
        selector.innerHTML = '';
        
        // 添加所有配置选项
        this.configs.forEach(config => {
            const option = document.createElement('option');
            option.value = config.id;
            option.textContent = config.name;
            selector.appendChild(option);
        });
        
        // 选中当前配置
        if (this.currentConfigId) {
            selector.value = this.currentConfigId;
        }
    }
    
    // 将配置保存到本地存储
    saveConfigsToStorage() {
        localStorage.setItem('weeklyReporter_configs', JSON.stringify(this.configs));
    }
    
    // 保存当前配置ID到本地存储
    saveCurrentConfigId() {
        localStorage.setItem('weeklyReporter_currentConfigId', this.currentConfigId);
    }
    
    // 从表单获取当前配置
    getCurrentConfigFromForm() {
        const name = document.getElementById('configName').value.trim() || '未命名配置';
        const apiUrl = document.getElementById('difyApiUrl').value.trim();
        const apiKey = document.getElementById('difyApiKey').value.trim();
        
        return {
            name,
            apiUrl,
            apiKey
        };
    }
    
    // 加载当前配置到表单
    loadCurrentConfigToForm() {
        const currentConfig = this.getCurrentConfig();
        if (!currentConfig) return;
        
        document.getElementById('configName').value = currentConfig.name || '';
        document.getElementById('difyApiUrl').value = currentConfig.apiUrl || '';
        document.getElementById('difyApiKey').value = currentConfig.apiKey || '';
    }
    
    // 获取当前配置
    getCurrentConfig() {
        if (!this.currentConfigId) return null;
        return this.configs.find(config => config.id === this.currentConfigId);
    }
    
    // 加载所选配置
    loadSelectedConfig() {
        const selector = document.getElementById('configSelector');
        if (!selector) return;
        
        this.currentConfigId = selector.value;
        this.saveCurrentConfigId();
        this.loadCurrentConfigToForm();
    }
    
    // 创建新配置
    createNewConfig() {
        const newConfig = {
            id: this.generateId(),
            name: '新配置',
            apiUrl: '',
            apiKey: ''
        };
        
        this.configs.push(newConfig);
        this.currentConfigId = newConfig.id;
        
        this.saveConfigsToStorage();
        this.saveCurrentConfigId();
        this.populateConfigSelector();
        this.loadCurrentConfigToForm();
        
        this.showSuccess('新配置已创建');
    }
    
    // 删除当前配置
    deleteCurrentConfig() {
        if (this.configs.length <= 1) {
            this.showError('至少需保留一个配置');
            return;
        }
        
        if (confirm('确定要删除当前配置吗？')) {
            // 找到当前配置索引
            const currentIndex = this.configs.findIndex(config => config.id === this.currentConfigId);
            if (currentIndex === -1) return;
            
            // 删除配置
            this.configs.splice(currentIndex, 1);
            
            // 选择新的当前配置
            this.currentConfigId = this.configs[0].id;
            
            this.saveConfigsToStorage();
            this.saveCurrentConfigId();
            this.populateConfigSelector();
            this.loadCurrentConfigToForm();
            
            this.showSuccess('配置已删除');
        }
    }
    
    // 保存当前配置
    saveConfig() {
        const formConfig = this.getCurrentConfigFromForm();
        
        if (!formConfig.apiUrl || !formConfig.apiKey) {
            this.showError('请填写完整的 API 配置信息');
            return;
        }
        
        // 查找并更新当前配置
        const configIndex = this.configs.findIndex(config => config.id === this.currentConfigId);
        if (configIndex === -1) {
            // 如果找不到配置，创建新配置
            const newConfig = {
                id: this.currentConfigId || this.generateId(),
                ...formConfig
            };
            this.configs.push(newConfig);
            this.currentConfigId = newConfig.id;
        } else {
            // 更新现有配置
            this.configs[configIndex] = {
                ...this.configs[configIndex],
                ...formConfig
            };
        }
        
        this.saveConfigsToStorage();
        this.populateConfigSelector();
        
        this.showSuccess('配置已保存');
    }

    // 数据收集
    collectInputData() {
        return {
            lastWeekPlan: document.getElementById('lastWeekPlan').value.trim(),
            lastWeekWork: document.getElementById('lastWeekWork').value.trim(),
            nextWeekPlan: document.getElementById('nextWeekPlan').value.trim(),
            additionalNotes: document.getElementById('additionalNotes').value.trim()
        };
    }

    // 验证输入数据
    validateInputData(data) {
        const errors = [];
        
        if (!data.lastWeekPlan) errors.push('上周工作计划');
        if (!data.lastWeekWork) errors.push('上周工作内容');
        if (!data.nextWeekPlan) errors.push('下周工作计划');
        
        return errors;
    }

    // 主要功能：生成周报
    async generateReport() {
        try {
            // 获取当前配置
            const currentConfig = this.getCurrentConfig();
            
            // 检查配置
            if (!currentConfig || !currentConfig.apiUrl || !currentConfig.apiKey) {
                this.showError('请先配置 Dify API 信息');
                return;
            }

            // 收集并验证数据
            const inputData = this.collectInputData();
            const errors = this.validateInputData(inputData);
            
            if (errors.length > 0) {
                this.showError(`请填写以下必需信息：${errors.join('、')}`);
                return;
            }

            // 显示加载状态
            this.showLoading(true);

            // 调用 Dify API
            const result = await this.callDifyAPI(inputData);
            
            // 处理结果
            if (result) {
                this.displayResult(result);
            }

        } catch (error) {
            console.error('生成周报失败：', error);
            this.showError(`生成周报失败：${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

    // 调用 Dify API
    async callDifyAPI(inputData) {
        const currentConfig = this.getCurrentConfig();
        if (!currentConfig) {
            throw new Error('无法获取当前配置');
        }
        
        const requestBody = {
            inputs: {
                prev_week_plan: inputData.lastWeekPlan,
                prev_week_work: inputData.lastWeekWork,
                curr_week_plan: inputData.nextWeekPlan,
                prev_week_additional_notes: inputData.additionalNotes || ''
            },
            response_mode: "blocking",
            user: "weekly-reporter-user"
        };

        const response = await fetch(currentConfig.apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentConfig.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API 调用失败 (${response.status}): ${errorText}`);
        }

        const responseData = await response.json();
        
        if (responseData.data && responseData.data.outputs && responseData.data.outputs.text) {
            return responseData.data.outputs.text;
        } else {
            throw new Error('API 返回数据格式异常');
        }
    }

    // 处理API返回结果中的think内容
    cleanupResult(result) {
        if (this.contentProcessor) {
            return this.contentProcessor.removeThinkContent(result);
        }
        
        // 备用清理逻辑
        return result.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    }

    // 显示结果
    displayResult(result) {
        try {
            // 清理结果
            const cleanedResult = this.cleanupResult(result);
            
            const resultContentElement = document.getElementById('resultContent');
            if (!resultContentElement) {
                throw new Error('找不到结果内容容器元素，ID: resultContent');
            }
            
            let processedResult;
            
            // 使用内容处理器格式化结果
            if (this.contentProcessor) {
                processedResult = this.contentProcessor.processContent(result);
                resultContentElement.innerHTML = processedResult.formatted;
                
                // 如果处理为JSON格式，显示处理成功消息
                if (processedResult.isJson) {
                    console.log('检测到JSON格式数据，已解析为结构化报告', processedResult.jsonData);
                }
            } else {
                // 备用处理
                const formattedResult = this.formatResult(cleanedResult);
                resultContentElement.innerHTML = formattedResult;
                processedResult = { formatted: formattedResult, isJson: false };
            }
            
            // 显示结果区域
            const resultSectionElement = document.getElementById('resultSection');
            if (resultSectionElement) {
                resultSectionElement.style.display = 'block';
                // 滚动到结果区域
                resultSectionElement.scrollIntoView({ behavior: 'smooth' });
            } else {
                console.error('找不到结果区域容器元素，ID: resultSection');
            }
            
            this.showSuccess('周报生成成功！');
            
            // 保存到历史记录
            this.addToHistory(result, processedResult);
            
        } catch (error) {
            console.error('显示结果失败：', error);
            this.showError(`显示结果失败：${error.message}`);
        }
    }

    // 基础格式化方法（备用）
    formatResult(result) {
        if (!result) return '';
        
        return result
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>');
    }

    // 通用复制到剪贴板方法
    async copyToClipboard(text, successMessage = '内容已复制到剪贴板') {
        try {
            await navigator.clipboard.writeText(text);
            this.showSuccess(successMessage);
            return true;
        } catch (error) {
            console.error('复制失败：', error);
            this.showError('复制失败，请手动选择复制');
            return false;
        }
    }
    
    // 复制周报
    async copyReport() {
        try {
            const resultContentElement = document.getElementById('resultContent');
            if (!resultContentElement) {
                throw new Error('找不到结果内容容器元素，ID: resultContent');
            }
            
            const content = resultContentElement.innerText;
            return await this.copyToClipboard(content, '周报内容已复制到剪贴板');
        } catch (error) {
            console.error('复制失败：', error);
            this.showError('复制失败，请手动选择复制');
            return false;
        }
    }

    // 下载周报
    downloadReport() {
        try {
            const resultContentElement = document.getElementById('resultContent');
            if (!resultContentElement) {
                throw new Error('找不到结果内容容器元素，ID: resultContent');
            }
            
            const content = resultContentElement.innerText;
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `周报_${new Date().toISOString().split('T')[0]}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showSuccess('周报已下载');
        } catch (error) {
            console.error('下载失败：', error);
            this.showError('下载失败');
        }
    }

    // 打印周报
    printReport() {
        try {
            const resultContentElement = document.getElementById('resultContent');
            if (!resultContentElement) {
                throw new Error('找不到结果内容容器元素，ID: resultContent');
            }
            
            const content = resultContentElement.innerHTML;
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>工作周报</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 40px; }
                        h1, h2, h3 { color: #2c3e50; }
                        table { border-collapse: collapse; width: 100%; margin: 15px 0; }
                        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                        th { background-color: #f8f9fa; }
                        @media print { body { margin: 20px; } }
                    </style>
                </head>
                <body>
                    <h1>工作周报</h1>
                    <p>生成时间：${new Date().toLocaleString('zh-CN')}</p>
                    <hr>
                    ${content}
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        } catch (error) {
            console.error('打印失败：', error);
            this.showError('打印失败');
        }
    }

    // 清空所有输入
    clearAllInputs() {
        if (confirm('确定要清空所有输入内容吗？')) {
            document.getElementById('lastWeekPlan').value = '';
            document.getElementById('lastWeekWork').value = '';
            document.getElementById('nextWeekPlan').value = '';
            document.getElementById('additionalNotes').value = '';
            document.getElementById('resultSection').style.display = 'none';
            localStorage.removeItem('weeklyReporter_draft');
            this.showSuccess('已清空所有内容');
        }
    }

    // 保存数据到本地文件
    saveData() {
        try {
            const data = this.collectInputData();
            const jsonData = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `周报数据_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showSuccess('数据已保存到文件');
        } catch (error) {
            console.error('保存数据失败：', error);
            this.showError('保存数据失败');
        }
    }

    // 从本地文件加载数据
    loadData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    if (data.lastWeekPlan !== undefined) document.getElementById('lastWeekPlan').value = data.lastWeekPlan || '';
                    if (data.lastWeekWork !== undefined) document.getElementById('lastWeekWork').value = data.lastWeekWork || '';
                    if (data.nextWeekPlan !== undefined) document.getElementById('nextWeekPlan').value = data.nextWeekPlan || '';
                    if (data.additionalNotes !== undefined) document.getElementById('additionalNotes').value = data.additionalNotes || '';
                    
                    this.showSuccess('数据加载成功');
                } catch (error) {
                    console.error('加载数据失败：', error);
                    this.showError('文件格式错误，加载失败');
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    }

    // 显示加载状态
    showLoading(show) {
        const button = document.getElementById('generateReport');
        if (show) {
            button.disabled = true;
            button.innerHTML = '<span>🔄</span> 生成中...';
        } else {
            button.disabled = false;
            button.innerHTML = '<span>🚀</span> 生成周报';
        }
    }

    // 显示错误信息
    showError(message) {
        try {
            const errorDiv = document.getElementById('errorMessage');
            const errorText = document.getElementById('errorText');
            
            if (!errorDiv) {
                console.error('找不到错误消息容器元素，ID: errorMessage');
                return;
            }
            
            if (!errorText) {
                console.error('找不到错误文本元素，ID: errorText');
                errorDiv.innerHTML = `<span class="error-icon">❌</span><span>${message}</span>`;
                errorDiv.style.display = 'block';
            } else {
                errorText.textContent = message;
                errorDiv.style.display = 'block';
            }
            
            // 5秒后自动隐藏
            setTimeout(() => {
                if (errorDiv) errorDiv.style.display = 'none';
            }, 5000);
        } catch (error) {
            console.error('显示错误消息失败:', error);
        }
    }

    // 显示成功信息
    showSuccess(message) {
        try {
            const successDiv = document.getElementById('successMessage');
            const successText = document.getElementById('successText');
            
            if (!successDiv) {
                console.error('找不到成功消息容器元素，ID: successMessage');
                return;
            }
            
            if (!successText) {
                console.error('找不到成功文本元素，ID: successText');
                successDiv.innerHTML = `<span class="success-icon">✅</span><span>${message}</span>`;
                successDiv.style.display = 'block';
            } else {
                successText.textContent = message;
                successDiv.style.display = 'block';
            }
            
            // 3秒后自动隐藏
            setTimeout(() => {
                if (successDiv) successDiv.style.display = 'none';
            }, 3000);
        } catch (error) {
            console.error('显示成功消息失败:', error);
        }
    }

    // 隐藏错误信息
    hideError() {
        try {
            const errorDiv = document.getElementById('errorMessage');
            if (errorDiv) {
                errorDiv.style.display = 'none';
            } else {
                console.error('找不到错误消息容器元素，ID: errorMessage');
            }
        } catch (error) {
            console.error('隐藏错误消息失败:', error);
        }
    }

    // 隐藏成功信息
    hideSuccess() {
        try {
            const successDiv = document.getElementById('successMessage');
            if (successDiv) {
                successDiv.style.display = 'none';
            } else {
                console.error('找不到成功消息容器元素，ID: successMessage');
            }
        } catch (error) {
            console.error('隐藏成功消息失败:', error);
        }
    }

    // 自动保存 (草稿)
    autoSave() {
        const data = this.collectInputData();
        localStorage.setItem('weeklyReporter_draft', JSON.stringify(data));
    }

    // 加载自动保存的数据
    loadSavedData() {
        const draftData = localStorage.getItem('weeklyReporter_draft');
        if (draftData) {
            try {
                const data = JSON.parse(draftData);
                if (data.lastWeekPlan) document.getElementById('lastWeekPlan').value = data.lastWeekPlan;
                if (data.lastWeekWork) document.getElementById('lastWeekWork').value = data.lastWeekWork;
                if (data.nextWeekPlan) document.getElementById('nextWeekPlan').value = data.nextWeekPlan;
                if (data.additionalNotes) document.getElementById('additionalNotes').value = data.additionalNotes;
            } catch (error) {
                console.error('加载草稿失败：', error);
            }
        }
    }
    
    // ============== 历史记录功能 ==============
    
    // 加载历史记录
    loadHistory() {
        try {
            const savedHistory = localStorage.getItem('weeklyReporter_history');
            if (savedHistory) {
                this.history = JSON.parse(savedHistory);
            }
        } catch (error) {
            console.error('加载历史记录失败：', error);
            this.history = [];
        }
    }
    
    // 保存历史记录到本地存储
    saveHistory() {
        try {
            localStorage.setItem('weeklyReporter_history', JSON.stringify(this.history));
        } catch (error) {
            console.error('保存历史记录失败：', error);
            this.showError('保存历史记录失败');
        }
    }
    
    // 获取文本摘要
    getSummary(text, maxLength = 30) {
        if (!text) return '';
        
        // 移除换行符，压缩空格
        let processed = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        
        if (processed.length <= maxLength) return processed;
        
        return processed.substring(0, maxLength) + '...';
    }
    
    // 添加到历史记录
    addToHistory(result, processedResult) {
        try {
            const inputData = this.collectInputData();
            const timestamp = new Date().toISOString();
            const formattedDate = new Date().toLocaleString('zh-CN');
            
            const historyItem = {
                id: `history_${Date.now()}`,
                timestamp: timestamp,
                formattedDate: formattedDate,
                lastWeekPlan: inputData.lastWeekPlan,
                lastWeekWork: inputData.lastWeekWork,
                nextWeekPlan: inputData.nextWeekPlan,
                additionalNotes: inputData.additionalNotes,
                result: result,
                isJsonResult: processedResult && processedResult.isJson === true,
                jsonData: processedResult && processedResult.isJson ? processedResult.jsonData : null
            };
            
            // 将新记录添加到历史记录开头
            this.history.unshift(historyItem);
            
            // 限制历史记录数量，保留最新的100条
            if (this.history.length > 100) {
                this.history = this.history.slice(0, 100);
            }
            
            // 保存到本地存储
            this.saveHistory();
            
            // 重新渲染历史表格
            this.renderHistoryTable();
        } catch (error) {
            console.error('添加历史记录失败：', error);
        }
    }
    
    // 渲染历史记录表格
    renderHistoryTable() {
        const tableBody = document.getElementById('historyTableBody');
        if (!tableBody) return;
        
        // 清空表格
        tableBody.innerHTML = '';
        
        // 没有历史记录
        if (this.history.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="5" style="text-align: center;">暂无历史记录</td>`;
            tableBody.appendChild(row);
            return;
        }
        
        // 填充历史记录
        this.history.forEach((item) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.formattedDate}</td>
                <td>${this.getSummary(item.lastWeekPlan)}</td>
                <td>${this.getSummary(item.lastWeekWork)}</td>
                <td>${this.getSummary(item.nextWeekPlan)}</td>
                <td>
                    <button class="history-action-btn" data-id="${item.id}">查看</button>
                </td>
            `;
            
            // 绑定查看按钮事件
            const viewBtn = row.querySelector('.history-action-btn');
            viewBtn.addEventListener('click', () => this.showHistoryDetail(item.id));
            
            tableBody.appendChild(row);
        });
    }
    
    // 显示历史记录详情
    showHistoryDetail(id) {
        const item = this.history.find(h => h.id === id);
        if (!item) return;
        
        const modalContent = document.getElementById('historyDetailContent');
        if (!modalContent) return;
        
        // 生成结果内容
        let resultContent;
        
        if (item.isJsonResult && this.contentProcessor) {
            // 如果是JSON结果，使用JSON格式化
            if (item.jsonData) {
                resultContent = this.contentProcessor.formatJsonReport(item.jsonData);
            } else {
                // 尝试重新解析
                const parsed = this.contentProcessor.tryParseJson(item.result);
                if (parsed) {
                    resultContent = this.contentProcessor.formatJsonReport(parsed);
                } else {
                    resultContent = this.contentProcessor.processContent(item.result).formatted;
                }
            }
        } else if (this.contentProcessor) {
            // 普通文本结果
            resultContent = this.contentProcessor.processContent(item.result).formatted;
        } else {
            // 没有处理器，直接显示
            resultContent = `<pre>${item.result}</pre>`;
        }
        
        // 转义原始输出用于显示
        const escapeHtml = (text) => {
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };
        
        // 生成详情HTML
        const detailHtml = `
            <div class="history-detail">
                <div class="history-detail-header">
                    <h4>生成时间: ${item.formattedDate}</h4>
                    ${item.isJsonResult ? '<span class="json-badge">JSON</span>' : ''}
                </div>
                <div class="history-detail-inputs">
                    <div class="detail-section">
                        <h5>上周工作计划:</h5>
                        <pre>${item.lastWeekPlan}</pre>
                    </div>
                    <div class="detail-section">
                        <h5>上周工作内容:</h5>
                        <pre>${item.lastWeekWork}</pre>
                    </div>
                    <div class="detail-section">
                        <h5>下周工作计划:</h5>
                        <pre>${item.nextWeekPlan}</pre>
                    </div>
                    <div class="detail-section">
                        <h5>额外说明:</h5>
                        <pre>${item.additionalNotes || '无'}</pre>
                    </div>
                </div>
                <div class="detail-section">
                    <h5>生成结果:</h5>
                    <div class="history-result">
                        ${resultContent}
                    </div>
                </div>
                <div class="detail-section">
                    <h5>原始输出:</h5>
                    <div class="raw-output-container">
                        <pre class="raw-output-code">${escapeHtml(item.result)}</pre>
                        <button class="btn btn-small btn-copy-raw" data-content="${escapeHtml(item.result)}">复制</button>
                    </div>
                </div>
                <div class="detail-actions">
                    <button id="useHistoryData" class="btn btn-primary" data-id="${item.id}">使用此数据</button>
                    <button id="removeHistoryItem" class="btn btn-danger" data-id="${item.id}">删除记录</button>
                </div>
            </div>
        `;
        
        modalContent.innerHTML = detailHtml;
        
        // 绑定操作按钮事件
        const useBtn = document.getElementById('useHistoryData');
        if (useBtn) {
            useBtn.addEventListener('click', () => this.useHistoryData(id));
        }
        
        const removeBtn = document.getElementById('removeHistoryItem');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => this.removeHistoryItem(id));
        }
        
        // 绑定原始输出复制按钮
        const copyRawBtn = modalContent.querySelector('.btn-copy-raw');
        if (copyRawBtn) {
            copyRawBtn.addEventListener('click', (e) => {
                const content = e.target.getAttribute('data-content');
                this.copyToClipboard(content, '原始输出已复制到剪贴板');
            });
        }
        
        // 显示模态框
        const modal = document.getElementById('historyDetailModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }
    
    // 关闭历史记录详情
    closeHistoryDetail() {
        const modal = document.getElementById('historyDetailModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    // 使用历史数据
    useHistoryData(id) {
        const item = this.history.find(h => h.id === id);
        if (!item) return;
        
        // 填充表单
        document.getElementById('lastWeekPlan').value = item.lastWeekPlan || '';
        document.getElementById('lastWeekWork').value = item.lastWeekWork || '';
        document.getElementById('nextWeekPlan').value = item.nextWeekPlan || '';
        document.getElementById('additionalNotes').value = item.additionalNotes || '';
        
        // 关闭详情
        this.closeHistoryDetail();
        
        // 显示成功消息
        this.showSuccess('已加载历史数据');
    }
    
    // 删除历史记录
    removeHistoryItem(id) {
        if (confirm('确定要删除此历史记录吗？')) {
            const index = this.history.findIndex(h => h.id === id);
            if (index !== -1) {
                // 删除记录
                this.history.splice(index, 1);
                
                // 保存到本地存储
                this.saveHistory();
                
                // 重新渲染表格
                this.renderHistoryTable();
                
                // 关闭详情
                this.closeHistoryDetail();
                
                // 显示成功消息
                this.showSuccess('历史记录已删除');
            }
        }
    }
    
    // 清空所有历史记录
    clearHistory() {
        if (confirm('确定要清空所有历史记录吗？此操作无法撤销！')) {
            this.history = [];
            this.saveHistory();
            this.renderHistoryTable();
            this.showSuccess('所有历史记录已清空');
        }
    }
    
    // 导出历史记录
    exportHistory() {
        try {
            const exportData = {
                exportDate: new Date().toISOString(),
                history: this.history
            };
            
            const jsonString = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `周报生成历史记录_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showSuccess('历史记录已导出');
        } catch (error) {
            console.error('导出历史记录失败：', error);
            this.showError('导出历史记录失败');
        }
    }
}

// 初始化应用
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        new WeeklyReporter();
    });
}
