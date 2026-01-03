/**
 * 钉钉周报API客户端
 */
class DingTalkClient {
    constructor(config) {
        if (!config || !config.corpId || !config.appKey || !config.appSecret) {
            throw new Error('钉钉配置信息不完整');
        }
        
        this.corpId = config.corpId;
        this.appKey = config.appKey;
        this.appSecret = config.appSecret;
        this.accessToken = null;
        this.tokenExpireTime = 0;
    }
    
    /**
     * 获取访问令牌
     * @returns {Promise<string>} 访问令牌
     */
    async getAccessToken() {
        // 如果令牌未过期，直接返回
        const now = Date.now();
        if (this.accessToken && now < this.tokenExpireTime) {
            return this.accessToken;
        }
        
        // 请求新的访问令牌
        const url = `https://oapi.dingtalk.com/gettoken?appkey=${this.appKey}&appsecret=${this.appSecret}`;
        
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`获取钉钉访问令牌失败 (${response.status}): ${errorText}`);
            }
            
            const data = await response.json();
            
            if (data.errcode !== 0) {
                throw new Error(`获取钉钉访问令牌失败: ${data.errmsg}`);
            }
            
            // 设置令牌和过期时间 (提前5分钟过期以确保安全)
            this.accessToken = data.access_token;
            this.tokenExpireTime = now + (data.expires_in - 300) * 1000;
            
            return this.accessToken;
        } catch (error) {
            console.error('获取钉钉访问令牌失败:', error);
            throw new Error(`获取钉钉访问令牌失败: ${error.message}`);
        }
    }
    
    /**
     * 发送工作总结
     * @param {string} userId 用户ID
     * @param {Object} content 工作总结内容
     * @returns {Promise<Object>} API响应结果
     */
    async sendWorkReport(userId, content) {
        if (!userId) {
            throw new Error('请提供用户ID');
        }
        
        try {
            // 获取访问令牌
            const accessToken = await this.getAccessToken();
            
            // 调用钉钉API创建工作总结
            const url = `https://oapi.dingtalk.com/topapi/report/create?access_token=${accessToken}`;
            
            const today = new Date();
            const formattedDate = today.toISOString().split('T')[0];
            
            // 准备请求数据
            const requestBody = {
                userid: userId,
                create_time: today.getTime(),
                template_name: "周报",
                contents: [
                    {
                        content_type: "markdown",
                        title: "上周工作回顾",
                        content: content.lastWeekSummary || "无"
                    },
                    {
                        content_type: "markdown",
                        title: "本周工作总结",
                        content: content.thisWeekSummary || "无"
                    },
                    {
                        content_type: "markdown",
                        title: "下周工作计划",
                        content: content.nextWeekPlan || "无"
                    },
                    {
                        content_type: "markdown",
                        title: "备注",
                        content: content.notes || "无"
                    }
                ]
            };
            
            // 发送请求
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`发送钉钉工作总结失败 (${response.status}): ${errorText}`);
            }
            
            const data = await response.json();
            
            if (data.errcode !== 0) {
                throw new Error(`发送钉钉工作总结失败: ${data.errmsg}`);
            }
            
            return data;
        } catch (error) {
            console.error('发送钉钉工作总结失败:', error);
            throw new Error(`发送钉钉工作总结失败: ${error.message}`);
        }
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DingTalkClient;
}
