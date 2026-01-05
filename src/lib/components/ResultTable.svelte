<script>
  import { extractJsonFromText, processResult } from '../services/ResultProcessService.js';

  export let data = [];
  export let rawData = '';

  // 处理传入的数据，使用 ResultProcessService 进行数据处理
  $: processedResult = processResult(rawData);
  $: tableData = processedResult.hasTableData ? processedResult.resultTableData : data;

  // 获取列名，优先使用处理后的数据，否则使用原始数据
  $: columns = tableData.length > 0 ? Object.keys(tableData[0]) : [];

  // 定义列标题映射，将中文列名转换为更友好的显示文本
  const columnHeaders = {
    'category': '类别',
    'project': '所属项目',
    'task': '工作项',
    'description': '工作内容及进度说明'
  };

  // 获取列标题
  $: headers = columns.map(col => columnHeaders[col] || col);
</script>

{#if tableData.length > 0}
  <div class="overflow-hidden rounded-xl border border-gray-300 mt-4">
    <div class="overflow-x-auto overflow-y-auto max-h-[500px]">
      <table class="w-full border-collapse">
        <thead>
        <tr class="bg-primary text-white sticky top-0">
          {#each headers as header, i}
            <th class="p-2.5 border-b border-r border-gray-300 text-left font-heading last:border-r-0">
              {header}
            </th>
          {/each}
        </tr>
        </thead>
        <tbody>
        {#each tableData as row, i}
          <tr class="even:bg-blue-50/50 hover:bg-blue-100/50">
            {#each columns as column}
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
{:else}
  {#if rawData && processedResult.hasTableData && processedResult.resultTableData.length === 0}
    <div class="mt-4 p-4 bg-gray-100 rounded-lg text-center text-gray-600">
      未找到可表格化的工作数据
    </div>
  {/if}
{/if}
