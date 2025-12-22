<script>
  import { configs, currentConfigId, showConfigModal, successMessage, errorMessage } from '../stores/appStore.js';
  
  let allConfigs = [];
  let currentId = null;
  let configForm = {
    name: '',
    apiUrl: '',
    apiKey: '',
    dingtalk: {
      enabled: false,
      corpId: '',
      appKey: '',
      appSecret: '',
      userId: ''
    }
  };

  // Subscribe to stores
  configs.subscribe(value => {
    allConfigs = value;
  });

  currentConfigId.subscribe(value => {
    currentId = value;
    loadCurrentConfig();
  });

  function loadCurrentConfig() {
    const config = allConfigs.find(c => c.id === currentId);
    if (config) {
      configForm = {
        name: config.name || '',
        apiUrl: config.apiUrl || '',
        apiKey: config.apiKey || '',
        dingtalk: config.dingtalk || {
          enabled: false,
          corpId: '',
          appKey: '',
          appSecret: '',
          userId: ''
        }
      };
    }
  }

  function generateId() {
    return 'config_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function saveConfig() {
    if (!configForm.apiUrl || !configForm.apiKey) {
      errorMessage.set('请填写完整的 API 配置信息');
      return;
    }

    const configIndex = allConfigs.findIndex(c => c.id === currentId);
    if (configIndex !== -1) {
      allConfigs[configIndex] = {
        ...allConfigs[configIndex],
        ...configForm
      };
    } else {
      const newConfig = {
        id: currentId || generateId(),
        ...configForm
      };
      allConfigs.push(newConfig);
      currentConfigId.set(newConfig.id);
    }

    configs.set(allConfigs);
    localStorage.setItem('weeklyReporter_configs', JSON.stringify(allConfigs));
    localStorage.setItem('weeklyReporter_currentConfigId', currentId);
    successMessage.set('配置已保存');
  }

  function createNewConfig() {
    const newConfig = {
      id: generateId(),
      name: '新配置',
      apiUrl: '',
      apiKey: '',
      dingtalk: {
        enabled: false,
        corpId: '',
        appKey: '',
        appSecret: '',
        userId: ''
      }
    };

    allConfigs.push(newConfig);
    configs.set(allConfigs);
    currentConfigId.set(newConfig.id);
    localStorage.setItem('weeklyReporter_configs', JSON.stringify(allConfigs));
    localStorage.setItem('weeklyReporter_currentConfigId', newConfig.id);
    successMessage.set('新配置已创建');
  }

  function deleteCurrentConfig() {
    if (allConfigs.length <= 1) {
      errorMessage.set('至少需保留一个配置');
      return;
    }

    if (confirm('确定要删除当前配置吗？')) {
      const currentIndex = allConfigs.findIndex(c => c.id === currentId);
      if (currentIndex !== -1) {
        allConfigs.splice(currentIndex, 1);
        currentConfigId.set(allConfigs[0].id);
        configs.set(allConfigs);
        localStorage.setItem('weeklyReporter_configs', JSON.stringify(allConfigs));
        localStorage.setItem('weeklyReporter_currentConfigId', allConfigs[0].id);
        successMessage.set('配置已删除');
      }
    }
  }

  function selectConfig(event) {
    currentConfigId.set(event.target.value);
    localStorage.setItem('weeklyReporter_currentConfigId', event.target.value);
  }

  function exportConfig() {
    try {
      const exportData = {
        exportDate: new Date().toISOString(),
        configs: allConfigs
      };
      
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `周报配置_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      successMessage.set('配置已导出');
    } catch (error) {
      console.error('导出配置失败：', error);
      errorMessage.set('导出配置失败');
    }
  }

  function importConfig() {
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
          if (data.configs && Array.isArray(data.configs)) {
            configs.set(data.configs);
            localStorage.setItem('weeklyReporter_configs', JSON.stringify(data.configs));
            if (data.configs.length > 0) {
              currentConfigId.set(data.configs[0].id);
              localStorage.setItem('weeklyReporter_currentConfigId', data.configs[0].id);
            }
            successMessage.set('配置导入成功');
          } else {
            errorMessage.set('文件格式错误');
          }
        } catch (error) {
          console.error('导入配置失败：', error);
          errorMessage.set('文件格式错误，导入失败');
        }
      };
      reader.readAsText(file);
    };
    
    input.click();
  }

  function closeModal() {
    showConfigModal.set(false);
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      closeModal();
    }
  }

  function handleBackdropKeydown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      closeModal();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div 
  class="fixed top-0 left-0 w-full h-full bg-black/50 z-[1000] flex items-center justify-center" 
  on:click={closeModal}
  on:keydown={handleBackdropKeydown}
  role="dialog" 
  aria-modal="true"
  tabindex="-1"
>
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="bg-white rounded-3xl p-6 max-w-2xl w-11/12 max-h-[80vh] overflow-y-auto" on:click|stopPropagation on:keydown|stopPropagation role="document">
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-xl font-heading m-0">🔧 Dify 配置</h3>
      <button class="text-3xl text-gray-400 hover:text-black cursor-pointer border-none bg-transparent" on:click={closeModal}>×</button>
    </div>
    
    <div class="mb-5">
      <!-- Config Selection -->
      <div class="flex justify-between items-center mb-5 gap-2 flex-wrap">
        <div class="flex items-center gap-2 flex-wrap">
          <label for="configSelector" class="text-sm font-medium">选择配置:</label>
          <select 
            id="configSelector" 
            class="px-3 py-2 border-0 rounded-3xl text-sm min-w-[200px] bg-white shadow-md"
            value={currentId}
            on:change={selectConfig}
          >
            {#each allConfigs as config}
              <option value={config.id}>{config.name}</option>
            {/each}
          </select>
          <button type="button" class="px-3 py-1.5 bg-primary text-white border-0 rounded-3xl cursor-pointer text-xs font-medium shadow-sm hover:bg-sky-600" on:click={createNewConfig}>+ 新建</button>
          <button type="button" class="px-3 py-1.5 bg-red-500 text-white border-0 rounded-3xl cursor-pointer text-xs font-medium shadow-sm hover:bg-red-600" on:click={deleteCurrentConfig}>- 删除</button>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" class="px-3 py-1.5 bg-gray-500 text-white border-0 rounded-3xl cursor-pointer text-xs font-medium shadow-sm hover:bg-gray-600" on:click={exportConfig}>📤 导出配置</button>
          <button type="button" class="px-3 py-1.5 bg-gray-500 text-white border-0 rounded-3xl cursor-pointer text-xs font-medium shadow-sm hover:bg-gray-600" on:click={importConfig}>📥 导入配置</button>
        </div>
      </div>

      <!-- Config Form -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="md:col-span-2 flex flex-col">
          <label for="configName" class="font-medium mb-1 text-sm">配置名称:</label>
          <input 
            type="text" 
            id="configName" 
            placeholder="例如：工作周报模型" 
            class="px-3 py-2 border-0 rounded-3xl text-sm bg-white shadow-md focus:shadow-lg focus:outline-none"
            bind:value={configForm.name}
          >
        </div>

        <!-- Dify API Configuration -->
        <div class="md:col-span-2 mt-4 mb-2 font-medium text-primary border-b border-primary/20 pb-2">Dify API 配置</div>
        
        <div class="md:col-span-2 flex flex-col">
          <label for="difyApiUrl" class="font-medium mb-1 text-sm">API 地址:</label>
          <input 
            type="url" 
            id="difyApiUrl" 
            placeholder="https://api.dify.ai/v1/workflows/run" 
            class="px-3 py-2 border-0 rounded-3xl text-sm bg-white shadow-md focus:shadow-lg focus:outline-none"
            bind:value={configForm.apiUrl}
          >
        </div>

        <div class="md:col-span-2 flex flex-col">
          <label for="difyApiKey" class="font-medium mb-1 text-sm">API 密钥:</label>
          <input 
            type="password" 
            id="difyApiKey" 
            placeholder="app-xxxxxxxxxxxxxxxx" 
            class="px-3 py-2 border-0 rounded-3xl text-sm bg-white shadow-md focus:shadow-lg focus:outline-none"
            bind:value={configForm.apiKey}
          >
        </div>

        <!-- DingTalk API Configuration -->
        <div class="md:col-span-2 mt-4 mb-2 font-medium text-primary border-b border-primary/20 pb-2">钉钉周报API配置</div>
        
        <div class="md:col-span-2 flex items-center gap-2">
          <label for="dingTalkEnabled" class="font-medium text-sm">启用钉钉周报:</label>
          <div class="relative inline-block w-14 h-7">
            <input 
              type="checkbox" 
              id="dingTalkEnabled" 
              class="sr-only peer"
              bind:checked={configForm.dingtalk.enabled}
            >
            <label 
              for="dingTalkEnabled" 
              class="absolute cursor-pointer top-0 left-0 right-0 bottom-0 bg-gray-400 rounded-full transition-colors peer-checked:bg-primary"
            >
              <span class="absolute left-1 top-1 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-7"></span>
            </label>
          </div>
        </div>

        <div class="flex flex-col">
          <label for="dingTalkCorpId" class="font-medium mb-1 text-sm">企业ID(CorpId):</label>
          <input 
            type="text" 
            id="dingTalkCorpId" 
            placeholder="企业ID，例如：ding12345..." 
            class="px-3 py-2 border-0 rounded-3xl text-sm bg-white shadow-md focus:shadow-lg focus:outline-none"
            bind:value={configForm.dingtalk.corpId}
          >
        </div>

        <div class="flex flex-col">
          <label for="dingTalkAppKey" class="font-medium mb-1 text-sm">应用AppKey:</label>
          <input 
            type="text" 
            id="dingTalkAppKey" 
            placeholder="应用的AppKey" 
            class="px-3 py-2 border-0 rounded-3xl text-sm bg-white shadow-md focus:shadow-lg focus:outline-none"
            bind:value={configForm.dingtalk.appKey}
          >
        </div>

        <div class="flex flex-col">
          <label for="dingTalkAppSecret" class="font-medium mb-1 text-sm">应用AppSecret:</label>
          <input 
            type="password" 
            id="dingTalkAppSecret" 
            placeholder="应用的AppSecret" 
            class="px-3 py-2 border-0 rounded-3xl text-sm bg-white shadow-md focus:shadow-lg focus:outline-none"
            bind:value={configForm.dingtalk.appSecret}
          >
        </div>

        <div class="flex flex-col">
          <label for="dingTalkUserId" class="font-medium mb-1 text-sm">用户ID:</label>
          <input 
            type="text" 
            id="dingTalkUserId" 
            placeholder="钉钉用户ID" 
            class="px-3 py-2 border-0 rounded-3xl text-sm bg-white shadow-md focus:shadow-lg focus:outline-none"
            bind:value={configForm.dingtalk.userId}
          >
        </div>

        <div class="md:col-span-2 mt-4">
          <button 
            type="button" 
            class="px-5 py-2 bg-gray-500 text-white border-0 rounded-3xl cursor-pointer text-sm font-medium shadow-md hover:bg-gray-900 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300"
            on:click={saveConfig}
          >
            保存配置
          </button>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  .peer:checked ~ label span {
    transform: translateX(1.75rem);
  }
</style>
