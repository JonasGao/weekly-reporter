<script>
  import { showConfigModal, showHistoryModal, configs, currentConfigId } from '../stores/appStore.js';
  
  let currentConfigName = '默认配置';
  
  // Subscribe to config changes to update button text
  configs.subscribe(allConfigs => {
    currentConfigId.subscribe(id => {
      const config = allConfigs.find(c => c.id === id);
      if (config) {
        currentConfigName = config.name || '默认配置';
      }
    });
  });
</script>

<header class="flex justify-between items-center p-5 mb-5 bg-white rounded-3xl shadow-lg">
  <div class="flex items-center gap-3">
    <span class="text-4xl">📊</span>
    <div>
      <h1 class="font-heading text-2xl text-gray-900 font-semibold m-0">智能周报生成工具</h1>
      <p class="text-sm text-gray-500 font-normal m-0">基于 AI 的智能工作周报生成助手</p>
    </div>
  </div>
  <div class="flex items-center gap-2">
    <button 
      type="button" 
      class="flex items-center gap-2 px-4 py-2 bg-secondary text-white border-none rounded-3xl cursor-pointer text-sm font-medium transition-all duration-300 shadow-md hover:bg-accent hover:-translate-y-0.5 hover:shadow-lg"
      on:click={() => showHistoryModal.set(true)}
      title="历史记录"
    >
      <span>📜</span> 历史
    </button>
    <button 
      type="button" 
      class="flex items-center gap-2 px-4 py-2 bg-primary text-white border-none rounded-3xl cursor-pointer text-sm font-medium transition-all duration-300 shadow-md hover:bg-sky-500 hover:-translate-y-0.5 hover:shadow-lg"
      on:click={() => showConfigModal.set(true)}
      title="打开配置"
    >
      <span>⚙️</span> 配置：{currentConfigName}
    </button>
  </div>
</header>
