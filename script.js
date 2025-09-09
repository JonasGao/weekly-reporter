// 智能周报生成工具主要功能脚本

class WeeklyReporter {
    constructor() {
        this.config = {
            apiUrl: '',
            apiKey: ''
        };
        this.contentProcessor = new AiContentProcessor();
        this.init();
    }

    init() {
        this.loadConfig();
        this.bindEvents();
        this.loadSavedData();
    }

    // 绑定事件监听器
    bindEvents() {
        try {
            // 配置相关
            const saveConfigBtn = document.getElementById('saveConfig');
            if (saveConfigBtn) {
                saveConfigBtn.addEventListener('click', () => this.saveConfig());
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
        } catch (error) {
            console.error('绑定事件时出错:', error);
        }
    }

    // 配置管理
    loadConfig() {
        const savedConfig = localStorage.getItem('weeklyReporter_config');
        if (savedConfig) {
            this.config = JSON.parse(savedConfig);
            document.getElementById('difyApiUrl').value = this.config.apiUrl || '';
            document.getElementById('difyApiKey').value = this.config.apiKey || '';
        }
    }

    saveConfig() {
        const apiUrl = document.getElementById('difyApiUrl').value.trim();
        const apiKey = document.getElementById('difyApiKey').value.trim();
        
        if (!apiUrl || !apiKey) {
            this.showError('请填写完整的 API 配置信息');
            return;
        }

        this.config = { apiUrl, apiKey };
        localStorage.setItem('weeklyReporter_config', JSON.stringify(this.config));
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
            // 检查配置
            if (!this.config.apiUrl || !this.config.apiKey) {
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

        const response = await fetch(this.config.apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
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
            
            // 使用内容处理器格式化结果
            if (this.contentProcessor) {
                const processed = this.contentProcessor.processContent(result);
                resultContentElement.innerHTML = processed.formatted;
            } else {
                // 备用处理
                const formattedResult = this.formatResult(cleanedResult);
                resultContentElement.innerHTML = formattedResult;
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

    // 复制周报
    async copyReport() {
        try {
            const resultContentElement = document.getElementById('resultContent');
            if (!resultContentElement) {
                throw new Error('找不到结果内容容器元素，ID: resultContent');
            }
            
            const content = resultContentElement.innerText;
            await navigator.clipboard.writeText(content);
            this.showSuccess('周报内容已复制到剪贴板');
        } catch (error) {
            console.error('复制失败：', error);
            this.showError('复制失败，请手动选择复制');
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
}

// 初始化应用
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        new WeeklyReporter();
    });
}
