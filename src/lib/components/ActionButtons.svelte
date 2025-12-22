<script>
  export let onGenerate;
  export let onClearAll;
  export let onSaveData;
  export let onLoadData;
</script>

<div class="flex justify-center gap-3 flex-wrap">
  <button 
    type="button" 
    class="px-5 py-2 border-0 rounded-3xl text-sm font-medium cursor-pointer transition-all duration-300 inline-flex items-center gap-2 min-w-[110px] justify-center shadow-md bg-primary text-white hover:bg-sky-500 hover:-translate-y-0.5 hover:shadow-lg"
    on:click={onGenerate}
  >
    <span>🚀 生成周报</span>
  </button>
  <button 
    type="button" 
    class="px-5 py-2 border-0 rounded-3xl text-sm font-medium cursor-pointer transition-all duration-300 inline-flex items-center gap-2 min-w-[110px] justify-center shadow-md bg-gray-500 text-white hover:bg-gray-900 hover:-translate-y-0.5 hover:shadow-lg"
    on:click={onClearAll}
  >
    🗑️ 清空所有
  </button>
  <button 
    type="button" 
    class="px-5 py-2 border-0 rounded-3xl text-sm font-medium cursor-pointer transition-all duration-300 inline-flex items-center gap-2 min-w-[110px] justify-center shadow-md bg-gray-500 text-white hover:bg-gray-900 hover:-translate-y-0.5 hover:shadow-lg"
    on:click={onSaveData}
  >
    💾 保存数据
  </button>
  <button 
    type="button" 
    class="px-5 py-2 border-0 rounded-3xl text-sm font-medium cursor-pointer transition-all duration-300 inline-flex items-center gap-2 min-w-[110px] justify-center shadow-md bg-gray-500 text-white hover:bg-gray-900 hover:-translate-y-0.5 hover:shadow-lg"
    on:click={onLoadData}
  >
    📂 加载数据
  </button>
</div>
