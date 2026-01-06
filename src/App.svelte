<script>
  import { onMount } from 'svelte';
  import Header from './lib/components/Header.svelte';
  import InputForm from './lib/components/InputForm.svelte';
  import ActionButtons from './lib/components/ActionButtons.svelte';
  import ConfigModal from './lib/components/ConfigModal.svelte';
  import HistoryModal from './lib/components/HistoryModal.svelte';
  import ResultTable from './lib/components/ResultTable.svelte';
  import { inputData, configs, currentConfigId, reportResult, showResult, errorMessage, successMessage, showLoading, loadingMessage, showConfigModal, showHistoryModal } from './lib/stores/appStore.js';
  import { indexedDBService } from './lib/services/IndexedDBService.js';
  import { generateReportWithDify } from './lib/services/DifyService.js';
  let showError = false;
  let showSuccess = false;
  let resultContent = '';
  let version = import.meta.env.VITE_APP_VERSION || import.meta.env.npm_package_version;

  // Subscribe to messages
  errorMessage.subscribe(msg => {
    if (msg) {
      showError = true;
      setTimeout(() => {
        showError = false;
        errorMessage.set('');
      }, 5000);
    }
  });

  successMessage.subscribe(msg => {
    if (msg) {
      showSuccess = true;
      setTimeout(() => {
        showSuccess = false;
        successMessage.set('');
      }, 3000);
    }
  });

  reportResult.subscribe(result => {
    resultContent = result;
  });

  onMount(() => {
    // Load saved data
    const savedDraft = localStorage.getItem('weeklyReporter_draft');
    if (savedDraft) {
      try {
        const data = JSON.parse(savedDraft);
        inputData.set(data);
      } catch (e) {
        console.error('Failed to load draft:', e);
      }
    }

    // Load configs
    const savedConfigs = localStorage.getItem('weeklyReporter_configs');
    if (savedConfigs) {
      try {
        const parsedConfigs = JSON.parse(savedConfigs);
        configs.set(parsedConfigs);

        const lastUsedConfigId = localStorage.getItem('weeklyReporter_currentConfigId');
        if (lastUsedConfigId && parsedConfigs.some(c => c.id === lastUsedConfigId)) {
          currentConfigId.set(lastUsedConfigId);
        } else if (parsedConfigs.length > 0) {
          currentConfigId.set(parsedConfigs[0].id);
        }
      } catch (e) {
        console.error('Failed to load configs:', e);
      }
    } else {
      // Initialize default config
      const defaultConfig = {
        id: 'config_' + Date.now(),
        name: '默认配置',
        apiUrl: '',
        apiKey: ''
      };
      configs.set([defaultConfig]);
      currentConfigId.set(defaultConfig.id);
      localStorage.setItem('weeklyReporter_configs', JSON.stringify([defaultConfig]));
    }
  });

  async function addToHistory(result) {
    try {
      const data = $inputData;
      const timestamp = new Date().toISOString();
      const formattedDate = new Date().toLocaleString('zh-CN');

      const historyItem = {
        id: `history_${Date.now()}`,
        timestamp: timestamp,
        formattedDate: formattedDate,
        lastWeekPlan: data.lastWeekPlan,
        lastWeekWork: data.lastWeekWork,
        nextWeekPlan: data.nextWeekPlan,
        additionalNotes: data.additionalNotes,
        result: result,
        isJsonResult: false
      };

      // Initialize IndexedDB and save history
      await indexedDBService.init();
      await indexedDBService.addHistory(historyItem);

      // Keep only latest 100 items
      await indexedDBService.keepLatestRecords(100);
    } catch (error) {
      console.error('添加历史记录失败：', error);
    }
  }

  async function handleGenerate() {
    const data = $inputData;

    // Get current config
    const currentId = $currentConfigId;
    const allConfigs = $configs;
    const config = allConfigs.find(c => c.id === currentId);

    if (!config || !config.apiUrl || !config.apiKey) {
      errorMessage.set('请先配置 Dify API 信息');
      showConfigModal.set(true);
      return;
    }

    showLoading.set(true);
    loadingMessage.set('正在生成周报...');

    try {
      const result = await generateReportWithDify(data, config);

      reportResult.set(result);
      showResult.set(true);
      successMessage.set('周报生成成功！');

      // Save to history
      addToHistory(result);

      // Scroll to result
      setTimeout(() => {
        document.getElementById('resultSection')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      console.error('生成周报失败：', error);
      errorMessage.set(`生成周报失败：${error.message}`);
    } finally {
      showLoading.set(false);
    }
  }

  function handleClearAll() {
    if (confirm('确定要清空所有输入内容吗？')) {
      inputData.set({
        lastWeekPlan: '',
        lastWeekWork: '',
        nextWeekPlan: '',
        additionalNotes: ''
      });
      showResult.set(false);
      localStorage.removeItem('weeklyReporter_draft');
      successMessage.set('已清空所有内容');
    }
  }

  function handleSaveData() {
    const data = $inputData;
    const jsonData = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `周报数据_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    successMessage.set('数据已保存到文件');
  }

  function handleLoadData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          inputData.set({
            lastWeekPlan: data.lastWeekPlan || '',
            lastWeekWork: data.lastWeekWork || '',
            nextWeekPlan: data.nextWeekPlan || '',
            additionalNotes: data.additionalNotes || ''
          });
          successMessage.set('数据加载成功');
        } catch (error) {
          console.error('加载数据失败：', error);
          errorMessage.set('文件格式错误，加载失败');
        }
      };
      reader.readAsText(file);
    };

    input.click();
  }

  function handleUseHistory({ item }) {
    // 设置输入数据后，如果历史记录包含结果，也展示结果
    if (item.result) {
      reportResult.set(item.result);
      showResult.set(true);
    }
  }
</script>

<div class="max-w-6xl mx-auto p-4 bg-white shadow-2xl rounded-3xl my-4">
  <Header />

  <main class="mb-5">
    <InputForm />
    <ActionButtons
            onGenerate={handleGenerate}
            onClearAll={handleClearAll}
            onSaveData={handleSaveData}
            onLoadData={handleLoadData}
    />

    {#if $showResult}
      <section class="bg-white rounded-3xl p-5 mt-5 shadow-md" id="resultSection">
        <h2 class="font-heading text-gray-900 mb-4 text-2xl text-center">📄 生成的周报</h2>

        <div class="mb-5">
          <ResultTable rawData={resultContent} />
        </div>

        <div class="bg-white p-5 rounded-3xl border-0 text-sm leading-relaxed max-h-[600px] overflow-y-auto shadow-md">
          {@html resultContent}
        </div>
      </section>
    {/if}
  </main>

  <footer class="text-center py-4 border-t-0 mt-5 text-gray-500 text-sm">
    <p>&copy; 2025 智能周报生成工具 | 基于 Dify AI 平台</p>
    {#if version}
      <p class="mt-1 text-xs text-gray-400">版本: {version}</p>
    {/if}
  </footer>
</div>

<!-- Loading Overlay -->
{#if $showLoading}
  <div class="fixed top-0 left-0 w-screen h-screen bg-black/80 flex justify-center items-center z-[9999] animate-fade-in">
    <div class="bg-white rounded-3xl p-9 text-center shadow-2xl max-w-md relative z-[10000] animate-scale-in">
      <div class="mb-5">
        <div class="w-16 h-16 border-4 border-blue-200 border-t-primary rounded-full animate-spin mx-auto mb-5"></div>
        <div class="text-base font-medium text-gray-900 mb-2">{$loadingMessage}</div>
        <div class="text-sm text-gray-500">请稍候...</div>
      </div>
      <div class="mt-5">
        <button
                class="bg-red-500 text-white border-0 px-6 py-3 rounded-3xl cursor-pointer text-sm font-medium transition-all duration-200 min-w-[100px] hover:bg-red-600 hover:-translate-y-px hover:shadow-lg"
                on:click={() => showLoading.set(false)}
        >
          取消
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Error Message -->
{#if showError}
  <div class="fixed top-5 right-5 px-5 py-4 rounded-3xl text-white font-medium flex items-center gap-2 z-[1000] max-w-md shadow-lg bg-red-500">
    <span class="text-xl">❌</span>
    <span>{$errorMessage}</span>
    <button
            class="bg-transparent border-none text-white text-lg cursor-pointer ml-auto p-0 w-5 h-5 flex items-center justify-center"
            on:click={() => { showError = false; errorMessage.set(''); }}
    >
      ×
    </button>
  </div>
{/if}

<!-- Success Message -->
{#if showSuccess}
  <div class="fixed top-5 right-5 px-5 py-4 rounded-3xl text-white font-medium flex items-center gap-2 z-[1000] max-w-md shadow-lg bg-green-500">
    <span class="text-xl">✅</span>
    <span>{$successMessage}</span>
    <button
            class="bg-transparent border-none text-white text-lg cursor-pointer ml-auto p-0 w-5 h-5 flex items-center justify-center"
            on:click={() => { showSuccess = false; successMessage.set(''); }}
    >
      ×
    </button>
  </div>
{/if}

<!-- Config Modal -->
{#if $showConfigModal}
  <ConfigModal />
{/if}

<!-- History Modal -->
{#if $showHistoryModal}
  <HistoryModal onUseHistory={handleUseHistory} />
{/if}