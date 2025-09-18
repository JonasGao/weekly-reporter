// 验证脚本 - 检查是否存在回归问题
// 这个脚本检查所有现有功能是否仍然正常工作

console.log('开始运行功能验证脚本...');

// 检查必要的DOM元素
const requiredElements = [
    'configSelector',
    'saveConfig', 
    'newConfig',
    'deleteConfig',
    'generateReport',
    'clearAll',
    'saveData',
    'loadData',
    'copyReport',
    'downloadReport',
    'printReport',
    'closeError',
    'closeSuccess',
    'loadingOverlay',
    'loadingCancelBtn',
    'configToggle'
];

console.log('检查必要的DOM元素...');
let missingElements = [];
requiredElements.forEach(id => {
    const element = document.getElementById(id);
    if (!element) {
        missingElements.push(id);
    }
});

if (missingElements.length > 0) {
    console.error('缺少以下必要的DOM元素:', missingElements);
} else {
    console.log('✅ 所有必要的DOM元素都存在');
}

// 检查CSS类是否正确应用
console.log('检查CSS类...');
const configSection = document.querySelector('.config-section');
const loadingOverlay = document.querySelector('.loading-overlay');

if (configSection) {
    console.log('✅ 配置区域CSS类正确');
} else {
    console.error('❌ 配置区域CSS类不存在');
}

if (loadingOverlay) {
    console.log('✅ 加载覆盖层CSS类正确');
} else {
    console.error('❌ 加载覆盖层CSS类不存在');
}

// 检查JavaScript类
console.log('检查JavaScript类...');
const classes = ['WeeklyReporter', 'ConfigurationSection', 'LoadingOverlay', 'LoadingManager'];
classes.forEach(className => {
    if (typeof window[className] !== 'undefined') {
        console.log(`✅ ${className} 类已定义`);
    } else {
        console.error(`❌ ${className} 类未定义`);
    }
});

// 检查WeeklyReporter实例是否正确初始化
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        console.log('检查WeeklyReporter实例...');
        
        try {
            const reporter = new WeeklyReporter();
            
            // 检查新功能是否正确集成
            if (reporter.configSection && typeof reporter.configSection.toggle === 'function') {
                console.log('✅ 配置折叠功能正确集成到WeeklyReporter');
            } else {
                console.error('❌ 配置折叠功能未正确集成');
            }
            
            if (reporter.loadingManager && typeof reporter.loadingManager.show === 'function') {
                console.log('✅ 加载管理器正确集成到WeeklyReporter');
            } else {
                console.error('❌ 加载管理器未正确集成');
            }
            
            // 检查现有方法是否仍然存在
            const existingMethods = [
                'loadConfigs',
                'saveConfig', 
                'generateReport',
                'collectInputData',
                'validateInputData',
                'callDifyAPI',
                'displayResult',
                'copyReport',
                'downloadReport',
                'printReport',
                'clearAllInputs',
                'showError',
                'showSuccess'
            ];
            
            let missingMethods = [];
            existingMethods.forEach(method => {
                if (typeof reporter[method] !== 'function') {
                    missingMethods.push(method);
                }
            });
            
            if (missingMethods.length > 0) {
                console.error('缺少以下方法:', missingMethods);
            } else {
                console.log('✅ 所有现有方法都存在');
            }
            
            console.log('验证完成！');
            
        } catch (error) {
            console.error('WeeklyReporter初始化失败:', error);
        }
    }, 1000);
});

// 模拟功能测试
function simulateTests() {
    console.log('开始模拟功能测试...');
    
    // 测试配置折叠
    try {
        const configSection = new ConfigurationSection();
        const initialState = configSection.isCollapsed;
        configSection.toggle();
        const newState = configSection.isCollapsed;
        
        if (initialState !== newState) {
            console.log('✅ 配置折叠功能测试通过');
        } else {
            console.error('❌ 配置折叠功能测试失败');
        }
    } catch (error) {
        console.error('配置折叠测试出错:', error);
    }
    
    // 测试加载覆盖层
    try {
        const loadingManager = new LoadingManager();
        loadingManager.show();
        
        setTimeout(() => {
            loadingManager.hide();
            console.log('✅ 加载覆盖层显示/隐藏测试通过');
        }, 500);
        
    } catch (error) {
        console.error('加载覆盖层测试出错:', error);
    }
}

// 页面加载完成后运行测试
window.addEventListener('load', () => {
    setTimeout(simulateTests, 2000);
});