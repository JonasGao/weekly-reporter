<script>
  export let data = {};
  
  // Extract the four specific sections
  $: lastWeekActualTable = data['上周实际工作表'] || [];
  $: lastWeekPlanTable = data['上周工作计划表'] || [];
  $: nextWeekPlanTable = data['下周工作计划表'] || [];
  $: workSummary = data['工作总结'] || '';
  
  // Get columns for each table
  $: lastWeekActualColumns = lastWeekActualTable.length > 0 ? Object.keys(lastWeekActualTable[0]) : [];
  $: lastWeekPlanColumns = lastWeekPlanTable.length > 0 ? Object.keys(lastWeekPlanTable[0]) : [];
  $: nextWeekPlanColumns = nextWeekPlanTable.length > 0 ? Object.keys(nextWeekPlanTable[0]) : [];
  
  // Check if we have any data to display
  $: hasData = lastWeekActualTable.length > 0 || lastWeekPlanTable.length > 0 || nextWeekPlanTable.length > 0 || workSummary;
</script>

{#if hasData}
  <div class="space-y-6">
    <!-- 上周实际工作表 -->
    {#if lastWeekActualTable.length > 0}
      <div>
        <h3 class="font-heading text-gray-900 mb-3 text-lg font-semibold">📊 上周实际工作表</h3>
        <div class="overflow-hidden rounded-xl border border-gray-300">
          <div class="overflow-x-auto overflow-y-auto max-h-[400px]">
            <table class="w-full border-collapse">
              <thead>
                <tr class="bg-primary text-white sticky top-0">
                  {#each lastWeekActualColumns as column}
                    <th class="p-2.5 border-b border-r border-gray-300 text-left font-heading last:border-r-0">
                      {column}
                    </th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each lastWeekActualTable as row, i}
                  <tr class="even:bg-blue-50/50 hover:bg-blue-100/50">
                    {#each lastWeekActualColumns as column}
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
    {/if}

    <!-- 上周工作计划表 -->
    {#if lastWeekPlanTable.length > 0}
      <div>
        <h3 class="font-heading text-gray-900 mb-3 text-lg font-semibold">📋 上周工作计划表</h3>
        <div class="overflow-hidden rounded-xl border border-gray-300">
          <div class="overflow-x-auto overflow-y-auto max-h-[400px]">
            <table class="w-full border-collapse">
              <thead>
                <tr class="bg-primary text-white sticky top-0">
                  {#each lastWeekPlanColumns as column}
                    <th class="p-2.5 border-b border-r border-gray-300 text-left font-heading last:border-r-0">
                      {column}
                    </th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each lastWeekPlanTable as row, i}
                  <tr class="even:bg-blue-50/50 hover:bg-blue-100/50">
                    {#each lastWeekPlanColumns as column}
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
    {/if}

    <!-- 下周工作计划表 -->
    {#if nextWeekPlanTable.length > 0}
      <div>
        <h3 class="font-heading text-gray-900 mb-3 text-lg font-semibold">📅 下周工作计划表</h3>
        <div class="overflow-hidden rounded-xl border border-gray-300">
          <div class="overflow-x-auto overflow-y-auto max-h-[400px]">
            <table class="w-full border-collapse">
              <thead>
                <tr class="bg-primary text-white sticky top-0">
                  {#each nextWeekPlanColumns as column}
                    <th class="p-2.5 border-b border-r border-gray-300 text-left font-heading last:border-r-0">
                      {column}
                    </th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each nextWeekPlanTable as row, i}
                  <tr class="even:bg-blue-50/50 hover:bg-blue-100/50">
                    {#each nextWeekPlanColumns as column}
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
    {/if}

    <!-- 工作总结 -->
    {#if workSummary}
      <div>
        <h3 class="font-heading text-gray-900 mb-3 text-lg font-semibold">📝 工作总结</h3>
        <div class="bg-white p-5 rounded-xl border border-gray-300 text-sm leading-relaxed">
          {workSummary}
        </div>
      </div>
    {/if}
  </div>
{/if}
