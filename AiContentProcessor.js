// AI内容处理器 - 独立模块
// 负责处理think内容移除、内容格式化、表格转换等功能

class AiContentProcessor {
    constructor() {
        // 可以在这里添加配置选项
    }

    // 移除 think 部分内容
    removeThinkContent(content) {
        if (!content) return '';
        
        // 处理多种可能的 think 标记格式
        const thinkPatterns = [
            // XML 标签格式: <think>...</think>
            /<think>[\s\S]*?<\/think>/gi,
            // 双花括号格式: {{think}}...{{/think}}
            /\{\{think\}\}[\s\S]*?\{\{\/think\}\}/gi,
            // 方括号格式: [think]...[/think]
            /\[think\][\s\S]*?\[\/think\]/gi,
            // Markdown 代码块格式: ```think...```
            /```think[\s\S]*?```/gi,
            // 简单标记格式: <think>...</think> (不区分大小写)
            /<THINK>[\s\S]*?<\/THINK>/gi
        ];
        
        let cleanedContent = content;
        
        // 逐个应用所有模式进行清理
        thinkPatterns.forEach(pattern => {
            cleanedContent = cleanedContent.replace(pattern, '');
        });
        
        // 移除多余的空白行
        cleanedContent = cleanedContent
            .replace(/\n\s*\n\s*\n/g, '\n\n') // 将多个连续空行合并为两个空行
            .replace(/^\s+|\s+$/g, ''); // 移除开头和结尾的空白
        
        return cleanedContent;
    }

    // 格式化结果（简化版：只做基本的文本清理，不解析markdown）
    formatResult(result) {
        if (!result) return '';
        
        // 先处理转义的换行符，将 \n 字符串转换为真正的换行符
        let formatted = result.replace(/\\n/g, '\n');
        
        // 然后处理其他换行符格式，确保正确的行分隔
        formatted = formatted
            .replace(/\r\n/g, '\n') // 统一换行符格式
            .replace(/\r/g, '\n');   // 处理可能的 \r
        
        // 直接将换行符转换为HTML换行，不进行markdown解析
        formatted = formatted
            .split('\n')
            .map(line => line.trim())
            .filter(line => line !== '') // 移除空行
            .join('<br>')
            .replace(/(<br>){3,}/g, '<br><br>'); // 限制最多两个连续的<br>
        
        return `<div style="line-height: 1.6; white-space: pre-wrap;">${formatted}</div>`;
    }

    // 尝试解析JSON内容
    tryParseJson(content) {
        if (!content) return null;
        
        try {
            // 先清理内容，移除think部分
            const cleaned = this.removeThinkContent(content);
            
            // 尝试解析JSON
            return JSON.parse(cleaned);
        } catch (error) {
            console.log('内容不是有效的JSON格式，将使用普通文本处理', error);
            return null;
        }
    }
    
    // 格式化JSON报告
    formatJsonReport(jsonData) {
        if (!jsonData) return '';
        
        const sections = [];
        
        // 本周工作内容
        if (jsonData.current_week_summary) {
            sections.push(`
                <div class="report-section">
                    <h3>📝 本周工作内容</h3>
                    ${this.formatTableOrText(jsonData.current_week_summary)}
                </div>
            `);
        }
        
        // 下周工作计划
        if (jsonData.next_week_plan) {
            sections.push(`
                <div class="report-section">
                    <h3>📅 下周工作计划</h3>
                    ${this.formatTableOrText(jsonData.next_week_plan)}
                </div>
            `);
        }
        
        // 本周工作总结
        if (jsonData.work_summary) {
            sections.push(`
                <div class="report-section">
                    <h3>📊 本周工作总结</h3>
                    ${this.formatTableOrText(jsonData.work_summary, true)}
                </div>
            `);
        }
        
        // 额外说明（如果有）
        if (jsonData.additional_notes) {
            sections.push(`
                <div class="report-section">
                    <h3>💡 额外说明</h3>
                    ${this.formatTableOrText(jsonData.additional_notes, true)}
                </div>
            `);
        }
        
        return `<div class="json-report">${sections.join('')}</div>`;
    }
    
    // 格式化表格或文本
    formatTableOrText(content, preferParagraph = false) {
        // 如果是字符串，直接返回格式化的段落
        if (typeof content === 'string') {
            return `<p>${content.replace(/\n/g, '<br>')}</p>`;
        }
        
        // 如果是数组但需要段落显示
        if (Array.isArray(content) && preferParagraph) {
            return content.map(item => `<p>${typeof item === 'string' ? item : JSON.stringify(item)}</p>`).join('');
        }
        
        // 如果是数组，尝试渲染为表格
        if (Array.isArray(content) && content.length > 0) {
            // 检查是否是对象数组
            if (typeof content[0] === 'object' && content[0] !== null) {
                const headers = Object.keys(content[0]);
                
                return `
                    <table class="report-table">
                        <thead>
                            <tr>
                                ${headers.map(h => `<th>${h}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${content.map(row => `
                                <tr>
                                    ${headers.map(key => {
                                        const cellValue = row[key];
                                        return `<td>${typeof cellValue === 'string' ? cellValue : JSON.stringify(cellValue)}</td>`;
                                    }).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            } else {
                // 普通数组，显示为列表
                return `
                    <ul>
                        ${content.map(item => `<li>${typeof item === 'string' ? item : JSON.stringify(item)}</li>`).join('')}
                    </ul>
                `;
            }
        }
        
        // 对于其他复杂对象，显示为代码块
        return `<pre class="code-block">${JSON.stringify(content, null, 2)}</pre>`;
    }

    // 完整处理流程（便捷方法）
    processContent(content) {
        // 1. 移除think内容
        const cleanedContent = this.removeThinkContent(content);
        
        // 2. 尝试解析JSON
        const jsonData = this.tryParseJson(content);
        
        let formatted;
        if (jsonData) {
            // 如果成功解析为JSON，使用JSON格式化
            formatted = this.formatJsonReport(jsonData);
        } else {
            // 否则使用普通文本格式化
            formatted = this.formatResult(cleanedContent);
        }
        
        return {
            original: content,
            cleaned: cleanedContent,
            isJson: !!jsonData,
            jsonData: jsonData,
            formatted: formatted
        };
    }
}

// 浏览器环境支持
if (typeof window !== 'undefined') {
    window.AiContentProcessor = AiContentProcessor;
}
