import { getDb, schema } from './db'
import { eq } from 'drizzle-orm'
import type { NewSentenceSnippet } from './db/schema'

/**
 * Built-in snippets for achievement category (成果)
 */
const achievementSnippets: Omit<NewSentenceSnippet, 'createdAt' | 'updatedAt'>[] = [
  { content: '完成了核心功能的开发工作，系统稳定性显著提升', category: '成果', isBuiltIn: true },
  { content: '优化了系统性能，响应时间降低了30%', category: '成果', isBuiltIn: true },
  { content: '解决了生产环境中的关键bug，保障了业务连续性', category: '成果', isBuiltIn: true },
  { content: '完成了技术方案评审，制定了详细实施计划', category: '成果', isBuiltIn: true },
  { content: '推动了跨部门协作，建立了良好的沟通机制', category: '成果', isBuiltIn: true },
  { content: '完成了代码重构，提高了代码可维护性', category: '成果', isBuiltIn: true },
  { content: '编写了详细的技术文档，便于团队知识传承', category: '成果', isBuiltIn: true },
  { content: '参与了需求评审，提供了技术可行性分析', category: '成果', isBuiltIn: true },
  { content: '完成了单元测试覆盖率提升，增强了系统质量', category: '成果', isBuiltIn: true },
  { content: '推动了CI/CD流程优化，提高了发布效率', category: '成果', isBuiltIn: true },
]

/**
 * Built-in snippets for problem category (问题)
 */
const problemSnippets: Omit<NewSentenceSnippet, 'createdAt' | 'updatedAt'>[] = [
  { content: '遇到技术难点，需要进一步调研解决方案', category: '问题', isBuiltIn: true },
  { content: '项目进度略有延迟，主要原因是需求变更频繁', category: '问题', isBuiltIn: true },
  { content: '团队协作中存在沟通不畅的情况，已制定改进措施', category: '问题', isBuiltIn: true },
  { content: '部分功能性能不够理想，计划进行专项优化', category: '问题', isBuiltIn: true },
  { content: '测试环境资源不足，影响了测试进度', category: '问题', isBuiltIn: true },
  { content: '第三方依赖库版本兼容性问题需要解决', category: '问题', isBuiltIn: true },
  { content: '生产环境出现偶发性异常，正在排查根因', category: '问题', isBuiltIn: true },
  { content: '需求理解存在偏差，需要与产品确认细节', category: '问题', isBuiltIn: true },
]

/**
 * Built-in snippets for plan category (计划)
 */
const planSnippets: Omit<NewSentenceSnippet, 'createdAt' | 'updatedAt'>[] = [
  { content: '下周计划完成剩余功能的开发工作', category: '计划', isBuiltIn: true },
  { content: '计划进行系统性能测试，确保满足上线标准', category: '计划', isBuiltIn: true },
  { content: '将组织团队进行技术分享，提升团队技术能力', category: '计划', isBuiltIn: true },
  { content: '计划完成用户文档编写，便于产品交付', category: '计划', isBuiltIn: true },
  { content: '将协调资源解决当前遇到的技术问题', category: '计划', isBuiltIn: true },
  { content: '计划对系统进行全面测试，确保质量达标', category: '计划', isBuiltIn: true },
]

/**
 * Built-in snippets for quantification category (量化)
 */
const quantificationSnippets: Omit<NewSentenceSnippet, 'createdAt' | 'updatedAt'>[] = [
  { content: '完成代码提交35次，新增代码行数约2000行', category: '量化', isBuiltIn: true },
  { content: '处理并解决了12个线上问题', category: '量化', isBuiltIn: true },
  { content: '参与代码评审15次，提出改进建议23条', category: '量化', isBuiltIn: true },
  { content: '编写技术文档5篇，共计约5000字', category: '量化', isBuiltIn: true },
  { content: '参加项目会议8次，完成需求评审3次', category: '量化', isBuiltIn: true },
  { content: '单元测试覆盖率从65%提升至78%', category: '量化', isBuiltIn: true },
]

/**
 * Initialize built-in snippets if they don't exist in the database
 * 
 * This function checks if the sentence_snippets table is empty,
 * and if so, inserts all built-in snippets. This ensures that
 * the application always has default snippets available for users.
 */
export async function initializeSnippets(): Promise<void> {
  const db = getDb()
  const now = new Date()
  
  try {
    // Check if there are any built-in snippets already
    const existingBuiltIn = await db
      .select()
      .from(schema.sentenceSnippets)
      .where(eq(schema.sentenceSnippets.isBuiltIn, true))
    
    // If built-in snippets already exist, skip initialization
    if (existingBuiltIn.length > 0) {
      console.log('Built-in snippets already exist, skipping initialization')
      return
    }
    
    // Combine all snippets
    const allSnippets: Omit<NewSentenceSnippet, 'createdAt' | 'updatedAt'>[] = [
      ...achievementSnippets,
      ...problemSnippets,
      ...planSnippets,
      ...quantificationSnippets,
    ]
    
    // Insert all snippets with timestamps
    await db.insert(schema.sentenceSnippets).values(
      allSnippets.map(snippet => ({
        ...snippet,
        createdAt: now,
        updatedAt: now,
      }))
    )
    
    console.log(`Successfully initialized ${allSnippets.length} built-in snippets`)
  } catch (error) {
    console.error('Error initializing snippets:', error)
    throw error
  }
}