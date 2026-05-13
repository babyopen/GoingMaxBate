const BusinessPredictOld = {

  // 规则5-⑥：生肖映射表（马=1，蛇=2，龙=3，兔=4，虎=5，牛=6，鼠=7，猪=8，狗=9，鸡=10，猴=11，羊=12）
  NUM_ZODIAC_MAP: {
    1: '马', 2: '蛇', 3: '龙', 4: '兔', 5: '虎', 6: '牛',
    7: '鼠', 8: '猪', 9: '狗', 10: '鸡', 11: '猴', 12: '羊'
  },

  // 传统生肖顺序（鼠=1,牛=2,...,用于UI展示）
  ZODIAC_ORDER: ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'],

  // 规则5-③：区间定义（1区:1-4, 2区:5-8, 3区:9-12）
  ZONES: { 1: [1, 2, 3, 4], 2: [5, 6, 7, 8], 3: [9, 10, 11, 12] },

  // 数字转生肖
  _toZodiac: function(num) {
    return this.NUM_ZODIAC_MAP[num] || '';
  },

  // 规则5-③：获取数字所属区间
  _getZone: function(num) {
    if (num >= 1 && num <= 4) return 1;
    if (num >= 5 && num <= 8) return 2;
    return 3;
  },

  // === 规则5：核心预测函数 ===
  // 规则1：输入为历史开奖数字数组（最近15期），如：[7,6,9,5,1,7,9,0,5,1,7,6]
  predictOldVersion: function(history) {
    // 规则2：号码范围01-12，过滤无效值
    var nums = history.filter(function(n) { return n >= 1 && n <= 12; });
    if (nums.length < 8) return { main: [], backup: [] };

    // 规则3：窗口 - 仅使用最后10期
    var last10 = nums.slice(0, 10);
    // 上期开奖号（规则5-②）
    var prevNum = last10[0] || 0;

    // 规则4：热度定义（在最后10期窗口中统计）
    // 热号≥3次，温号1-2次，冷号0次
    var heatMap = {};
    var warmPool = [];
    var hotPool = [];
    var coldPool = [];
    for (var i = 1; i <= 12; i++) {
      var count = last10.filter(function(n) { return n === i; }).length;
      heatMap[i] = { count: count, level: count >= 3 ? 'hot' : (count >= 1 ? 'warm' : 'cold') };
      if (heatMap[i].level === 'hot') hotPool.push(i);
      else if (heatMap[i].level === 'warm') warmPool.push(i);
      else coldPool.push(i);
    }

    // 规则5-①：提取近10期温号作为主池
    var warmCandidates = warmPool.map(function(n) {
      return { num: n, weight: heatMap[n].count * 10 };
    });

    // 规则5-②：上期开奖号 → ±1、±2、同区、同尾，加权优先
    var inertiaCandidates = [];
    if (prevNum > 0) {
      var prevZone = this._getZone(prevNum);
      // ±1（权重3）、±2（权重2）
      [prevNum - 2, prevNum - 1, prevNum + 1, prevNum + 2].forEach(function(n) {
        if (n >= 1 && n <= 12) {
          var w = Math.abs(n - prevNum) === 1 ? 3 : 2;
          inertiaCandidates.push({ num: n, weight: w });
        }
      });
      // 同尾（权重2）
      var prevTail = prevNum % 10;
      [prevTail, prevTail + 10].filter(function(n) { return n >= 1 && n <= 12 && n !== prevNum; }).forEach(function(n) {
        inertiaCandidates.push({ num: n, weight: 2 });
      });
      // 同区（权重1）
      this.ZONES[prevZone].filter(function(n) { return n !== prevNum; }).forEach(function(n) {
        inertiaCandidates.push({ num: n, weight: 1 });
      });
    }

    // 规则5-③：区间轮转，优先相邻/同区
    var targetZones = [];
    if (prevNum > 0) {
      var pZone = this._getZone(prevNum);
      if (pZone === 1) targetZones = [1, 2];
      else if (pZone === 2) targetZones = [2, 1, 3];
      else targetZones = [3, 2];
    }

    // 合并候选池
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
        finalCandidates[n] = { weight: c.weight + zoneBonus, level: heatMap[n].level };
      } else {
        finalCandidates[n].weight += c.weight;
      }
    }.bind(this));

    // 规则5-④：冷号 - 遗漏5-15期可带1个，>20期不选
    var coldCandidates = coldPool.filter(function(n) {
      return last10.indexOf(n) === -1;
    }).filter(function(n) {
      // 往前追溯到第20期看遗漏
      var missCount = 0;
      for (var j = 0; j < nums.length && j < 20; j++) {
        if (nums[j] === n) break;
        missCount++;
      }
      return missCount >= 5 && missCount <= 15;
    });

    // 规则5-⑤：最终选号（主推4码，备选2码，温≥3，冷≤1）
    var sorted = Object.keys(finalCandidates).map(function(k) {
      return { num: parseInt(k), weight: finalCandidates[k].weight, level: finalCandidates[k].level };
    }).sort(function(a, b) { return b.weight - a.weight; });

    var main = [], backup = [], used = {};

    // 主推：先选3个温号
    var warmUsed = 0;
    for (var a = 0; a < sorted.length && main.length < 3; a++) {
      if (sorted[a].level === 'warm') {
        main.push(sorted[a].num);
        used[sorted[a].num] = true;
        warmUsed++;
      }
    }

    // 温号不足3个，从路属性选入补足
    while (warmUsed < 3 && main.length < 4) {
      for (var b = 0; b < sorted.length && main.length < 4; b++) {
        if (!used[sorted[b].num]) {
          main.push(sorted[b].num);
          used[sorted[b].num] = true;
          warmUsed++;
          break;
        }
      }
      if (warmUsed >= 3) break;
    }

    // 从冷号中补1个（遗漏5-15期），冷≤1
    if (warmUsed >= 3 && coldCandidates.length > 0 && main.length < 4) {
      for (var c = 0; c < coldCandidates.length && main.length < 4; c++) {
        if (!used[coldCandidates[c]]) {
          main.push(coldCandidates[c]);
          used[coldCandidates[c]] = true;
          break;
        }
      }
    }

    // 仍不足4码则从候选池补充
    for (var d = 0; d < sorted.length && main.length < 4; d++) {
      if (!used[sorted[d].num]) {
        main.push(sorted[d].num);
        used[sorted[d].num] = true;
      }
    }

    // 备选2码
    for (var e = 0; e < sorted.length && backup.length < 2; e++) {
      if (!used[sorted[e].num]) backup.push(sorted[e].num);
    }
    warmPool.forEach(function(n) { if (!used[n] && backup.length < 2) backup.push(n); });

    // 规则5-⑥ & 规则6：数字转生肖，输出 { main: [x,x,x,x], backup: [x,x] }
    return {
      main: main.map(function(n) { return this._toZodiac(n); }.bind(this)).filter(Boolean),
      backup: backup.map(function(n) { return this._toZodiac(n); }.bind(this)).filter(Boolean)
    };
  }
};