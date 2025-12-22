<script>
  import { inputData } from '../stores/appStore.js';
  
  let localData = {
    lastWeekPlan: '',
    lastWeekWork: '',
    nextWeekPlan: '',
    additionalNotes: ''
  };

  // Subscribe to store and update local data
  inputData.subscribe(value => {
    localData = { ...value };
  });

  // Auto-save to store on input
  function handleInput(field, event) {
    localData[field] = event.target.value;
    inputData.set(localData);
    // Auto-save to localStorage
    localStorage.setItem('weeklyReporter_draft', JSON.stringify(localData));
  }
</script>

<section class="mb-5">
  <h2 class="font-heading text-gray-900 mb-4 text-2xl text-center">📝 输入工作数据</h2>
  
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
    <div class="bg-white rounded-3xl p-4 transition-all duration-300 shadow-md hover:-translate-y-0.5 hover:shadow-xl">
      <h3 class="font-heading text-gray-900 mb-2 text-base font-semibold">📋 上周工作计划</h3>
      <textarea 
        class="w-full p-2.5 border-0 rounded-3xl text-sm font-body resize-y min-h-[100px] transition-all duration-300 bg-blue-50/50 text-gray-900 shadow-inner focus:shadow-lg focus:outline-none"
        placeholder="请输入上周的工作计划，格式示例：&#10;项目A | 需求分析 | 完成用户需求调研和分析&#10;项目B | 代码开发 | 实现登录模块功能"
        rows="6"
        value={localData.lastWeekPlan}
        on:input={(e) => handleInput('lastWeekPlan', e)}
      ></textarea>
    </div>

    <div class="bg-white rounded-3xl p-4 transition-all duration-300 shadow-md hover:-translate-y-0.5 hover:shadow-xl">
      <h3 class="font-heading text-gray-900 mb-2 text-base font-semibold">✅ 上周工作内容</h3>
      <textarea 
        class="w-full p-2.5 border-0 rounded-3xl text-sm font-body resize-y min-h-[100px] transition-all duration-300 bg-blue-50/50 text-gray-900 shadow-inner focus:shadow-lg focus:outline-none"
        placeholder="请输入上周实际完成的工作内容，格式示例：&#10;项目A | 需求分析 | 已完成80%，完成用户访谈和需求文档草稿&#10;项目B | 代码开发 | 已完成100%，登录模块已上线测试"
        rows="6"
        value={localData.lastWeekWork}
        on:input={(e) => handleInput('lastWeekWork', e)}
      ></textarea>
    </div>

    <div class="bg-white rounded-3xl p-4 transition-all duration-300 shadow-md hover:-translate-y-0.5 hover:shadow-xl">
      <h3 class="font-heading text-gray-900 mb-2 text-base font-semibold">📅 下周工作计划</h3>
      <textarea 
        class="w-full p-2.5 border-0 rounded-3xl text-sm font-body resize-y min-h-[100px] transition-all duration-300 bg-blue-50/50 text-gray-900 shadow-inner focus:shadow-lg focus:outline-none"
        placeholder="请输入下周的工作计划，格式示例：&#10;项目A | 原型设计 | 根据需求文档设计交互原型&#10;项目C | 测试验收 | 进行功能测试和用户验收"
        rows="6"
        value={localData.nextWeekPlan}
        on:input={(e) => handleInput('nextWeekPlan', e)}
      ></textarea>
    </div>

    <div class="bg-white rounded-3xl p-4 transition-all duration-300 shadow-md hover:-translate-y-0.5 hover:shadow-xl">
      <h3 class="font-heading text-gray-900 mb-2 text-base font-semibold">💡 上周工作额外说明</h3>
      <textarea 
        class="w-full p-2.5 border-0 rounded-3xl text-sm font-body resize-y min-h-[100px] transition-all duration-300 bg-blue-50/50 text-gray-900 shadow-inner focus:shadow-lg focus:outline-none"
        placeholder="请输入额外说明，如：遇到的问题、需要协调的事项、特殊情况说明等"
        rows="6"
        value={localData.additionalNotes}
        on:input={(e) => handleInput('additionalNotes', e)}
      ></textarea>
    </div>
  </div>
</section>
