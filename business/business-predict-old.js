const BusinessPredictOld = {

  // 生肖与数字映射表（1-12）
  // 顺序：鼠=1, 牛=2, 虎=3, 兔=4, 龙=5, 蛇=6, 马=7, 羊=8, 猴=9, 鸡=10, 狗=11, 猪=12
  ZODIAC_ORDER: ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'],

  // 数字转生肖映射表（马=1，蛇=2，龙=3，兔=4，虎=5，牛=6，鼠=7，猪=8，狗=9，鸡=10，猴=11，羊=12）
  NUM_ZODIAC_MAP: {
    1: '马', 2: '蛇', 3: '龙', 4: '兔', 5: '虎', 6: '牛',
    7: '鼠', 8: '猪', 9: '狗', 10: '鸡', 11: '猴', 12: '羊'
  },

  // 区间定义
  ZONES: { 1: [1, 2, 3, 4], 2: [5, 6, 7, 8], 3: [9, 10, 11, 12] },

  // 生肖转数字（1-12）
  _toNum: function(zodiac) {
    var idx = this.ZODIAC_ORDER.indexOf(zodiac);
    return idx !== -1 ? idx + 1 : 0;
  },

  // 数字转生肖
  _toZodiac: function(num) {
    return this.NUM_ZODIAC_MAP[num] || '';
  },

  // 获取数字所属区间
  _getZone: function(num) {
    if (num >= 1 && num <= 4) return 1;
    if (num >= 5 && num <= 8) return 2;
    return 3;
  },

  // === 核心预测函数 ===
  predictOldVersion: function(history) {
    if (!history || history.length < 10) return { main: [], backup: [] };

    // 数据窗口：只看最近 12-24 期
    var windowLen = Math.min(24, Math.max(12, history.length));
    var nums = history.slice(0, windowLen).map(function(z) {
      return this._toNum(z);
    }.bind(this)).filter(function(n) { return n > 0; });

    // 热度窗口：近 10 期
    var heatWindow = nums.slice(0, 10);
    var prevNum = nums[0] || 0; // 上期开奖号

    // 热度定义
    var heatMap = {};
    var warmPool = []; // 温号池（1-2次）
    var hotPool = [];  // 热号池（≥3次）
    var coldPool = []; // 冷号池（0次）
    for (var i = 1; i <= 12; i++) {
      var count = heatWindow.filter(function(n) { return n === i; }).length;
      heatMap[i] = { count: count, level: count >= 3 ? 'hot' : (count >= 1 ? 'warm' : 'cold') };
      if (heatMap[i].level === 'hot') hotPool.push(i);
      else if (heatMap[i].level === 'warm') warmPool.push(i);
      else coldPool.push(i);
    }

    // 规则4-1：优先温号闭环（近几期反复开出的温号组）
    var warmCandidates = warmPool.map(function(n) {
      return { num: n, weight: heatMap[n].count * 10 };
    });

    // 规则4-3：回踩惯性（上期开号 → ±1、±2、同尾、同区温号必带）
    var inertiaCandidates = [];
    if (prevNum > 0) {
      var prevZone = this._getZone(prevNum);
      // ±1、±2
      [prevNum - 2, prevNum - 1, prevNum + 1, prevNum + 2].forEach(function(n) {
        if (n >= 1 && n <= 12) {
          var w = Math.abs(n - prevNum) === 1 ? 3 : 2;
          inertiaCandidates.push({ num: n, weight: w });
        }
      });
      // 同尾
      var prevTail = prevNum % 10;
      [prevTail, prevTail + 10].filter(function(n) { return n >= 1 && n <= 12 && n !== prevNum; }).forEach(function(n) {
        inertiaCandidates.push({ num: n, weight: 2 });
      });
      // 同区
      this.ZONES[prevZone].filter(function(n) { return n !== prevNum; }).forEach(function(n) {
        inertiaCandidates.push({ num: n, weight: 1 });
      });
    }

    // 规则4-2：区间轮转（上期开哪区 → 下期优先相邻区/回踩同区）
    var targetZones = [];
    if (prevNum > 0) {
      var pZone = this._getZone(prevNum);
      if (pZone === 1) targetZones = [1, 2];
      else if (pZone === 2) targetZones = [2, 1, 3];
      else targetZones = [3, 2];
    }

    // 合并候选池，优先温号 + 区间轮转加权
    var finalCandidates = {};
    warmCandidates.forEach(function(c) {
      var n = c.num;
      var zoneBonus = targetZones.indexOf(this._getZone(n)) !== -1 ? 5 : 0;
      finalCandidates[n] = { weight: c.weight + zoneBonus, level: 'warm' };
    }.bind(this));

    inertiaCandidates.forEach(function(c) {
      var n = c.num;
      if (!finalCandidates[n]) {
        var zoneBonus = targetZones.indexOf(this._getZone(n)) !== -1 ? 3 : 0;
        finalCandidates[n] = { weight: c.weight + zoneBonus, level: 'inertia' };
      } else {
        finalCandidates[n].weight += c.weight;
      }
    }.bind(this));

    // 规则4-4：冷号轻补（遗漏 5-15 期可带 1 个，>20 期不选）
    var coldCandidates = coldPool.filter(function(n) {
      var missCount = heatWindow.filter(function(x) { return x === n; }).length === 0 ? heatWindow.length : 0;
      return missCount >= 5 && missCount <= 15;
    });

    // 规则5：最终选号（主推4码，温号为主+1个轻冷）
    var sorted = Object.keys(finalCandidates).map(function(k) {
      return { num: parseInt(k), weight: finalCandidates[k].weight, level: finalCandidates[k].level };
    }).sort(function(a, b) { return b.weight - a.weight; });

    var main = [], backup = [], used = {};

    // 主推4码：优先温号（至少3个温号）
    var warmUsed = 0;
    for (var i = 0; i < sorted.length; i++) {
      if (main.length >= 4) break;
      var c = sorted[i];
      if (c.level === 'warm' || c.level === 'inertia') {
        main.push(c.num);
        used[c.num] = true;
        if (c.level === 'warm') warmUsed++;
      }
    }

    // 温号不足3个，从冷号中补1个（遗漏5-15期）
    if (warmUsed < 3 && coldCandidates.length > 0) {
      for (var j = 0; j < coldCandidates.length && main.length < 4; j++) {
        if (!used[coldCandidates[j]]) {
          main.push(coldCandidates[j]);
          used[coldCandidates[j]] = true;
          break;
        }
      }
    }

    // 备选2码：回踩/补位
    for (var k = 0; k < sorted.length && backup.length < 2; k++) {
      if (!used[sorted[k].num]) backup.push(sorted[k].num);
    }
    // 仍不足则补温号
    warmPool.forEach(function(n) { if (!used[n] && backup.length < 2) backup.push(n); });

    // 数字转生肖
    return {
      main: main.map(function(n) { return this._toZodiac(n); }.bind(this)).filter(Boolean),
      backup: backup.map(function(n) { return this._toZodiac(n); }.bind(this)).filter(Boolean)
    };
  }
};

// 测试调用示例：
// var history = ['马', '蛇', '龙', '兔', '虎', '牛', '鼠', '猪', '狗', '鸡', '猴', '羊', '马', '蛇', '龙'];
// var result = BusinessPredictOld.predictOldVersion(history);
// console.log('主推:', result.main); // 如：['蛇', '龙', '兔', '马']
// console.log('备选:', result.backup); // 如：['虎', '牛']
