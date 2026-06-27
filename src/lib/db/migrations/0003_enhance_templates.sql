-- SQLite不支持直接DROP COLUMN，需重建表

-- Step 1: 创建新schema表
CREATE TABLE templates_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  description TEXT,
  tags TEXT,
  source_template_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Step 2: 迁移用户模板数据（排除旧默认模板）
INSERT INTO templates_new 
  SELECT id, name, content, NULL, NULL, NULL, created_at, updated_at 
  FROM templates 
  WHERE is_default = 0;

-- Step 3: 删除旧表，重命名新表
DROP TABLE templates;
ALTER TABLE templates_new RENAME TO templates;