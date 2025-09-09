// Markdown处理器 - 独立模块
// 负责处理think内容移除、markdown格式化、表格转换等功能

class MarkdownProcessor {
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

    // 完整处理流程（便捷方法）
    processContent(content) {
        // 1. 移除think内容
        const cleanedContent = this.removeThinkContent(content);
        
        // 2. 简单的文本格式化（不解析markdown）
        const formattedResult = this.formatResult(cleanedContent);
        
        return {
            original: content,
            cleaned: cleanedContent,
            formatted: formattedResult
        };
    }
}

// 浏览器环境支持
if (typeof window !== 'undefined') {
    window.MarkdownProcessor = MarkdownProcessor;
}
