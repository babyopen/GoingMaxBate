const BusinessUltimate = {

  CYCLE_CONFIG: {
    V1: {
      name: 'V1冷号周期',
      mainPool: [2, 3, 6, 8, 11, 12],
      coldPool: [1, 4, 5, 7, 9, 10],
      transitionPool: [1, 4],
      cycleChain: [2, 6, 12, 8, 3, 11],
      maxMiss: 6,
      averageHitRate: '82%-83%'
    },
    V2: {
      name: 'V2热号周期',
      mainPool: [1, 4, 5, 7, 9, 10],
      coldPool: [2, 3, 6, 8, 11, 12],
      transitionPool: [3, 6],
      cycleChain: [1, 5, 7, 9, 4, 10],
      maxMiss: 5,
      averageHitRate: '86%-87%'
    }
  },

  CYCLE_STAGES: {
    V1_STABLE: 'V1稳定运行期',
    V2_STABLE: 'V2稳定运行期',
    TRANSITION: '过渡混沌期',
    INSUFFICIENT_DATA: '数据不足无法判断'
  },

  RISK_LEVELS: {
    LOW: '低风险',
    MEDIUM: '中风险',
    HIGH: '极高风险',
    UNKNOWN: '未知风险'
  },

  NUM_TO_ZODIAC: {
    1: '马', 2: '蛇', 3: '龙', 4: '兔', 5: '虎', 6: '牛',
    7: '鼠', 8: '猪', 9: '狗', 10: '鸡', 11: '猴', 12: '羊'
  },

  ZODIAC_TO_NUM: {},

  init: function() {
    var self = this;
    Object.keys(this.NUM_TO_ZODIAC).forEach(function(num) {
      self.ZODIAC_TO_NUM[self.NUM_TO_ZODIAC[num]] = Number(num);
    });
  },

  _getZodiacByNum: function(num) {
    return this.NUM_TO_ZODIAC[num] || '';
  },

  _getNumByZodiac: function(zodiac) {
    return this.ZODIAC_TO_NUM[zodiac] || 0;
  },

  countFrequency: function(history, n) {
    var freq = {};
    for (var i = 1; i <= 12; i++) freq[i] = 0;
    var recent = history.slice(-n);
    recent.forEach(function(item) {
      if (item.number >= 1 && item.number <= 12) {
        freq[item.number]++;
      }
    });
    return freq;
  },

  getNextInCycle: function(current, cycleChain) {
    var index = cycleChain.indexOf(current);
    return index === -1 ? null : cycleChain[(index + 1) % cycleChain.length];
  },

  checkConsecutive: function(history, pool, n) {
    if (history.length < n) return false;
    var recent = history.slice(-n);
    return recent.every(function(item) { return pool.indexOf(item.number) !== -1; });
  },

  getRecentMainNumbers: function(history, mainPool, n) {
    n = n || 3;
    return history
      .slice(-n)
      .map(function(item) { return item.number; })
      .filter(function(num) { return mainPool.indexOf(num) !== -1; })
      .reverse();
  },

  WINDOW_SIZE: 11,
  AUX_WINDOW_SIZE: 24,
  DOWN_WEIGHT_LIMIT: 3,
  COOLING_PERIOD: 2,

  getCurrent12Freq: function(history) {
    return this.countFrequency(history, this.WINDOW_SIZE);
  },

  getCurrent24Freq: function(history) {
    return this.countFrequency(history, this.AUX_WINDOW_SIZE);
  },

  getNext12Freq: function(history) {
    if (history.length <= this.WINDOW_SIZE) {
      return this.getCurrent12Freq(history);
    }
    var newHistory = history.slice(1);
    return this.countFrequency(newHistory, this.WINDOW_SIZE);
  },

  getNumberPositions: function(history, num, windowSize) {
    var positions = [];
    var recent = history.slice(-windowSize);
    for (var i = 0; i < recent.length; i++) {
      if (recent[i].number === num) {
        positions.push(recent.length - 1 - i);
      }
    }
    return positions;
  },

  getCoolingInfo: function() {
    return Storage.get('ultimateCooling', {});
  },

  saveCoolingInfo: function(coolingInfo) {
    Storage.set('ultimateCooling', coolingInfo);
  },

  updateCoolingInfo: function(history, blackList) {
    var cooling = this.getCoolingInfo();
    var sortedHistory = history.slice().sort(function(a, b) { return a.issue - b.issue; });

    var i, num, positions, count;
    for (num = 1; num <= 12; num++) {
      positions = this.getNumberPositions(history, num, this.WINDOW_SIZE);
      count = positions.length;

      if (count >= 3) {
        if (!cooling[num]) cooling[num] = { count: 0, coolingCount: 0 };
        cooling[num].count = count;
        cooling[num].lastSeen = sortedHistory.length > 0 ? sortedHistory[sortedHistory.length - 1].issue : 0;
        if (blackList.indexOf(num) !== -1) {
          cooling[num].coolingCount = 0;
        }
      } else {
        if (cooling[num]) {
          cooling[num].coolingCount = (cooling[num].coolingCount || 0) + 1;
        }
      }
    }

    this.saveCoolingInfo(cooling);
    return cooling;
  },

  getDownWeightBlackList: function(history) {
    var sortedHistory = history.slice().sort(function(a, b) { return a.issue - b.issue; });
    var currFreq12 = this.getCurrent12Freq(history);
    var nextFreq12 = this.getNext12Freq(history);
    var currFreq24 = this.getCurrent24Freq(history);
    var cooling = this.getCoolingInfo();
    var blackList = [];
    var preReleaseList = [];

    for (var num = 1; num <= 12; num++) {
      var curr12 = currFreq12[num] || 0;
      var next12 = nextFreq12[num] || 0;
      var curr24 = currFreq24[num] || 0;

      if (curr12 >= this.DOWN_WEIGHT_LIMIT) {
        if (next12 >= 3) {
          blackList.push(num);
        } else if (curr12 >= 4) {
          blackList.push(num);
        } else if (next12 <= 1) {
          preReleaseList.push(num);
        } else {
          preReleaseList.push(num);
        }
      }
    }

    for (var i = 0; i < preReleaseList.length; i++) {
      var num = preReleaseList[i];
      if (cooling[num] && cooling[num].coolingCount >= this.COOLING_PERIOD) {
      } else if (!cooling[num] || cooling[num].coolingCount < this.COOLING_PERIOD) {
        blackList.push(num);
      }
    }

    this.updateCoolingInfo(history, blackList);

    return blackList;
  },

  _isAtCriticalEdge: function(history, num, windowSize) {
    var positions = this.getNumberPositions(history, num, windowSize);
    if (positions.length < 3) return false;

    positions.sort(function(a, b) { return a - b; });
    var earliestPos = positions[0];
    return earliestPos >= windowSize - 2;
  },

  _isIntensivePattern: function(history, num, windowSize) {
    var positions = this.getNumberPositions(history, num, windowSize);
    if (positions.length < 3) return false;

    positions.sort(function(a, b) { return a - b; });
    var span = positions[positions.length - 1] - positions[0];
    return span <= 5;
  },

  filterByWeight: function(history, candidateNums, config) {
    var blackList = this.getDownWeightBlackList(history);
    var sortedHistory = history.slice().sort(function(a, b) { return a.issue - b.issue; });
    var currFreq12 = this.getCurrent12Freq(history);
    var nextFreq12 = this.getNext12Freq(history);

    var main = [];
    var backup = [];
    var silent = [];
    var i, num;

    for (i = 0; i < candidateNums.length; i++) {
      num = candidateNums[i];
      if (blackList.indexOf(num) !== -1) {
        continue;
      }

      var next12 = nextFreq12[num] || 0;
      if (next12 >= 2) {
        main.push(num);
      } else if (next12 === 1) {
        backup.push(num);
      } else {
        main.push(num);
      }
    }

    if (main.length < 4) {
      var chain = config.cycleChain;
      for (i = 0; i < chain.length && main.length < 4; i++) {
        num = chain[i];
        if (main.indexOf(num) === -1 && blackList.indexOf(num) === -1 && backup.indexOf(num) === -1) {
          var next12 = nextFreq12[num] || 0;
          if (next12 >= 2 || next12 === 0) {
            main.push(num);
          }
        }
      }
    }

    if (main.length < 4) {
      for (i = 0; i < backup.length && main.length < 4; i++) {
        num = backup[i];
        if (main.indexOf(num) === -1) {
          main.push(num);
          backup.splice(i, 1);
          i--;
        }
      }
    }

    if (main.length + backup.length < 4) {
      var chain = config.cycleChain;
      for (i = 0; i < chain.length; i++) {
        num = chain[i];
        if (main.indexOf(num) === -1 && blackList.indexOf(num) === -1 && backup.indexOf(num) === -1) {
          var next12 = nextFreq12[num] || 0;
          if (next12 >= 1) {
            backup.push(num);
          }
          if (main.length + backup.length >= 6) break;
        }
      }
    }

    return {
      main: main.slice(0, 4),
      backup: backup.slice(0, 2),
      downWeight: blackList,
      gradeInfo: { main: main.length, backup: backup.length }
    };
  },

  detectCycleStage: function(history) {
    var sortedHistory = history.slice().sort(function(a, b) { return a.issue - b.issue; });

    if (sortedHistory.length < 15) {
      return {
        stage: this.CYCLE_STAGES.INSUFFICIENT_DATA,
        signals: [],
        advice: '历史数据仅有' + sortedHistory.length + '期，需要至少15期才能准确判断周期',
        requiredData: 15 - sortedHistory.length
      };
    }

    var freq20 = this.countFrequency(sortedHistory, 15);
    var v1Config = this.CYCLE_CONFIG.V1;
    var v2Config = this.CYCLE_CONFIG.V2;

    var v1Count = 0;
    var v2Count = 0;
    v1Config.mainPool.forEach(function(num) { v1Count += freq20[num]; });
    v2Config.mainPool.forEach(function(num) { v2Count += freq20[num]; });

    var cons3V1 = this.checkConsecutive(sortedHistory, v1Config.mainPool, 3);
    var cons3V2 = this.checkConsecutive(sortedHistory, v2Config.mainPool, 3);
    var cons2V1 = this.checkConsecutive(sortedHistory, v1Config.mainPool, 2);
    var cons2V2 = this.checkConsecutive(sortedHistory, v2Config.mainPool, 2);

    var recent4 = sortedHistory.slice(-4).map(function(item) { return item.number; });
    var chainValidV1 = 0;
    var chainValidV2 = 0;
    for (var i = 0; i < recent4.length - 1; i++) {
      if (v1Config.mainPool.indexOf(recent4[i]) !== -1 && this.getNextInCycle(recent4[i], v1Config.cycleChain) === recent4[i + 1]) {
        chainValidV1++;
      }
      if (v2Config.mainPool.indexOf(recent4[i]) !== -1 && this.getNextInCycle(recent4[i], v2Config.cycleChain) === recent4[i + 1]) {
        chainValidV2++;
      }
    }

    var dominantCycle = null;

    if (v2Count >= v1Count + 1) {
      if (cons3V2 || cons2V2 || chainValidV2 >= 1) dominantCycle = v2Config;
    }
    if (v1Count >= v2Count + 1) {
      if (cons3V1 || cons2V1 || chainValidV1 >= 1) dominantCycle = v1Config;
    }

    if (Math.abs(v1Count - v2Count) <= 1) {
      if (cons3V2 || (cons2V2 && chainValidV2 >= 1)) dominantCycle = v2Config;
      else if (cons3V1 || (cons2V1 && chainValidV1 >= 1)) dominantCycle = v1Config;
    }

    if (!dominantCycle) {
      return {
        stage: this.CYCLE_STAGES.TRANSITION,
        dominantCycle: '双池并行',
        transitionSignals: ['近20期出号持平+近期无连续同池+循环链断裂，真实混沌期'],
        v1MainCount: v1Count,
        v2MainCount: v2Count
      };
    }

    var otherCycle = dominantCycle === v1Config ? v2Config : v1Config;

    var newCycleSignals = [];
    if (this.checkConsecutive(sortedHistory, otherCycle.mainPool, 3)) {
      newCycleSignals.push('连续3期开出新周期号码');
    }
    if (this.checkConsecutive(sortedHistory, dominantCycle.coldPool, 3)) {
      newCycleSignals.push('原周期连续3期空号');
    }

    if (newCycleSignals.length >= 1) {
      return {
        stage: otherCycle === v1Config ? this.CYCLE_STAGES.V1_STABLE : this.CYCLE_STAGES.V2_STABLE,
        dominantCycle: otherCycle.name,
        v1MainCount: v1Count,
        v2MainCount: v2Count
      };
    }

    return {
      stage: dominantCycle === v1Config ? this.CYCLE_STAGES.V1_STABLE : this.CYCLE_STAGES.V2_STABLE,
      dominantCycle: dominantCycle.name,
      v1MainCount: v1Count,
      v2MainCount: v2Count,
      chainStatus: chainValidV1 > chainValidV2 ? 'V1循环链正常' : 'V2循环链正常'
    };
  },

  checkReHeatAndRelock: function(history) {
    var currFreq = this.getCurrent12Freq(history);
    var cooling = this.getCoolingInfo();
    var updated = false;
    var sortedHistory = history.slice().sort(function(a, b) { return a.issue - b.issue; });

    for (var num = 1; num <= 12; num++) {
      if (cooling[num]) {
        var currentCount = currFreq[num] || 0;
        if (currentCount >= 3 && !cooling[num].reLocked) {
          cooling[num].reLocked = true;
          cooling[num].reLockIssue = sortedHistory.length > 0 ? sortedHistory[sortedHistory.length - 1].issue : 0;
          updated = true;
        }
      }
    }

    if (updated) {
      this.saveCoolingInfo(cooling);
    }
    return cooling;
  },

  generateStableNumbers: function(history, config) {
    var sortedHistory = history.slice().sort(function(a, b) { return a.issue - b.issue; });
    var cycleChain = config.cycleChain;

    var recentMainNums = this.getRecentMainNumbers(sortedHistory, config.mainPool, 5);

    var candidate = [];

    if (recentMainNums.length >= 2) {
      recentMainNums.forEach(function(num) {
        var idx = cycleChain.indexOf(num);
        if (idx !== -1) {
          var nextIdx = (idx + 1) % cycleChain.length;
          candidate.push(cycleChain[nextIdx]);
        }
      });
    } else if (recentMainNums.length === 1) {
      var idx = cycleChain.indexOf(recentMainNums[0]);
      if (idx !== -1) {
        var nextIdx = (idx + 1) % cycleChain.length;
        candidate.push(cycleChain[nextIdx]);
        var nextIdx2 = (nextIdx + 1) % cycleChain.length;
        candidate.push(cycleChain[nextIdx2]);
      }
    }

    if (candidate.length > 0) {
      var startIdx = cycleChain.indexOf(candidate[0]);
      if (startIdx !== -1) {
        for (var i = 1; i <= 2; i++) {
          var idx = (startIdx + i) % cycleChain.length;
          if (candidate.indexOf(cycleChain[idx]) === -1) {
            candidate.push(cycleChain[idx]);
          }
        }
      }
    }

    if (candidate.length > 0) {
      candidate = candidate.filter(function(num, index, self) {
        return self.indexOf(num) === index;
      });
    }

    var filterRes = this.filterByWeight(sortedHistory, candidate, config);
    var result = filterRes.main;
    var backup = filterRes.backup;

    if (result.length < 4 && backup.length > 0) {
      var toAdd = 4 - result.length;
      for (var k = 0; k < toAdd && k < backup.length; k++) {
        result.push(backup[k]);
      }
      backup = backup.slice(toAdd);
    }

    var otherConfig = config.name === 'V1' ? this.CYCLE_CONFIG.V2 : this.CYCLE_CONFIG.V1;
    var otherRecentNums = this.getRecentMainNumbers(sortedHistory, otherConfig.mainPool, 2);
    var crossPoolCandidate = [];

    otherRecentNums.forEach(function(num) {
      var idx = otherConfig.cycleChain.indexOf(num);
      if (idx !== -1) {
        var nextIdx = (idx + 1) % otherConfig.cycleChain.length;
        crossPoolCandidate.push(otherConfig.cycleChain[nextIdx]);
      }
    });

    if (crossPoolCandidate.length > 0) {
      crossPoolCandidate = crossPoolCandidate.filter(function(num) {
        return result.indexOf(num) === -1 && 
               backup.indexOf(num) === -1 && 
               filterRes.downWeight.indexOf(num) === -1;
      });
      backup = backup.concat(crossPoolCandidate.slice(0, 2));
    }

    return {
      mainNumbers: result.slice(0, 4),
      alternativeNumbers: backup.slice(0, 2),
      configUsed: config.name,
      downWeightList: filterRes.downWeight
    };
  },

  generateTransitionNumbers: function(history) {
    var sortedHistory = history.slice().sort(function(a, b) { return a.issue - b.issue; });

    var oldPoolNumbers = this.getRecentMainNumbers(sortedHistory, this.CYCLE_CONFIG.V1.mainPool, 3);
    var newPoolNumbers = this.getRecentMainNumbers(sortedHistory, this.CYCLE_CONFIG.V2.mainPool, 3);

    var candidate = [];

    var oldHot = oldPoolNumbers[0] || this.CYCLE_CONFIG.V1.mainPool[0];
    var newHot = newPoolNumbers[0] || this.CYCLE_CONFIG.V2.mainPool[0];

    if (oldPoolNumbers.length > 0) {
      var idx = this.CYCLE_CONFIG.V1.cycleChain.indexOf(oldPoolNumbers[0]);
      if (idx !== -1) {
        var nextIdx = (idx + 1) % this.CYCLE_CONFIG.V1.cycleChain.length;
        candidate.push(this.CYCLE_CONFIG.V1.cycleChain[nextIdx]);
      }
    }

    if (newPoolNumbers.length > 0) {
      var idx = this.CYCLE_CONFIG.V2.cycleChain.indexOf(newPoolNumbers[0]);
      if (idx !== -1) {
        var nextIdx = (idx + 1) % this.CYCLE_CONFIG.V2.cycleChain.length;
        candidate.push(this.CYCLE_CONFIG.V2.cycleChain[nextIdx]);
      }
    }

    if (candidate.length > 0) {
      candidate = candidate.filter(function(num, index, self) {
        return self.indexOf(num) === index;
      });
    }

    if (candidate.length < 2) {
      var allChains = this.CYCLE_CONFIG.V1.cycleChain.concat(this.CYCLE_CONFIG.V2.cycleChain);
      for (var i = 0; i < allChains.length && candidate.length < 2; i++) {
        if (candidate.indexOf(allChains[i]) === -1) {
          candidate.push(allChains[i]);
        }
      }
    }

    var filterRes = this.filterByWeight(sortedHistory, candidate, this.CYCLE_CONFIG.V2);

    if (filterRes.main.length === 0) {
      return {
        transitionNumbers: [],
        note: '过渡期仅推荐非降权2码',
        downWeightList: filterRes.downWeight
      };
    }

    return {
      transitionNumbers: filterRes.main.sort(function(a, b) { return a - b; }),
      oldPoolHot: oldHot,
      newPoolHot: newHot,
      note: '过渡期仅推荐非降权2码',
      downWeightList: filterRes.downWeight
    };
  },

  generateOperationAdvice: function(stage) {
    switch (stage) {
      case this.CYCLE_STAGES.V1_STABLE:
      case this.CYCLE_STAGES.V2_STABLE:
        var maxMiss = stage === this.CYCLE_STAGES.V1_STABLE ? '6' : '5';
        return {
          riskLevel: this.RISK_LEVELS.LOW,
          mustDo: [
            '使用对应周期的稳定期算法生成主推4码',
            '按"2个热号+2个顺位号"的规则投注',
            '过渡区号码作为备选'
          ],
          forbidden: [
            '不要重仓冷门区号码',
            '不要追超过' + maxMiss + '期的深冷号'
          ]
        };

      case this.CYCLE_STAGES.TRANSITION:
        return {
          riskLevel: this.RISK_LEVELS.HIGH,
          mustDo: [
            '优先空仓观望，仅小资金试水',
            '只买过渡期2码，不投4码',
            '投注金额降至平时的20%以下',
            '最多连追3期，不中立即停手'
          ],
          forbidden: [
            '绝对不要使用稳定期算法',
            '不要追任何顺位号',
            '不要买超过2个号码',
            '禁止重仓操作'
          ]
        };

      case this.CYCLE_STAGES.INSUFFICIENT_DATA:
      default:
        return {
          riskLevel: this.RISK_LEVELS.UNKNOWN,
          mustDo: ['补充至少20期历史数据后再进行分析'],
          forbidden: ['不要盲目投注，数据不足时任何推荐都不可靠']
        };
    }
  },

  generateFullReport: function(history) {
    var cycleStatus = this.detectCycleStage(history);
    var advice = this.generateOperationAdvice(cycleStatus.stage);

    this.checkReHeatAndRelock(history);

    var numbersResult = null;

    if (cycleStatus.stage !== this.CYCLE_STAGES.INSUFFICIENT_DATA) {
      if (cycleStatus.stage === this.CYCLE_STAGES.V1_STABLE) {
        numbersResult = this.generateStableNumbers(history, this.CYCLE_CONFIG.V1);
      } else if (cycleStatus.stage === this.CYCLE_STAGES.V2_STABLE) {
        numbersResult = this.generateStableNumbers(history, this.CYCLE_CONFIG.V2);
      } else if (cycleStatus.stage === this.CYCLE_STAGES.TRANSITION) {
        numbersResult = this.generateTransitionNumbers(history);
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      currentStage: cycleStatus.stage,
      riskLevel: advice.riskLevel,
      cycleStatus: cycleStatus,
      numbers: numbersResult,
      advice: advice,
      quickNote: '十二号码分两池，八十周期轮流转。两热两顺推四码，过渡一旧加一新。'
    };
  },

  historyDataToUltimateFormat: function(historyData) {
    var result = [];
    for (var i = 0; i < historyData.length; i++) {
      var item = historyData[i];
      var zodArrRaw = (item.zodiac || ',,,,,,,,,,,,').split(',');
      var zodArr = zodArrRaw.map(function(z) {
        return CONFIG.ANALYSIS.ZODIAC_TRAD_TO_SIMP[z] || z;
      });
      var zod = zodArr[6] || '';
      var num = this.ZODIAC_TO_NUM[zod];
      if (num) {
        result.push({
          issue: Number(item.expect || 0),
          number: num
        });
      }
    }
    result.sort(function(a, b) { return a.issue - b.issue; });
    return result;
  },

  formatNumbersToDisplay: function(numbers) {
    return numbers.map(function(num) {
      return { num: num, zodiac: BusinessUltimate._getZodiacByNum(num) };
    });
  },

  BACKTEST_KEY: 'ultimateBacktest',
  RECOMMEND_HISTORY_KEY: 'ultimateRecommendHistory',

  getRecommendHistory: function() {
    return Storage.get(this.RECOMMEND_HISTORY_KEY, []);
  },

  saveRecommendHistory: function(issue, numbers) {
    var history = this.getRecommendHistory();
    history.unshift({ issue: issue, numbers: numbers, timestamp: Date.now() });
    if (history.length > 50) history = history.slice(0, 50);
    Storage.set(this.RECOMMEND_HISTORY_KEY, history);
  },

  isNumberDowngraded: function(num, windowSize) {
    windowSize = windowSize || 12;
    var history = this.getRecommendHistory();
    var recentHistory = history.slice(0, windowSize);
    var count = 0;
    for (var i = 0; i < recentHistory.length; i++) {
      if (recentHistory[i].numbers.indexOf(num) !== -1) {
        count++;
        if (count >= 3) return true;
      }
    }
    return false;
  },

  runBacktest: function(historyData) {
    if (!historyData || historyData.length < 25) return null;

    var records = [];
    var maxBacktest = Math.min(40, historyData.length - 15);
    var self = this;

    console.log('═══════════════════════════════════════');
    console.log('[回测开始] 总数据量: ' + historyData.length + '期, 最大回测: ' + maxBacktest + '期');
    console.log('═══════════════════════════════════════');

    for (var i = 0; i < maxBacktest; i++) {
      var predictHistory = historyData.slice(0, historyData.length - i - 1);
      if (predictHistory.length < 15) break;

      var report = this.generateFullReport(predictHistory);

      if (!report || !report.numbers) continue;

      var targetItem = historyData[historyData.length - i - 1];
      if (!targetItem) continue;

      var predictedNums = report.numbers.mainNumbers || report.numbers.transitionNumbers || [];
      var actualNum = targetItem.number;
      var predictIssue = targetItem.issue;
      var blackList = report.numbers.downWeightList || [];

      var hitRank = 0;
      for (var j = 0; j < predictedNums.length; j++) {
        if (predictedNums[j] === actualNum) {
          hitRank = j + 1;
          break;
        }
      }

      var actualInBlackList = (blackList.indexOf(actualNum) !== -1);
      var actualZodiac = this._getZodiacByNum(actualNum);

      records.push({
        expect: predictIssue,
        topN: predictedNums.map(function(n) { return self._getZodiacByNum(n); }),
        actualZodiac: actualZodiac,
        hit: hitRank > 0,
        hitRank: hitRank,
        stage: report.currentStage,
        blackListCount: blackList.length,
        actualInBlackList: actualInBlackList
      });

      console.log('');
      console.log('┌──────────────────────────────────────────────┐');
      console.log('│ 第' + predictIssue + '期回测详情');
      console.log('├──────────────────────────────────────────────┤');
      console.log('│ 周期阶段: ' + report.currentStage);
      console.log('│ 使用历史: ' + predictHistory.length + '期');
      console.log('│ 推荐号码: [' + predictedNums.join(',') + '] → [' + predictedNums.map(function(n) { return self._getZodiacByNum(n); }).join(', ') + ']');
      console.log('│ 实际开奖: ' + actualNum + '(' + actualZodiac + ')');
      console.log('│ 降权黑名单: [' + blackList.join(',') + '] (' + blackList.length + '个)');
      console.log('│ 命中结果: ' + (hitRank > 0 ? '✅ 第' + hitRank + '名' : '❌ 未命中'));
      if (!hitRank && actualInBlackList) {
        console.log('│ ⚠️ 未命中原因: 实际号码在降权黑名单中!');
      } else if (!hitRank && !actualInBlackList) {
        console.log('│ ⚠️ 未命中原因: 实际号码不在推荐列表中');
      }
      console.log('└──────────────────────────────────────────────┘');
    }

    if (!records.length) return null;

    var hits = 0;
    var top1Hits = 0;
    var top2Hits = 0;
    var top3Hits = 0;
    var missInBlackList = 0;
    var missNotInRecommend = 0;
    
    records.forEach(function(r) {
      if (r.hit) {
        hits++;
        if (r.hitRank === 1) top1Hits++;
        if (r.hitRank <= 2) top2Hits++;
        if (r.hitRank <= 3) top3Hits++;
      } else {
        if (r.actualInBlackList) missInBlackList++;
        else missNotInRecommend++;
      }
    });

    var summary = {
      total: records.length,
      hits: hits,
      hitRate: Math.round((hits / records.length) * 100),
      top1Hits: top1Hits,
      top2Hits: top2Hits,
      top3Hits: top3Hits,
      missInBlackList: missInBlackList,
      missNotInRecommend: missNotInRecommend,
      records: records
    };

    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('[回测汇总]');
    console.log('═══════════════════════════════════════');
    console.log('总测试: ' + summary.total + '期');
    console.log('命中次数: ' + summary.hits + '次');
    console.log('命中率: ' + summary.hitRate + '%');
    console.log('🥇第1名: ' + summary.top1Hits + '次 (' + Math.round(summary.top1Hits / summary.total * 100) + '%)');
    console.log('🥈前2名: ' + summary.top2Hits + '次 (' + Math.round(summary.top2Hits / summary.total * 100) + '%)');
    console.log('🥉前3名: ' + summary.top3Hits + '次 (' + Math.round(summary.top3Hits / summary.total * 100) + '%)');
    console.log('');
    console.log('未命中分析:');
    console.log('  因降权错失: ' + summary.missInBlackList + '次 (' + Math.round(summary.missInBlackList / (summary.total - summary.hits) * 100) + '%)');
    console.log('  未推荐到: ' + summary.missNotInRecommend + '次 (' + Math.round(summary.missNotInRecommend / (summary.total - summary.hits) * 100) + '%)');
    console.log('═══════════════════════════════════════');

    Storage.set(this.BACKTEST_KEY, summary);
    return summary;
  },

  getBacktestSummary: function() {
    return Storage.get(this.BACKTEST_KEY, null);
  },

  analyzeHitRateOptimization: function(historyData) {
    var backtestResult = this.runBacktest(historyData);
    if (!backtestResult || !backtestResult.records) return null;

    var records = backtestResult.records;
    var self = this;

    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║          🎯 命中率优化深度分析报告              ║');
    console.log('╚══════════════════════════════════════════════╝');

    var stageStats = {};
    var numberFreq = {};
    var blackListImpact = { inBlackList: 0, notInBlackList: 0 };
    var positionStats = { rank1: 0, rank2: 0, rank3: 0, miss: 0 };
    var consecutiveMiss = 0;
    var maxConsecutiveMiss = 0;

    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      var stage = r.stage || 'UNKNOWN';

      if (!stageStats[stage]) {
        stageStats[stage] = { total: 0, hits: 0, hitRate: 0 };
      }
      stageStats[stage].total++;
      if (r.hit) {
        stageStats[stage].hits++;
        consecutiveMiss = 0;
        positionStats['rank' + r.hitRank]++;
        
        var actualNum = self._getZodiacNum(r.actualZodiac);
        if (actualNum) {
          numberFreq[actualNum] = (numberFreq[actualNum] || 0) + 1;
        }
      } else {
        consecutiveMiss++;
        if (consecutiveMiss > maxConsecutiveMiss) {
          maxConsecutiveMiss = consecutiveMiss;
        }
        positionStats.miss++;

        if (r.actualInBlackList) {
          blackListImpact.inBlackList++;
        } else {
          blackListImpact.notInBlackList++;
        }
      }
    }

    for (var s in stageStats) {
      stageStats[s].hitRate = Math.round((stageStats[s].hits / stageStats[s].total) * 100);
    }

    console.log('');
    console.log('【一、各阶段命中率】');
    console.log('┌─────────────────┬──────┬──────┬────────┐');
    console.log('│ 阶段            │ 总数 │ 命中 │ 命中率  │');
    console.log('├─────────────────┼──────┼──────┼────────┤');
    for (var s in stageStats) {
      var st = stageStats[s];
      console.log('│ ' + this._padRight(s, 15) + ' │ ' + this._padLeft(st.total, 4) + ' │ ' + this._padLeft(st.hits, 4) + ' │ ' + this._padLeft(st.hitRate + '%', 6) + ' │');
    }
    console.log('└─────────────────┴──────┴──────┴────────┘');

    console.log('');
    console.log('【二、未命中原因分析】');
    var totalMiss = backtestResult.total - backtestResult.hits;
    console.log('总未命中: ' + totalMiss + '次');
    console.log('  ├─ 因降权错失: ' + blackListImpact.inBlackList + '次 (' + Math.round(blackListImpact.inBlackList / totalMiss * 100) + '%)');
    console.log('  └─ 未推荐到:   ' + blackListImpact.notInBlackList + '次 (' + Math.round(blackListImpact.notInBlackList / totalMiss * 100) + '%)');
    console.log('最大连亏: ' + maxConsecutiveMiss + '期');

    console.log('');
    console.log('【三、实际开出号码频率（未命中时）】');
    var sortedNumbers = Object.keys(numberFreq).sort(function(a, b) { return numberFreq[b] - numberFreq[a]; });
    console.log('┌──────┬──────┬────────┬─────────────────────────┐');
    console.log('│ 号码 │ 次数 │ 占比   │ 分析                     │');
    console.log('├──────┼──────┼────────┼─────────────────────────┤');
    sortedNumbers.forEach(function(num, idx) {
      var freq = numberFreq[num];
      var pct = Math.round(freq / totalMiss * 100);
      var analysis = '';
      if (pct >= 20) analysis = '🔴 高频未命中，需关注';
      else if (pct >= 10) analysis = '🟡 中频，可能被过度降权';
      else analysis = '🟢 正常';
      
      console.log('│  ' + num + '   │ ' + this._padLeft(freq, 4) + ' │ ' + this._padLeft(pct + '%', 6) + ' │ ' + this._padRight(analysis, 23) + ' │');
    });
    console.log('└──────┴──────┴────────┴─────────────────────────┘');

    console.log('');
    console.log('【四、排名位置统计】');
    console.log('第1名命中: ' + positionStats.rank1 + '次 (' + Math.round(positionStats.rank1 / backtestResult.total * 100) + '%)');
    console.log('第2名命中: ' + positionStats.rank2 + '次 (' + Math.round(positionStats.rank2 / backtestResult.total * 100) + '%)');
    console.log('第3名命中: ' + positionStats.rank3 + '次 (' + Math.round(positionStats.rank3 / backtestResult.total * 100) + '%)');
    console.log('完全未中: ' + positionStats.miss + '次 (' + Math.round(positionStats.miss / backtestResult.total * 100) + '%)');

    var suggestions = [];
    
    if (blackListImpact.inBlackList > totalMiss * 0.5) {
      suggestions.push({
        priority: '🔴 高',
        title: '降权规则过严',
        detail: '超过50%的未命中是因为实际号码在降权黑名单中。建议：放宽降权条件或缩短冷却期'
      });
    }

    if (maxConsecutiveMiss >= 5) {
      suggestions.push({
        priority: '🔴 高',
        title: '存在长连亏',
        detail: '最长连亏' + maxConsecutiveMiss + '期，建议：连亏3期后切换策略或暂停'
      });
    }

    for (var s in stageStats) {
      if (stageStats[s].total >= 5 && stageStats[s].hitRate < 30) {
        suggestions.push({
          priority: '🟠 中',
          title: s + '命中率偏低',
          detail: '该阶段命中率仅' + stageStats[s].hitRate + '%%，建议调整该阶段的选号逻辑'
        });
      }
    }

    if (positionStats.rank1 < backtestResult.total * 0.15) {
      suggestions.push({
        priority: '🟡 低',
        title: '第1名命中率不足',
        detail: '当前仅' + Math.round(positionStats.rank1 / backtestResult.total * 100) + '%，建议调整顺延逻辑让热号更靠前'
      });
    }

    console.log('');
    console.log('【五、优化建议】');
    if (suggestions.length === 0) {
      console.log('✅ 当前算法表现良好，无需大幅调整');
    } else {
      suggestions.sort(function(a, b) {
        var order = { '🔴 高': 0, '🟠 中': 1, '🟡 低': 2 };
        return order[a.priority] - order[b.priority];
      });

      suggestions.forEach(function(sug, idx) {
        console.log((idx + 1) + '. [' + sug.priority + '] ' + sug.title);
        console.log('   → ' + sug.detail);
      });
    }

    console.log('');
    console.log('╚══════════════════════════════════════════════╝');

    return {
      stageStats: stageStats,
      blackListImpact: blackListImpact,
      numberFreq: numberFreq,
      positionStats: positionStats,
      maxConsecutiveMiss: maxConsecutiveMiss,
      suggestions: suggestions
    };
  },

  _padLeft: function(str, len) {
    str = String(str);
    while (str.length < len) str = ' ' + str;
    return str;
  },

  _padRight: function(str, len) {
    str = String(str);
    while (str.length < len) str += ' ';
    return str;
  },

  _getZodiacNum: function(zodiacName) {
    var map = { '马': 1, '蛇': 2, '龙': 3, '兔': 4, '虎': 5, '牛': 6, '鼠': 7, '猪': 8, '狗': 9, '鸡': 10, '猴': 11, '羊': 12 };
    return map[zodiacName] || null;
  }
};

BusinessUltimate.init();
