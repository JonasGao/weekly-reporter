<script>
  import { processResult } from '../services/ResultProcessService.js';

  export let rawData = '';

  // 处理传入的数据，使用 ResultProcessService 进行数据处理
  $: processedResult = processResult(rawData);
  $: tableData = processedResult.resultTableData;
  $: weeklySummary = processedResult.weeklySummary; // 获取工作总结
  $: hasTableData = processedResult.hasTableData;

  // 按类别分组数据
  $: groupedData = () => {
    if (!tableData || tableData.length === 0) return {};
    
    const grouped = {};
    for (const item of tableData) {
      const category = item.category || '未分类';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    }
    return grouped;
  };

  // 获取所有类别
  $: categories = Object.keys(groupedData());

  // 获取列名，排除类别列，否则使用原始数据
  $: columns = () => {
    if (tableData.length > 0) {
      const allCols = Object.keys(tableData[0]);
      // 排除 'category' 列，因为它将作为表格标题
      return allCols.filter(col => col !== 'category');
    }
    return [];
  };

  // 定义列标题映射，将中文列名转换为更友好的显示文本
  const columnHeaders = {
    'project': '所属项目',
    'task': '工作项',
    'description': '工作内容及进度说明'
  };

  // 获取列标题
  $: headers = () => columns().map(col => columnHeaders[col] || col);
  
  // 复制表格内容到剪贴板
  function copyTableToClipboard(category) {
    const categoryData = groupedData()[category];
    if (!categoryData || categoryData.length === 0) return;
    
    // 创建制表符分隔的表格数据
    let tableText = '';
    
    // 添加表头
    const headersArray = headers();
    tableText += headersArray.join('\t') + '\n';
    
    // 添加数据行
    for (const row of categoryData) {
      const rowText = columns().map(col => row[col] || '').join('\t');
      tableText += rowText + '\n';
    }
    
    // 复制到剪贴板
    navigator.clipboard.writeText(tableText).then(() => {
      // 可以添加一个提示，表明已复制
      console.log(`表格 "${category}" 已复制到剪贴板`);
      // 这里可以添加一个用户提示，例如 toast 消息
    }).catch(err => {
      console.error('复制失败:', err);
    });
  }
</script>

{#if weeklySummary}
  <!-- 显示工作总结 -->
  <div class="mt-6">
    <h3 class="text-lg font-bold text-gray-800 mb-3">本周工作总结</h3>
    <div class="p-4 bg-gray-50 rounded-lg border border-gray-300">
      <p class="text-gray-700 whitespace-pre-line">{weeklySummary}</p>
    </div>
  </div>
{/if}

{#if hasTableData && categories.length > 0}
  {#each categories as category}
    <div class="mt-6">
      <div class="flex justify-between items-center mb-3">
        <h3 class="text-lg font-bold text-gray-800">{category}</h3>
        <button 
          class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          on:click={() => copyTableToClipboard(category)}
        >
          复制表格
        </button>
      </div>
      <div class="overflow-x-auto overflow-y-auto max-h-[500px]">
          <table class="w-full border-collapse">
            <thead>
              <tr class="bg-primary text-white">
                {#each headers() as header, i}
                  <th class="p-2.5 text-left font-heading">
                    {header}
                  </th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each groupedData()[category] as row, i}
                <tr class="even:bg-blue-50/50 hover:bg-blue-100/50">
                  {#each columns() as column}
                    <td class="p-2.5 text-sm">
                      {row[column] ?? ''}
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
    </div>
  {/each}
{:else}
  {#if rawData && hasTableData && tableData.length === 0}
    <div class="mt-4 p-4 bg-gray-100 rounded-lg text-center text-gray-600">
      未找到可表格化的工作数据
    </div>
  {/if}
{/if}