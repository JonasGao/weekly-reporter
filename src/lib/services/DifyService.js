/**
 * Dify API 服务
 * 用于与 Dify 平台进行通信，生成周报
 */

/**
 * 调用 Dify API 生成周报
 * @param {Object} inputData - 输入数据，包含上周计划、工作内容、下周计划等
 * @param {Object} config - Dify 配置，包含 API URL 和 API Key
 * @returns {Promise<string>} 生成的周报内容
 */
export async function generateReportWithDify(inputData, config) {
  // 验证输入数据
  const errors = [];
  if (!inputData.lastWeekPlan) errors.push('上周工作计划');
  if (!inputData.lastWeekWork) errors.push('上周工作内容');
  if (!inputData.nextWeekPlan) errors.push('下周工作计划');
  
  if (errors.length > 0) {
    throw new Error(`请填写以下必需信息：${errors.join('、')}`);
  }

  // 验证配置
  if (!config || !config.apiUrl || !config.apiKey) {
    throw new Error('Dify API 配置不完整');
  }

  // 构建请求体
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

  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
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
  } catch (error) {
    console.error('调用 Dify API 失败：', error);
    throw error;
  }
}