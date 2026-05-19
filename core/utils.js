const Utils = {
  /**
   * 节流函数（优化高频事件）
   * @param {Function} fn - 要执行的函数
   * @param {number} delay - 节流延迟(ms)
   * @returns {Function} 节流后的函数
   */
  throttle: (fn, delay) => {
    let timer = null;
    return function(...args) {
      if(!timer){
        timer = setTimeout(() => {
          fn.apply(this, args);
          timer = null;
        }, delay);
      }
    }
  },

  /**
   * 防抖函数（优化高频点击）
   * @param {Function} fn - 要执行的函数
   * @param {number} delay - 防抖延迟(ms)
   * @returns {Function} 防抖后的函数
   */
  debounce: (fn, delay) => {
    let timer = null;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    }
  },

  /**
   * 深拷贝对象
   * @param {any} obj - 要拷贝的对象
   * @returns {any} 拷贝后的对象
   */
  deepClone: (obj) => {
    try {
      if(typeof obj !== 'object' || obj === null) {
        return obj;
      }
      if(typeof structuredClone === 'function') {
        return structuredClone(obj);
      }
      return JSON.parse(JSON.stringify(obj));
    } catch(e) {
      console.error('深拷贝失败', e);
      return obj;
    }
  },

  /**
   * 标签值类型转换（解决数字/字符串匹配问题）
   * @param {string|number} value - 标签值
   * @param {string} group - 分组名
   * @returns {string|number} 转换后的值
   */
  formatTagValue: (value, group) => {
    return CONFIG.NUMBER_GROUPS.includes(group) ? Number(value) : value;
  },

  /**
   * 获取安全区顶部高度
   * @returns {number} 安全区高度(px)
   */
  getSafeTop: () => {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-top')) || 0;
  },

  /**
   * 校验筛选方案格式
   * @param {any} item - 要校验的方案对象
   * @returns {boolean} 是否合法
   */
  validateFilterItem: (item) => {
    return item && 
      typeof item === 'object' && 
      typeof item.name === 'string' && 
      item.selected && typeof item.selected === 'object' &&
      Array.isArray(item.excluded);
  },

  /**
   * 生成DocumentFragment优化DOM渲染
   * @param {Array} list - 要渲染的列表
   * @param {Function} renderItem - 单个元素渲染函数
   * @returns {DocumentFragment} 生成的文档片段
   */
  createFragment: (list, renderItem) => {
    const fragment = document.createDocumentFragment();
    list.forEach((item, index) => {
      const el = renderItem(item, index);
      if(el) fragment.appendChild(el);
    });
    return fragment;
  },

  calcMiss: (lastIdx, total, latestExpect, list) => {
    if(lastIdx === -1) return total;
    const appearItem = list[lastIdx];
    const appearExpect = Number(appearItem?.expect || 0);
    return latestExpect - appearExpect;
  },

  getRangeCategory: (te) => {
    if(te <= 9) return '1-9';
    if(te <= 19) return '10-19';
    if(te <= 29) return '20-29';
    if(te <= 39) return '30-39';
    return '40-49';
  },

  /**
   * 缓存计算结果，避免重复计算
   * @param {string} key - 缓存键
   * @param {Function} fn - 计算函数
   * @param {Object} cache - 缓存对象
   * @returns {any} 计算结果
   */
  memoize: (key, fn, cache) => {
    if(cache[key] !== undefined) return cache[key];
    const result = fn();
    cache[key] = result;
    return result;
  },

  /**
   * 批量检查数组元素是否存在
   * @param {Array} arr - 源数组
   * @param {Array} values - 要检查的值
   * @returns {Object} 存在性映射
   */
  buildLookupMap: (arr) => {
    const map = {};
    for(let i = 0; i < arr.length; i++) {
      map[arr[i]] = true;
    }
    return map;
  },

  /**
   * 获取数组前N个元素
   * @param {Array} arr - 数组
   * @param {number} n - 数量
   * @returns {Array} 前N个元素
   */
  takeFirst: (arr, n) => {
    const result = [];
    for(let i = 0; i < Math.min(n, arr.length); i++) {
      result.push(arr[i]);
    }
    return result;
  }
};
