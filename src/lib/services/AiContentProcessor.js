// AI内容处理器 - 增强版
// 负责处理think内容移除、内容格式化、表格转换等功能
// 新增：支持从markdown代码块中解析JSON内容

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
        const multipleNewlines = /\n\s*\n\s*\n/g;
        const leadingTrailingWhitespace = /^\s+|\s+$/g;
        
        cleanedContent = cleanedContent
            .replace(multipleNewlines, '\n\n')
            .replace(leadingTrailingWhitespace, '');
        
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

    // 从markdown代码块中提取JSON内容
    extractJsonFromMarkdown(content) {
        if (!content) return null;
        
        // 匹配 ```json...``` 代码块
        const jsonBlockPattern = /```json\s*([\s\S]*?)```/gi;
        const matches = [...content.matchAll(jsonBlockPattern)];
        
        if (matches.length === 0) {
            return null;
        }
        
        // 使用第一个有效的JSON代码块
        for (const match of matches) {
            const jsonContent = match[1].trim();
            if (jsonContent) {
                try {
                    // 验证JSON有效性
                    JSON.parse(jsonContent);
                    return jsonContent;
                } catch (error) {
                    console.log('跳过无效的JSON代码块:', error.message);
                    continue;
                }
            }
        }
        
        return null;
    }
    
    // 验证JSON结构是否符合周报格式
    validateJsonStructure(jsonData) {
        if (!jsonData || typeof jsonData !== 'object') {
            return false;
        }
        
        // 检查是否包含周报必要字段
        const expectedFields = [
            'last_week_plan_table',
            'last_week_actual_table', 
            'next_week_plan_table',
            'summary'
        ];
        
        // 至少需要包含一个必要字段
        return expectedFields.some(field => field in jsonData);
    }
    
    // 解析提取的JSON内容
    parseExtractedJson(jsonString) {
        if (!jsonString) return null;
        
        try {
            const parsed = JSON.parse(jsonString);
            
            // 验证结构
            if (this.validateJsonStructure(parsed)) {
                return parsed;
            } else {
                console.log('JSON结构不符合周报格式，使用普通文本处理');
                return null;
            }
        } catch (error) {
            console.log('JSON解析失败:', error.message);
            return null;
        }
    }
    
    // 处理解析失败的回退逻辑
    handleParsingFallback(content) {
        // 尝试直接JSON解析（向后兼容）
        try {
            const parsed = JSON.parse(content);
            if (this.validateJsonStructure(parsed)) {
                return parsed;
            }
        } catch (error) {
            // 忽略直接解析失败，继续使用文本格式
        }
        
        return null;
    }

    // 尝试解析JSON内容（增强版）
    tryParseJson(content) {
        if (!content) return null;
        
        // 先清理内容，移除think部分（强制第一步）
        const cleaned = this.removeThinkContent(content);
        
        // 1. 首先尝试从markdown代码块中提取JSON
        const extractedJson = this.extractJsonFromMarkdown(cleaned);
        if (extractedJson) {
            const parsed = this.parseExtractedJson(extractedJson);
            if (parsed) {
                return {
                    data: parsed,
                    source: 'markdown',
                    extractedContent: extractedJson
                };
            }
        }
        
        // 2. 回退到直接JSON解析（向后兼容）
        const fallbackResult = this.handleParsingFallback(cleaned);
        if (fallbackResult) {
            return {
                data: fallbackResult,
                source: 'direct',
                extractedContent: cleaned
            };
        }
        
        console.log('内容不是有效的JSON格式，将使用普通文本处理');
        return null;
    }
    
    // 格式化JSON报告
    formatJsonReport(jsonData) {
        if (!jsonData) return '';
        
        const sections = [];
        
        // 上周工作计划
        if (jsonData.last_week_plan_table) {
            sections.push(`
                <div class="report-section">
                    <h3>📋 上周工作计划</h3>
                    ${this.formatTableOrText(jsonData.last_week_plan_table)}
                </div>
            `);
        }
        
        // 上周工作实际内容
        if (jsonData.last_week_actual_table) {
            sections.push(`
                <div class="report-section">
                    <h3>✅ 上周工作内容</h3>
                    ${this.formatTableOrText(jsonData.last_week_actual_table)}
                </div>
            `);
        }
        
        // 下周工作计划
        if (jsonData.next_week_plan_table) {
            sections.push(`
                <div class="report-section">
                    <h3>🚀 下周工作计划</h3>
                    ${this.formatTableOrText(jsonData.next_week_plan_table)}
                </div>
            `);
        }
        
        // 工作总结
        if (jsonData.summary) {
            sections.push(`
                <div class="report-section">
                    <h3>📝 工作总结</h3>
                    ${this.formatTableOrText(jsonData.summary, true)}
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
        // 1. 强制第一步：移除think内容
        const cleanedContent = this.removeThinkContent(content);
        
        // 2. 尝试解析JSON（现在支持markdown格式）
        const jsonResult = this.tryParseJson(content);
        
        let formatted;
        let parsingMetadata = {
            thinkContentRemoved: content !== cleanedContent,
            originalLength: content ? content.length : 0,
            cleanedLength: cleanedContent ? cleanedContent.length : 0,
            parsingMethod: 'none',
            parsingSuccess: false
        };
        
        if (jsonResult && jsonResult.data) {
            // 如果成功解析为JSON，使用JSON格式化
            formatted = this.formatJsonReport(jsonResult.data);
            parsingMetadata.parsingMethod = jsonResult.source; // 'markdown' or 'direct'
            parsingMetadata.parsingSuccess = true;
            parsingMetadata.extractedContent = jsonResult.extractedContent;
            
            return {
                original: content,
                cleaned: cleanedContent,
                isJson: true,
                jsonData: jsonResult.data,
                formatted: formatted,
                metadata: parsingMetadata
            };
        } else {
            // 否则使用普通文本格式化
            formatted = this.formatResult(cleanedContent);
            parsingMetadata.parsingMethod = 'text';
            
            return {
                original: content,
                cleaned: cleanedContent,
                isJson: false,
                jsonData: null,
                formatted: formatted,
                metadata: parsingMetadata
            };
        }
    }
}

// 浏览器环境支持
if (typeof window !== 'undefined') {
    window.AiContentProcessor = AiContentProcessor;
}