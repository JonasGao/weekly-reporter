<script>
  import { processResult } from '../services/ResultProcessService.js';
  import { onMount } from 'svelte';

  // 使用 $props() 替代 export let，在 Svelte 5 runes 模式下
  const { rawData = '' } = $props();

  // 使用 $derived 进行数据处理
  const processedResult = $derived(processResult(rawData));
  const tableData = $derived(processedResult.resultTableData);
  const weeklySummary = $derived(processedResult.weeklySummary); // 获取工作总结
  const hasTableData = $derived(processedResult.hasTableData);

  // 按类别分组数据 - 使用 $derived
  const groupedData = $derived(() => {
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
  });

  // 获取所有类别
  const categories = $derived(Object.keys(groupedData()));

  // 获取列名，排除类别列，否则使用原始数据
  const columns = $derived(() => {
    if (tableData.length > 0) {
      const allCols = Object.keys(tableData[0]);
      // 排除 'category' 列，因为它将作为表格标题
      return allCols.filter(col => col !== 'category');
    }
    return [];
  });

  // 定义列标题映射，将中文列名转换为更友好的显示文本
  const columnHeaders = {
    'project': '所属项目',
    'task': '工作项',
    'description': '工作内容及进度说明'
  };

  // 获取列标题
  const headers = $derived(() => columns().map(col => columnHeaders[col] || col));

  // 使用 $state 管理组件状态
  let copyFormat = $state('tsv'); // 默认格式为制表符分隔

  // 在组件挂载时从 localStorage 获取保存的格式
  onMount(() => {
    const savedFormat = localStorage.getItem('copyFormat') || 'tsv';
    copyFormat = savedFormat;
  });

  // 复制表格内容到剪贴板
  function copyTableToClipboard(category) {
    const categoryData = groupedData()[category];
    if (!categoryData || categoryData.length === 0) return;

    let tableText = '';

    if (copyFormat === 'csv') {
      // CSV 格式
      // 添加表头
      const headersArray = headers();
      tableText += headersArray.map(h => `"${h.replace(/"/g, '""')}"`).join(',') + '\n';

      // 添加数据行
      for (const row of categoryData) {
        const rowText = columns().map(col => {
          const value = row[col] || '';
          // CSV 中对包含逗号、换行符或引号的值进行转义
          if (typeof value === 'string' && (value.includes(',') || value.includes('\n') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',');
        tableText += rowText + '\n';
      }
    } else if (copyFormat === 'markdown') {
      // Markdown 表格格式
      const headersArray = headers();
      tableText += '| ' + headersArray.join(' | ') + ' |\n';
      tableText += '| ' + headersArray.map(() => '---').join(' | ') + ' |\n';

      for (const row of categoryData) {
        const rowText = columns().map(col => row[col] || '').join(' | ');
        tableText += '| ' + rowText + ' |\n';
      }
    } else {
      // 默认为制表符分隔格式
      // 添加表头
      const headersArray = headers();
      tableText += headersArray.join('\t') + '\n';

      // 添加数据行
      for (const row of categoryData) {
        const rowText = columns().map(col => row[col] || '').join('\t');
        tableText += rowText + '\n';
      }
    }

    // 复制到剪贴板
    navigator.clipboard.writeText(tableText).then(() => {
      // 可以添加一个提示，表明已复制
      console.log(`表格 "${category}" 已以 ${copyFormat} 格式复制到剪贴板`);
      // 这里可以添加一个用户提示，例如 toast 消息
    }).catch(err => {
      console.error('复制失败:', err);
    });
  }

  // 更新复制格式并保存到 localStorage
  function updateCopyFormat(format) {
    copyFormat = format;
    localStorage.setItem('copyFormat', format);
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
        <div class="flex items-center space-x-2">
          <select
            class="px-2 py-1 bg-white border border-gray-300 rounded text-sm"
            bind:value={copyFormat}
            onchange={() => updateCopyFormat(copyFormat)}
          >
            <option value="tsv">TSV (制表符)</option>
            <option value="csv">CSV</option>
            <option value="markdown">Markdown</option>
          </select>
          <button
            class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            onclick={() => copyTableToClipboard(category)}
          >
            复制表格
          </button>
        </div>
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
