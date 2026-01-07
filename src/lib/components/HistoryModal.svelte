<script>
  import { onMount } from 'svelte';
  import { showHistoryModal, inputData, successMessage, errorMessage } from '../stores/appStore.js';
  import { indexedDBService } from '../services/IndexedDBService.js';
  import ResultTable from './ResultTable.svelte';

  // 使用 $props() 替代 export let，在 Svelte 5 runes 模式下
  // const { onUseHistory } = $props();

  let history = $state([]);
  let showDetailModal = $state(false);
  let currentDetail = $state(null);

  onMount(async () => {
    await loadHistory();
  });

  async function loadHistory() {
    try {
      // Initialize IndexedDB and load history
      await indexedDBService.init();
      const loadedHistory = await indexedDBService.getAllHistory();
      console.log('从IndexedDB加载的历史记录数量:', loadedHistory.length);
      history = loadedHistory;
    } catch (error) {
      console.error('加载历史记录失败：', error);
      errorMessage.set('加载历史记录失败');
      history = [];
    }
  }

  function getSummary(text, maxLength = 30) {
    if (!text) return '';

    let processed = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

    if (processed.length <= maxLength) return processed;

    return processed.substring(0, maxLength) + '...';
  }

  function showHistoryDetail(item) {
    currentDetail = item;
    showDetailModal = true;
  }

  function closeHistoryDetail() {
    showDetailModal = false;
    currentDetail = null;
  }

  function useHistoryData(item) {
    inputData.set({
      lastWeekPlan: item.lastWeekPlan || '',
      lastWeekWork: item.lastWeekWork || '',
      nextWeekPlan: item.nextWeekPlan || '',
      additionalNotes: item.additionalNotes || ''
    });
    closeHistoryDetail();
    showHistoryModal.set(false);
    successMessage.set('已加载历史数据');
  }

  async function removeHistoryItem(id) {
    if (confirm('确定要删除此历史记录吗？')) {
      try {
        await indexedDBService.deleteHistory(id);
        await loadHistory();
        closeHistoryDetail();
        successMessage.set('历史记录已删除');
      } catch (error) {
        console.error('删除历史记录失败：', error);
        errorMessage.set('删除历史记录失败');
      }
    }
  }

  async function clearHistory() {
    if (confirm('确定要清空所有历史记录吗？此操作无法撤销！')) {
      try {
        await indexedDBService.clearAllHistory();
        await loadHistory();
        successMessage.set('所有历史记录已清空');
      } catch (error) {
        console.error('清空历史记录失败：', error);
        errorMessage.set('清空历史记录失败');
      }
    }
  }

  function exportHistory() {
    try {
      const exportData = {
        exportDate: new Date().toISOString(),
        history: history
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `周报生成历史记录_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      successMessage.set('历史记录已导出');
    } catch (error) {
      console.error('导出历史记录失败：', error);
      errorMessage.set('导出历史记录失败');
    }
  }

  function closeModal() {
    showHistoryModal.set(false);
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      if (showDetailModal) {
        closeHistoryDetail();
      } else {
        closeModal();
      }
    }
  }

  function handleBackdropKeydown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      closeModal();
    }
  }

  function handleDetailBackdropKeydown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      closeHistoryDetail();
    }
  }

  function copyToClipboard(text) {
    try {
      navigator.clipboard.writeText(text);
      successMessage.set('原始输出已复制到剪贴板');
    } catch (error) {
      console.error('复制失败：', error);
      errorMessage.set('复制失败，请手动选择复制');
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="fixed top-0 left-0 w-full h-full bg-black/50 z-[1000] flex items-center justify-center animate-fade-in"
  onclick={closeModal}
  onkeydown={handleBackdropKeydown}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>
  <div class="bg-white rounded-3xl p-6 max-w-4xl w-11/12 max-h-[80vh] overflow-y-auto animate-scale-in" role="document">
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-xl font-heading m-0">📜 历史记录</h3>
      <button class="text-3xl text-gray-400 hover:text-black cursor-pointer border-none bg-transparent" onclick={closeModal}>×</button>
    </div>

    <div class="mb-5">
      <!-- History Actions -->
      <div class="flex justify-start gap-2 mb-5">
        <button
          type="button"
          class="px-4 py-2 bg-gray-500 text-white border-0 rounded-3xl cursor-pointer text-sm font-medium shadow-md hover:bg-gray-900 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300"
          onclick={clearHistory}
        >
          🗑️ 清空历史
        </button>
        <button
          type="button"
          class="px-4 py-2 bg-gray-500 text-white border-0 rounded-3xl cursor-pointer text-sm font-medium shadow-md hover:bg-gray-900 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300"
          onclick={exportHistory}
        >
          📊 导出历史
        </button>
      </div>

      <!-- History Table -->
      <div class="overflow-x-auto overflow-y-auto max-h-[400px]">
        <table class="w-full border-collapse">
          <thead>
            <tr class="bg-secondary text-white sticky top-0">
              <th class="p-2.5 text-left font-heading" style="width: 20%">时间</th>
              <th class="p-2.5 text-left font-heading" style="width: 25%">上周计划摘要</th>
              <th class="p-2.5 text-left font-heading" style="width: 25%">上周内容摘要</th>
              <th class="p-2.5 text-left font-heading" style="width: 20%">下周计划摘要</th>
              <th class="p-2.5 text-left font-heading" style="width: 10%">操作</th>
            </tr>
          </thead>
          <tbody>
          {#if history.length === 0}
            <tr>
              <td colspan="5" class="p-2.5 text-center">暂无历史记录</td>
            </tr>
          {:else}
            {#each history as item}
              <tr class="even:bg-orange-50/50 hover:bg-orange-100/50">
                <td class="p-2.5">{item.formattedDate}</td>
                <td class="p-2.5">{getSummary(item.lastWeekPlan)}</td>
                <td class="p-2.5">{getSummary(item.lastWeekWork)}</td>
                <td class="p-2.5">{getSummary(item.nextWeekPlan)}</td>
                <td class="p-2.5">
                  <button
                    class="px-2.5 py-1 border-0 bg-secondary text-white cursor-pointer text-xs hover:bg-accent hover:shadow-md"
                    onclick={() => showHistoryDetail(item)}
                  >
                    查看
                  </button>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
      </div>
    </div>
  </div>
</div>

<!-- History Detail Modal -->
{#if showDetailModal && currentDetail}
  <div
    class="fixed top-0 left-0 w-full h-full bg-black/50 z-[1001] flex items-center justify-center animate-fade-in"
    onclick={closeHistoryDetail}
    onkeydown={handleDetailBackdropKeydown}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="bg-white rounded-3xl p-6 max-w-4xl w-11/12 max-h-[80vh] overflow-y-auto animate-scale-in" role="document">
      <div class="flex justify-between items-center mb-4 pb-2 border-b border-gray-200">
        <div class="flex items-center gap-2">
          <h3 class="text-lg font-heading m-0">历史记录详情</h3>
          {#if currentDetail.isJsonResult}
            <span class="inline-block bg-purple-600 text-white px-2 py-1 text-xs rounded font-bold">JSON</span>
          {/if}
        </div>
        <button class="text-3xl text-gray-400 hover:text-black cursor-pointer border-none bg-transparent" onclick={closeHistoryDetail}>×</button>
      </div>

      <div class="space-y-5">
        <div>
          <h4 class="text-base font-heading m-0 mb-2">生成时间: {currentDetail.formattedDate}</h4>
        </div>

        <!-- Input Data -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-gray-50 p-4 rounded-lg">
            <h5 class="font-heading text-sm m-0 mb-2">上周工作计划:</h5>
            <pre class="m-0 whitespace-pre-wrap text-sm max-h-36 overflow-y-auto p-2 bg-white border border-gray-200 rounded">{currentDetail.lastWeekPlan}</pre>
          </div>

          <div class="bg-gray-50 p-4 rounded-lg">
            <h5 class="font-heading text-sm m-0 mb-2">上周工作内容:</h5>
            <pre class="m-0 whitespace-pre-wrap text-sm max-h-36 overflow-y-auto p-2 bg-white border border-gray-200 rounded">{currentDetail.lastWeekWork}</pre>
          </div>

          <div class="bg-gray-50 p-4 rounded-lg">
            <h5 class="font-heading text-sm m-0 mb-2">下周工作计划:</h5>
            <pre class="m-0 whitespace-pre-wrap text-sm max-h-36 overflow-y-auto p-2 bg-white border border-gray-200 rounded">{currentDetail.nextWeekPlan}</pre>
          </div>

          <div class="bg-gray-50 p-4 rounded-lg">
            <h5 class="font-heading text-sm m-0 mb-2">额外说明:</h5>
            <pre class="m-0 whitespace-pre-wrap text-sm max-h-36 overflow-y-auto p-2 bg-white border border-gray-200 rounded">{currentDetail.additionalNotes || '无'}</pre>
          </div>
        </div>

        <!-- Generated Result -->
        <div class="bg-gray-50 p-4 rounded-lg">
          <h5 class="font-heading text-sm m-0 mb-2">生成结果:</h5>
          <div class="bg-white p-4 border border-gray-200 rounded max-h-72 overflow-y-auto">
            {@html currentDetail.result.replace(/\n/g, '<br>')}
          </div>
        </div>

        <!-- Result Table -->
        <div class="bg-gray-50 p-4 rounded-lg">
          <h5 class="font-heading text-sm m-0 mb-2">表格化结果:</h5>
          <ResultTable rawData={currentDetail.result} />
        </div>

        <!-- Raw Output -->
        <div class="bg-gray-50 p-4 rounded-lg">
          <div class="flex justify-between items-center mb-2">
            <h5 class="font-heading text-sm m-0">原始输出:</h5>
            <button
              class="px-3 py-1 bg-gray-600 text-white border-0 rounded text-xs cursor-pointer hover:bg-gray-700"
              onclick={() => copyToClipboard(currentDetail.result)}
            >
              复制
            </button>
          </div>
          <pre class="m-0 whitespace-pre-wrap text-xs max-h-72 overflow-y-auto p-4 bg-gray-900 text-gray-300 rounded font-mono">{currentDetail.result}</pre>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-2 pt-4">
          <button
            type="button"
            class="px-5 py-2 bg-primary text-white border-0 rounded-3xl cursor-pointer text-sm font-medium shadow-md hover:bg-sky-600 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300"
            onclick={() => useHistoryData(currentDetail)}
          >
            使用此数据
          </button>
          <button
            type="button"
            class="px-5 py-2 bg-red-500 text-white border-0 rounded-3xl cursor-pointer text-sm font-medium shadow-md hover:bg-red-600 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300"
            onclick={() => removeHistoryItem(currentDetail.id)}
          >
            删除记录
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}