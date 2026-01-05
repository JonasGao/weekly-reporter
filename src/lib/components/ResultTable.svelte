<script>
  import { extractJsonFromText, processResult } from '../services/ResultProcessService.js';

  export let data = [];
  export let rawData = '';

  // 处理传入的数据，使用 ResultProcessService 进行数据处理
  $: processedResult = processResult(rawData);
  $: tableData = processedResult.hasTableData ? processedResult.resultTableData : data;
  $: weeklySummary = processedResult.weeklySummary; // 获取工作总结

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

{#if categories.length > 0}
  {#each categories as category}
    <div class="mt-6">
      <h3 class="text-lg font-bold text-gray-800 mb-3">{category}</h3>
      <div class="overflow-hidden rounded-xl border border-gray-300">
        <div class="overflow-x-auto overflow-y-auto max-h-[500px]">
          <table class="w-full border-collapse">
            <thead>
              <tr class="bg-primary text-white">
                {#each headers() as header, i}
                  <th class="p-2.5 border-b border-r border-gray-300 text-left font-heading last:border-r-0">
                    {header}
                  </th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each groupedData()[category] as row, i}
                <tr class="even:bg-blue-50/50 hover:bg-blue-100/50">
                  {#each columns() as column}
                    <td class="p-2.5 border-r border-b border-gray-300 last:border-r-0 text-sm">
                      {row[column] ?? ''}
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  {/each}
{:else}
  {#if rawData && processedResult.hasTableData && processedResult.resultTableData.length === 0}
    <div class="mt-4 p-4 bg-gray-100 rounded-lg text-center text-gray-600">
      未找到可表格化的工作数据
    </div>
  {/if}
{/if}