/**
 * 结果处理服务
 * 用于处理 API 返回结果，提取 JSON 数据和表格数据
 */

/**
 * 从文本内容中提取 JSON
 * 处理纯 JSON 和 Markdown 代码块中的 JSON
 * @param {string} text - 输入文本
 * @returns {object|null} 解析后的 JSON 对象或 null
 */
export function extractJsonFromText(text) {
  if (!text) return null;
  
  try {
    // 尝试直接解析 JSON
    return JSON.parse(text);
  } catch (e) {
    // 如果不是直接 JSON，尝试从 Markdown 代码块中提取
    const jsonBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/g;
    const matches = [...text.matchAll(jsonBlockRegex)];
    
    if (matches.length > 0) {
      // 尝试每个代码块
      for (const match of matches) {
        try {
          return JSON.parse(match[1].trim());
        } catch (err) {
          continue;
        }
      }
    }
    
    // 尝试查找无代码块的 JSON 类似内容
    const jsonPattern = /(\[[\s\S]*\]|\{[\s\S]*\})/;
    const jsonMatch = text.match(jsonPattern);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (err) {
        // 不是有效的 JSON
      }
    }
  }
  
  return null;
}

/**
 * 将工作项目数组转换为表格数据格式
 * @param {Array} workItems - 工作项目数组
 * @param {string} category - 工作类别（如"上周工作计划"、"上周工作内容"等）
 * @returns {Array} 格式化的表格数据
 */
function formatWorkItemsToTable(workItems, category) {
  if (!Array.isArray(workItems)) return [];
  
  return workItems.map(item => ({
    category, // 添加类别标识
    project: item['所属项目'] || item.project || item.所属项目 || '',
    task: item['工作项'] || item.task || item.工作项 || '',
    description: item['工作内容及进度说明'] || item.description || item.工作内容及进度说明 || ''
  }));
}

/**
 * 处理结果并提取表格数据（如果可用）
 * @param {string} result - API 返回的结果文本
 * @returns {object} 包含内容和表格数据的对象
 */
export function processResult(result) {
  let resultContent = result;
  let hasTableData = false;
  let resultTableData = [];
  
  // 尝试提取 JSON
  const jsonData = extractJsonFromText(result);
  
  if (jsonData) {
    // 检查是否为包含工作计划、工作内容等字段的对象
    const hasWorkData = jsonData.hasOwnProperty('上周工作计划') || 
                        jsonData.hasOwnProperty('上周工作内容') || 
                        jsonData.hasOwnProperty('本周工作总结') || 
                        jsonData.hasOwnProperty('下周工作计划');
    
    if (hasWorkData) {
      // 处理工作数据
      resultTableData = [];
      
      // 处理上周工作计划
      if (Array.isArray(jsonData['上周工作计划'])) {
        resultTableData.push(...formatWorkItemsToTable(jsonData['上周工作计划'], '上周工作计划'));
      }
      
      // 处理上周工作内容
      if (Array.isArray(jsonData['上周工作内容'])) {
        resultTableData.push(...formatWorkItemsToTable(jsonData['上周工作内容'], '上周工作内容'));
      }
      
      // 处理下周工作计划
      if (Array.isArray(jsonData['下周工作计划'])) {
        resultTableData.push(...formatWorkItemsToTable(jsonData['下周工作计划'], '下周工作计划'));
      }
      
      // 如果有表格数据，将原始 JSON 作为内容
      if (resultTableData.length > 0) {
        hasTableData = true;
        // 将原始 JSON 数据转换为字符串作为内容
        resultContent = JSON.stringify(jsonData, null, 2);
      } else {
        // 如果没有表格数据，保持原始内容
        resultContent = result;
      }
    } else {
      // 如果不是工作数据结构，检查是否为其他类型的数组或对象
      if (Array.isArray(jsonData) && jsonData.length > 0 && typeof jsonData[0] === 'object') {
        resultTableData = jsonData;
        hasTableData = true;
        resultContent = JSON.stringify(jsonData, null, 2);
      } else {
        // 其他情况，保持原始内容
        resultContent = result;
      }
    }
  }
  
  return {
    resultContent,
    hasTableData,
    resultTableData
  };
}