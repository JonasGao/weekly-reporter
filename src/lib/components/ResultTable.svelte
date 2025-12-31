<script>
  export let data = [];
  
  // Get all column names from the data
  $: columns = data.length > 0 ? Object.keys(data[0]) : [];
</script>

{#if data.length > 0}
  <div class="overflow-hidden rounded-xl border border-gray-300 mt-4">
    <div class="overflow-x-auto overflow-y-auto max-h-[500px]">
      <table class="w-full border-collapse">
        <thead>
          <tr class="bg-primary text-white sticky top-0">
            {#each columns as column}
              <th class="p-2.5 border-b border-r border-gray-300 text-left font-heading last:border-r-0">
                {column}
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each data as row, i}
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
{/if}
