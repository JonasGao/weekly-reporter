# Tag Dual Storage: Keep #tag Text in Content and Maintain a Separate Association Table

标签同时以两种形式存储：`#tagname` 文本原样保留在事件内容字段中，同时在独立的关联表中维护 tag 与事件的映射关系。之所以不选"仅解析内容"方案，是因为每次筛选都全表扫描正文代价过高；之所以不选"仅存关联表、内容中去掉 tag 文本"，是因为 tag 是用户写作习惯的一部分，从内容中消失会破坏原文语义。删除或重命名 tag 时，需要同时更新内容文本和关联表，保持两者一致。
