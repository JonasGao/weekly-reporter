export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat',     // 新功能
      'fix',      // 修复 bug
      'docs',     // 文档变更
      'style',    // 代码格式（不影响逻辑）
      'refactor', // 重构
      'perf',     // 性能优化
      'test',     // 测试
      'build',    // 构建/依赖
      'ci',       // CI 配置
      'chore',    // 其他杂项
      'revert',   // 回滚
    ]],
    'subject-case': [0],
    'header-max-length': [2, 'always', 100],
  },
}
