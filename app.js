/**
 * 血染钟楼说书人助手 - 核心控制逻辑 AppController
 * 纯 Vanilla JS 编写，支持本地 localStorage 同步、混编算法与扫码看牌
 */

class AppController {
  constructor() {
    // 1. 初始化默认全局状态
    this.state = {
      script: 'tb',              // 当前选定剧本 (tb: 灾祸滋生, bmr: 黯月升起, snv: 教派与紫罗兰)
      customMix: false,          // 是否开启跨剧本混编
      playerCount: 5,            // 玩家人数 (5 - 15)
      playerNames: [],           // 玩家姓名列表 (长度 = playerCount)
      pool: [],                  // 勾选在角色池里的角色 keys
      players: [],               // 当前游戏中的玩家实例 (分配的角色及状态)
      view: 'setup-view',        // 当前活跃的 SPA 视图 ID
      distMode: 'pass',          // 身份分发模式 ('pass': 翻牌, 'qr': 扫码, 'manual': 手动)
      distCurrentIndex: 0,       // 翻牌模式下当前轮到的玩家索引
      distRevealed: false,       // 翻牌模式中当前牌面是否已翻开
      distManualRoles: {},       // 手动模式下玩家索引到角色key的映射
      distQRPlayersDone: [],     // 扫码模式下每个玩家是否已确认看牌
      dayNumber: 1,              // 当前天数/夜数
      phase: 'night',            // 当前阶段 ('day': 白天, 'night': 夜晚)
      logs: [],                  // 说书人魔典日志列表
      nightGuide: {
        steps: [],               // 当前夜晚行动步骤数组
        currentIndex: 0          // 当前执行的步骤索引
      }
    };

    // 2. 状态映射配置 (标准人数身份分配)
    this.distributionRules = {
      5:  { townsfolk: 3, outsider: 0, minion: 1, demon: 1 },
      6:  { townsfolk: 3, outsider: 1, minion: 1, demon: 1 },
      7:  { townsfolk: 5, outsider: 0, minion: 1, demon: 1 },
      8:  { townsfolk: 5, outsider: 1, minion: 1, demon: 1 },
      9:  { townsfolk: 5, outsider: 2, minion: 1, demon: 1 },
      10: { townsfolk: 7, outsider: 0, minion: 2, demon: 1 },
      11: { townsfolk: 7, outsider: 1, minion: 2, demon: 1 },
      12: { townsfolk: 7, outsider: 2, minion: 2, demon: 1 },
      13: { townsfolk: 9, outsider: 0, minion: 3, demon: 1 },
      14: { townsfolk: 9, outsider: 1, minion: 3, demon: 1 },
      15: { townsfolk: 9, outsider: 2, minion: 3, demon: 1 }
    };

    // 3. 玩家编辑模态框当前编辑的玩家索引
    this.currentEditingPlayerIndex = null;
  }

  // 初始化 App 启动器
  init() {
    console.log("血染钟楼助手初始化中...");
    
    // 检查是否是玩家专属扫码视角
    if (this.checkPlayerViewerURL()) {
      return;
    }

    // 载入本地持久化数据
    this.loadFromLocalStorage();

    // 绑定基础页面 DOM 监听
    this.bindDOMEvents();

    // 渲染初始配置页面
    this.renderSetupView();
  }

  // ==========================================
  // PWA & 玩家视角 & QR URL 解析
  // ==========================================

  checkPlayerViewerURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const pParam = urlParams.get('p');
    if (pParam) {
      try {
        // 隐藏说书人整套 UI，显示玩家视角
        document.getElementById('storyteller-app-container').style.display = 'none';
        document.getElementById('player-viewer-view').style.display = 'flex';

        // 解密 UTF-8 Base64 数据
        const decodedString = decodeURIComponent(escape(atob(pParam)));
        const parts = decodedString.split('::');
        
        if (parts.length >= 5) {
          const playerName = parts[0];
          const roleKey = parts[1];
          const roleName = parts[2];
          const roleType = parts[3];
          const roleDesc = parts[4];

          // 填充玩家卡牌数据
          document.getElementById('player-target-name').innerText = `玩家: ${playerName}`;
          document.getElementById('player-role-title').innerText = "你的身份卡";
          document.getElementById('player-role-character').innerText = roleName;
          document.getElementById('player-role-description').innerText = roleDesc;

          // 阵营美化样式
          const badge = document.getElementById('player-side-badge');
          badge.innerText = this.getRoleTypeCN(roleType);
          badge.style.color = this.getRoleTypeColor(roleType);

          // 绑定点击翻牌隐藏事件
          const revealArea = document.getElementById('player-card-reveal-area');
          const logo = document.getElementById('player-card-logo');
          const hint = document.getElementById('player-card-reveal-hint');
          const content = document.getElementById('player-card-content');
          
          let revealed = false;
          revealArea.onclick = () => {
            revealed = !revealed;
            if (revealed) {
              logo.style.display = 'none';
              hint.style.display = 'none';
              content.style.display = 'block';
              revealArea.style.borderStyle = 'solid';
              revealArea.style.borderColor = 'hsl(var(--gold))';
            } else {
              logo.style.display = 'block';
              hint.style.display = 'block';
              content.style.display = 'none';
              revealArea.style.borderStyle = 'dashed';
              revealArea.style.borderColor = 'var(--border-gold)';
            }
          };
          return true;
        }
      } catch (e) {
        console.error("解密身份参数失败:", e);
        alert("身份解密失败，请重新向说书人获取正确的二维码！");
      }
    }
    return false;
  }

  // ==========================================
  // 本地存储同步
  // ==========================================

  saveToLocalStorage() {
    try {
      localStorage.setItem('botc_grim_state', JSON.stringify(this.state));
    } catch (e) {
      console.error("保存本地存储失败:", e);
    }
  }

  loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem('botc_grim_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        // 覆盖合并现有 state
        this.state = { ...this.state, ...parsed };
        console.log("成功恢复游戏记录, 视图:", this.state.view);
      }
    } catch (e) {
      console.error("读取本地存储失败，重置数据:", e);
    }
  }

  // ==========================================
  // DOM 绑定与输入联动
  // ==========================================

  bindDOMEvents() {
    // 监听人数切换
    const countSelect = document.getElementById('player-count-select');
    countSelect.value = this.state.playerCount;
    countSelect.onchange = (e) => {
      this.state.playerCount = parseInt(e.target.value);
      this.renderPlayerNamesList();
      this.updateDistributionBadges();
      this.saveToLocalStorage();
    };

    // 监听剧本切换
    const scriptSelect = document.getElementById('script-select');
    scriptSelect.value = this.state.script;
    scriptSelect.onchange = (e) => {
      this.state.script = e.target.value;
      this.saveToLocalStorage();
    };

    // 监听混编开关切换
    const mixToggle = document.getElementById('custom-mix-toggle');
    mixToggle.checked = this.state.customMix;
    mixToggle.onchange = (e) => {
      this.state.customMix = e.target.checked;
      this.saveToLocalStorage();
    };
  }

  // ==========================================
  // SPA 页面切页机制
  // ==========================================

  switchView(viewId) {
    // 隐藏所有视图
    const views = document.querySelectorAll('.view');
    views.forEach(v => v.classList.remove('active'));
    
    // 显示目标视图
    const target = document.getElementById(viewId);
    if (target) {
      target.classList.add('active');
      this.state.view = viewId;
      this.saveToLocalStorage();
      
      // 切页特殊渲染处理
      if (viewId === 'grim-view') {
        this.renderGrimoireCircle();
      }
    }
  }

  // ==========================================
  // 视图 1: 游戏配置页逻辑 (Setup View)
  // ==========================================

  renderSetupView() {
    this.updateDistributionBadges();
    this.renderPlayerNamesList();
    this.switchView(this.state.view);
  }

  updateDistributionBadges() {
    const rules = this.distributionRules[this.state.playerCount];
    document.getElementById('players-calc-badge').innerText = `${this.state.playerCount}人局`;
    document.getElementById('dist-count-townsfolk').innerText = rules.townsfolk;
    document.getElementById('dist-count-outsider').innerText = rules.outsider;
    document.getElementById('dist-count-minion').innerText = rules.minion;
    document.getElementById('dist-count-demon').innerText = rules.demon;
  }

  renderPlayerNamesList() {
    const container = document.getElementById('player-name-inputs-list');
    container.innerHTML = '';

    // 校准姓名列表长度
    if (this.state.playerNames.length !== this.state.playerCount) {
      const newNames = [];
      for (let i = 0; i < this.state.playerCount; i++) {
        newNames.push(this.state.playerNames[i] || `玩家${i + 1}`);
      }
      this.state.playerNames = newNames;
    }

    for (let i = 0; i < this.state.playerCount; i++) {
      const row = document.createElement('div');
      row.className = 'player-input-row';
      
      const numSpan = document.createElement('span');
      numSpan.className = 'player-input-num';
      numSpan.innerText = `${i + 1}`;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-control';
      input.placeholder = `玩家 ${i + 1} 名字`;
      input.value = this.state.playerNames[i];
      input.oninput = (e) => {
        this.state.playerNames[i] = e.target.value.trim();
        this.saveToLocalStorage();
      };

      row.appendChild(numSpan);
      row.appendChild(input);
      container.appendChild(row);
    }
  }

  quickFillNames() {
    // 充满诗意的国风/魔幻风中文名字
    const premiumNames = [
      "若华", "沉鱼", "孤城", "冷锋", "铁手", "无情", "追命", "飞羽", 
      "紫烟", "落雁", "闭月", "羞花", "清风", "明月", "惊鸿", "游龙"
    ];
    for (let i = 0; i < this.state.playerCount; i++) {
      this.state.playerNames[i] = premiumNames[i] || `玩家${i + 1}`;
    }
    this.renderPlayerNamesList();
    this.saveToLocalStorage();
  }

  goToPoolSelection() {
    // 玩家姓名校验防空
    for (let i = 0; i < this.state.playerCount; i++) {
      if (!this.state.playerNames[i]) {
        this.state.playerNames[i] = `玩家${i + 1}`;
      }
    }
    this.renderPoolSelectionView();
    this.switchView('pool-view');
  }

  // ==========================================
  // 视图 2: 角色池勾选选择页逻辑 (Pool Selection View)
  // ==========================================

  renderPoolSelectionView() {
    // 渲染各类别角色勾选框
    this.renderPoolCategoryGrid('townsfolk', 'pool-grid-townsfolk');
    this.renderPoolCategoryGrid('outsider', 'pool-grid-outsider');
    this.renderPoolCategoryGrid('minion', 'pool-grid-minion');
    this.renderPoolCategoryGrid('demon', 'pool-grid-demon');

    this.updatePoolStatusText();
  }

  renderPoolCategoryGrid(type, gridId) {
    const grid = document.getElementById(gridId);
    grid.innerHTML = '';

    // 获取所有可用角色
    const list = this.getAvailableRolesList(type);

    list.forEach(item => {
      const isChecked = this.state.pool.includes(item.key);

      const label = document.createElement('label');
      label.className = `role-checkbox-item ${isChecked ? 'checked' : ''}`;
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = isChecked;
      checkbox.onchange = (e) => {
        if (e.target.checked) {
          if (!this.state.pool.includes(item.key)) {
            this.state.pool.push(item.key);
          }
          label.classList.add('checked');
        } else {
          this.state.pool = this.state.pool.filter(k => k !== item.key);
          label.classList.remove('checked');
        }
        this.updatePoolStatusText();
        this.saveToLocalStorage();
      };

      const avatar = document.createElement('div');
      avatar.className = 'role-checkbox-avatar';
      avatar.innerText = item.name.substring(0, 1);
      avatar.style.color = this.getRoleTypeColor(type);

      const info = document.createElement('div');
      info.className = 'role-checkbox-info';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'role-checkbox-name';
      nameSpan.innerText = item.name;

      const scriptSpan = document.createElement('span');
      scriptSpan.className = 'role-checkbox-script';
      scriptSpan.innerText = item.scriptName;

      info.appendChild(nameSpan);
      info.appendChild(scriptSpan);
      label.appendChild(checkbox);
      label.appendChild(avatar);
      label.appendChild(info);
      grid.appendChild(label);
    });
  }

  // 辅助函数：根据剧本、混编状态过滤出各角色
  getAvailableRolesList(type) {
    const roles = [];
    // 遍历所有剧本
    Object.keys(ROLES_DATA).forEach(scriptKey => {
      // 如果不开启混编，且剧本不符，跳过
      if (!this.state.customMix && this.state.script !== scriptKey) {
        return;
      }
      
      const scriptData = ROLES_DATA[scriptKey];
      const charMap = scriptData.characters;

      Object.keys(charMap).forEach(charKey => {
        const char = charMap[charKey];
        if (char.type === type) {
          roles.push({
            key: charKey,
            name: char.name,
            scriptName: scriptData.name,
            scriptKey: scriptKey
          });
        }
      });
    });

    return roles;
  }

  updatePoolStatusText() {
    const badge = document.getElementById('pool-status-badge');
    const rules = this.distributionRules[this.state.playerCount];
    const totalNeeded = rules.townsfolk + rules.outsider + rules.minion + rules.demon;
    badge.innerText = `已选 ${this.state.pool.length} / ${totalNeeded}`;

    const nextBtn = document.getElementById('btn-pool-next');
    if (this.state.pool.length >= totalNeeded) {
      nextBtn.removeAttribute('disabled');
      badge.style.color = 'hsl(var(--gold))';
    } else {
      nextBtn.setAttribute('disabled', 'true');
      badge.style.color = 'hsl(var(--text-muted))';
    }
  }

  clearPoolSelection() {
    this.state.pool = [];
    this.renderPoolSelectionView();
    this.saveToLocalStorage();
  }

  // 匹配名额一键随机勾选
  autoRandomPool() {
    this.state.pool = [];
    const rules = this.distributionRules[this.state.playerCount];

    const types = ['townsfolk', 'outsider', 'minion', 'demon'];
    types.forEach(type => {
      const list = this.getAvailableRolesList(type);
      const countNeeded = rules[type];
      
      // 打乱数组洗牌算法
      const shuffled = [...list].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, countNeeded);
      selected.forEach(item => {
        this.state.pool.push(item.key);
      });
    });

    this.renderPoolSelectionView();
    this.saveToLocalStorage();
  }

  // ==========================================
  // 视图 3: 身份分发页逻辑 (Distribution View)
  // ==========================================

  goToDistribution() {
    const rules = this.distributionRules[this.state.playerCount];
    const totalNeeded = rules.townsfolk + rules.outsider + rules.minion + rules.demon;
    if (this.state.pool.length < totalNeeded) {
      alert(`勾选的角色池数量 (${this.state.pool.length}) 不足本局所需的最低角色数 (${totalNeeded})！`);
      return;
    }

    // 初始化分发状态
    this.state.distCurrentIndex = 0;
    this.state.distRevealed = false;
    this.state.distManualRoles = {};
    this.state.distQRPlayersDone = new Array(this.state.playerCount).fill(false);

    // 随机把角色池中的部分角色洗入真实发牌池 (如果说书人多勾选了，则随机抽 totalNeeded 个出来)
    // 区分四类名额分配，防止名额类别错乱
    this.distributeFinalRolesPool();

    this.renderDistributionView();
    this.switchView('dist-view');
  }

  distributeFinalRolesPool() {
    const rules = this.distributionRules[this.state.playerCount];
    
    // 提取当前 pool 中的各类型角色
    const poolTownsfolk = [];
    const poolOutsider = [];
    const poolMinion = [];
    const poolDemon = [];

    this.state.pool.forEach(key => {
      const char = this.findRoleData(key);
      if (char) {
        if (char.type === 'townsfolk') poolTownsfolk.push(key);
        else if (char.type === 'outsider') poolOutsider.push(key);
        else if (char.type === 'minion') poolMinion.push(key);
        else if (char.type === 'demon') poolDemon.push(key);
      }
    });

    // 从每一类中抽取对应名额
    const finalSelection = [
      ...this.getRandomSubarray(poolTownsfolk, rules.townsfolk),
      ...this.getRandomSubarray(poolOutsider, rules.outsider),
      ...this.getRandomSubarray(poolMinion, rules.minion),
      ...this.getRandomSubarray(poolDemon, rules.demon)
    ];

    // 打乱顺序，准备分发给玩家们
    const finalShuffled = finalSelection.sort(() => 0.5 - Math.random());

    // 灌入初始玩家模型数组
    this.state.players = [];
    for (let i = 0; i < this.state.playerCount; i++) {
      const roleKey = finalShuffled[i];
      const charData = this.findRoleData(roleKey);
      this.state.players.push({
        index: i,
        name: this.state.playerNames[i],
        role: roleKey,
        roleData: charData,
        dead: false,
        hasVoteToken: true,
        poisoned: false,
        drunk: false,
        safe: false
      });
    }
    this.saveToLocalStorage();
  }

  renderDistributionView() {
    this.updateDistProgressBadge();

    // 渲染翻牌视图
    this.renderPassModeState();
    
    // 渲染扫码下拉框
    const qrSelect = document.getElementById('qr-player-select');
    qrSelect.innerHTML = '';
    for (let i = 0; i < this.state.playerCount; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.innerText = `${i + 1}号: ${this.state.playerNames[i]}`;
      qrSelect.appendChild(opt);
    }
    this.generateQRForSelectedPlayer();

    // 渲染手动指定模式列表
    const manualList = document.getElementById('manual-distribution-list');
    manualList.innerHTML = '';
    
    for (let i = 0; i < this.state.playerCount; i++) {
      const itemRow = document.createElement('div');
      itemRow.className = 'manual-list-item';

      const label = document.createElement('span');
      label.innerText = `${i + 1}号 [${this.state.playerNames[i]}]:`;

      const select = document.createElement('select');
      select.className = 'manual-select';
      
      // 提供当前分配出来的所有可用角色让说书人指定映射
      const currentSelectedRolesInPlay = this.state.players.map(p => p.role);
      
      currentSelectedRolesInPlay.forEach(roleKey => {
        const char = this.findRoleData(roleKey);
        const opt = document.createElement('option');
        opt.value = roleKey;
        opt.innerText = char ? char.name : roleKey;
        select.appendChild(opt);
      });

      // 初始化手动选择
      select.value = this.state.players[i].role;
      select.onchange = (e) => {
        const val = e.target.value;
        this.state.players[i].role = val;
        this.state.players[i].roleData = this.findRoleData(val);
        this.saveToLocalStorage();
      };

      itemRow.appendChild(label);
      itemRow.appendChild(select);
      manualList.appendChild(itemRow);
    }
  }

  updateDistProgressBadge() {
    const badge = document.getElementById('dist-progress-badge');
    const nextBtn = document.getElementById('btn-dist-next');

    let countDone = 0;
    if (this.state.distMode === 'pass') {
      countDone = this.state.distCurrentIndex;
    } else if (this.state.distMode === 'qr') {
      countDone = this.state.distQRPlayersDone.filter(Boolean).length;
    } else {
      countDone = this.state.playerCount; // 手动分配默认直接视作完成
    }

    badge.innerText = `已完成 ${countDone} / ${this.state.playerCount}`;

    if (countDone >= this.state.playerCount) {
      nextBtn.removeAttribute('disabled');
      badge.style.color = 'hsl(var(--gold))';
    } else {
      nextBtn.setAttribute('disabled', 'true');
      badge.style.color = 'hsl(var(--text-muted))';
    }
  }

  switchDistMode(mode) {
    this.state.distMode = mode;
    
    // Tab 样式
    document.querySelectorAll('.dist-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`dist-tab-${mode}`).classList.add('active');

    // Container 隐藏显露
    document.getElementById('dist-mode-container-pass').style.display = (mode === 'pass') ? 'flex' : 'none';
    document.getElementById('dist-mode-container-qr').style.display = (mode === 'qr') ? 'flex' : 'none';
    document.getElementById('dist-mode-container-manual').style.display = (mode === 'manual') ? 'block' : 'none';

    this.updateDistProgressBadge();
    this.saveToLocalStorage();
  }

  // 找出本局分配给玩家的恶魔角色，用于疯子发牌时的伪装
  getActualDemonRoleData() {
    const demonPlayer = this.state.players.find(p => p.roleData && p.roleData.type === 'demon');
    if (demonPlayer) {
      return demonPlayer.roleData;
    }
    // 如果没有找到（例如混编未选恶魔等极端情况），默认返回小恶魔
    return this.findRoleData('imp') || { name: '小恶魔', type: 'demon', ability: '每个夜晚*，选择一名玩家：该玩家死亡。' };
  }

  // 翻牌分配模式控制器
  renderPassModeState() {
    const passPlayer = document.getElementById('pass-player-target');
    const confirmBtn = document.getElementById('btn-pass-confirm-next');
    const flipper = document.getElementById('card-reveal-flipper');

    if (this.state.distCurrentIndex < this.state.playerCount) {
      passPlayer.innerText = `${this.state.distCurrentIndex + 1}号: ${this.state.playerNames[this.state.distCurrentIndex]}`;
      confirmBtn.innerText = this.state.distCurrentIndex === this.state.playerCount - 1 ? '完成身份分发' : '确认并传递';
      confirmBtn.setAttribute('disabled', 'true');
      
      // 卡牌重置状态为正面/背牌盖起
      flipper.classList.remove('flipped');
      this.state.distRevealed = false;

      // 预渲染背牌信息
      const playerObj = this.state.players[this.state.distCurrentIndex];
      let char = playerObj.roleData;
      
      // 疯子发牌伪装逻辑：如果真实角色是疯子，则向玩家显示本局实际的恶魔卡牌信息
      if (playerObj.role === 'lunatic') {
        char = this.getActualDemonRoleData();
      }
      
      document.getElementById('pass-role-type').innerText = this.getRoleTypeCN(char.type);
      document.getElementById('pass-role-type').style.color = this.getRoleTypeColor(char.type);
      document.getElementById('pass-role-name').innerText = char.name;
      document.getElementById('pass-role-desc').innerText = char.ability;
    } else {
      passPlayer.innerText = "分发全部完成！";
      confirmBtn.setAttribute('disabled', 'true');
      confirmBtn.innerText = "已完成所有分发";
    }
  }

  flipPassCard() {
    if (this.state.distCurrentIndex >= this.state.playerCount) return;

    const flipper = document.getElementById('card-reveal-flipper');
    this.state.distRevealed = !this.state.distRevealed;
    
    if (this.state.distRevealed) {
      flipper.classList.add('flipped');
      document.getElementById('btn-pass-confirm-next').removeAttribute('disabled');
    } else {
      flipper.classList.remove('flipped');
    }
  }

  confirmNextPassPlayer() {
    const flipper = document.getElementById('card-reveal-flipper');
    const confirmBtn = document.getElementById('btn-pass-confirm-next');

    // 1. 物理层先将卡牌翻转回正面（盖起），彻底遮挡背部文字
    flipper.classList.remove('flipped');
    this.state.distRevealed = false;
    
    // 2. 立即禁用按钮，避免传递过程中发生快速连击或并发错误
    confirmBtn.setAttribute('disabled', 'true');

    // 3. 延迟 600ms（等 3D 旋转动效彻底完成、牌面扣过去后），再切换下一个玩家指针并更新背部身份文本
    setTimeout(() => {
      this.state.distCurrentIndex++;
      this.updateDistProgressBadge();
      this.renderPassModeState();
      this.saveToLocalStorage();
    }, 600);
  }

  // 扫码看牌分配模式控制器
  generateQRForSelectedPlayer() {
    const idx = parseInt(document.getElementById('qr-player-select').value);
    const p = this.state.players[idx];
    if (!p) return;

    document.getElementById('qr-target-text-info').innerText = `正在展示：${idx + 1}号 [${p.name}] 的专属卡片`;

    // 疯子扫码伪装：如果真实身份是疯子，加密传输本场的恶魔角色详情，使其完全不知情
    let roleKey = p.role;
    let roleName = p.roleData.name;
    let roleType = p.roleData.type;
    let roleAbility = p.roleData.ability;
    
    if (p.role === 'lunatic') {
      const actualDemon = this.getActualDemonRoleData();
      roleKey = actualDemon.key || 'imp';
      roleName = actualDemon.name;
      roleType = actualDemon.type;
      roleAbility = actualDemon.ability;
    }

    // 序列化编码玩家数据至 URL 参数以供完全解密
    const secretPayload = `${p.name}::${roleKey}::${roleName}::${roleType}::${roleAbility}`;
    // 使用标准 UTF-8 Base64 安全打包
    const obfuscated = btoa(unescape(encodeURIComponent(secretPayload)));

    // 拼接成指向我们该站的绝对路径
    const rawLink = `${window.location.origin}${window.location.pathname}?p=${obfuscated}`;
    
    // 使用稳定的 serverless api.qrserver.com 进行轻量生成
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(rawLink)}`;
    
    document.getElementById('dist-qr-image').src = qrUrl;
  }

  markCurrentQRPlayerAsDone() {
    const idx = parseInt(document.getElementById('qr-player-select').value);
    this.state.distQRPlayersDone[idx] = true;
    
    this.updateDistProgressBadge();
    
    // 自动切到下一个未扫码的玩家
    let nextIdx = (idx + 1) % this.state.playerCount;
    document.getElementById('qr-player-select').value = nextIdx;
    this.generateQRForSelectedPlayer();
    
    this.saveToLocalStorage();
  }

  completeDistribution() {
    // 分配最终确认
    this.state.dayNumber = 1;
    this.state.phase = 'night'; // 标准游戏均以首夜闭眼开始！
    
    this.state.logs = [];
    this.addLog("系统", "游戏魔盘构建完毕，游戏正式开始。");

    // 疯子说书人提醒机制：检测是否有玩家分配到“疯子”身份，如果有则提示说书人其真身与伪装身份
    const lunaticPlayer = this.state.players.find(p => p.role === 'lunatic');
    if (lunaticPlayer) {
      const actualDemon = this.getActualDemonRoleData();
      
      // 延迟 300ms 弹出说书人警告弹窗，确保视图切页过渡顺利
      setTimeout(() => {
        alert(`【🚨 说书人重要警示 - 疯子已配置】\n\n本局游戏中有玩家分配到了【疯子】(Lunatic) 角色！\n\n👤 玩家名称: ${lunaticPlayer.name} (座位号 ${lunaticPlayer.index + 1})\n🎭 伪装恶魔: ${actualDemon.name}\n\n该玩家刚才在看牌时被告知他是【${actualDemon.name}】。\n\n说书人重要提示：\n1. 第一晚行动时，你需要向他展示伪装的恶魔卡牌，并向其指出本局的“爪牙”（通常是善良阵营玩家）；\n2. 他的每一次夜间击杀都是无效的，但在当晚真实恶魔行动时，你需要将他的选择展示给真正的恶魔。`);
      }, 300);
      
      this.addLog("系统", `🚨 <strong>说书人警示</strong>: 玩家 [${lunaticPlayer.name}] (座位 ${lunaticPlayer.index + 1}) 的真实角色为【疯子】，他以为自己是恶魔【${actualDemon.name}】。`);
    }

    // 切到魔典界面
    this.switchView('grim-view');
  }

  // ==========================================
  // 视图 4: 魔典大轮盘逻辑 (Grimoire Circle)
  // ==========================================

  renderGrimoireCircle() {
    const viewport = document.getElementById('grimoire-circle-viewport');
    
    // 清除旧的玩家节点 (保留中心时钟)
    const oldNodes = viewport.querySelectorAll('.player-seat-node');
    oldNodes.forEach(node => node.remove());

    // 渲染中心时钟状态
    const scriptName = this.state.customMix ? "混编剧本" : ROLES_DATA[this.state.script].name;
    document.getElementById('grim-center-script-name').innerText = scriptName;
    document.getElementById('grim-center-day-phase').innerText = `第 ${this.state.dayNumber} ${this.state.phase === 'night' ? '夜晚' : '白天'}`;
    document.getElementById('grim-day-number-text').innerText = `第 ${this.state.dayNumber} 天`;
    
    const phaseBtn = document.getElementById('btn-toggle-phase');
    phaseBtn.innerText = this.state.phase === 'night' ? '切换为白天 ☀️' : '进入夜晚 🌙';

    // 环形位置数学模型计算
    const N = this.state.playerCount;
    const R = 38; // 圆环半径 (以百分比 50 为中心发散，留出合适边界防字溢出)

    this.state.players.forEach((p, i) => {
      // 首位玩家 12 点钟，顺时针排序
      const angle = (2 * Math.PI * i / N) - (Math.PI / 2);
      const x = 50 + R * Math.cos(angle);
      const y = 50 + R * Math.sin(angle);

      // 创建座位定位节点
      const seat = document.createElement('div');
      seat.className = `player-seat-node ${p.dead ? 'dead' : ''}`;
      seat.style.left = `${x}%`;
      seat.style.top = `${y}%`;

      // 玩家圆盘
      const disk = document.createElement('div');
      disk.className = `seat-disk ${p.roleData.type}`;
      disk.onclick = () => this.openPlayerEditModal(i);

      // 头像简写
      const avatar = document.createElement('div');
      avatar.className = 'seat-disk-avatar';
      avatar.innerText = p.name.substring(0, 1);

      // 玩家姓名
      const pName = document.createElement('span');
      pName.className = 'seat-player-name';
      pName.innerText = p.name;

      // 角色中文名
      const rName = document.createElement('span');
      rName.className = 'seat-role-name';
      rName.innerText = p.roleData.name;
      rName.style.color = this.getRoleTypeColor(p.roleData.type);

      // 血色寿衣遮罩
      const shroud = document.createElement('div');
      shroud.className = 'shroud-overlay';

      disk.appendChild(avatar);
      disk.appendChild(pName);
      disk.appendChild(rName);
      disk.appendChild(shroud);
      seat.appendChild(disk);

      // 如果已死，渲染死亡投票权 (Dead Vote Token)
      if (p.dead) {
        const token = document.createElement('div');
        token.className = `dead-vote-token ${p.hasVoteToken ? '' : 'used'}`;
        token.innerText = p.hasVoteToken ? "†" : "已用";
        token.onclick = (e) => {
          e.stopPropagation(); // 阻止点击圆盘模态框弹出
          p.hasVoteToken = !p.hasVoteToken;
          this.addLog(p.name, p.hasVoteToken ? "恢复了死亡投票权" : "使用了死亡投票权");
          this.renderGrimoireCircle();
          this.saveToLocalStorage();
        };
        seat.appendChild(token);
      }

      // 状态气泡行 (Poison, Drunk, Safe)
      const bubbles = document.createElement('div');
      bubbles.className = 'state-bubbles-row';

      if (p.poisoned) {
        const b = document.createElement('div');
        b.className = 'state-bubble poisoned';
        b.innerText = "毒";
        b.title = "中毒状态 (技能失效并可能给出假信息)";
        bubbles.appendChild(b);
      }
      if (p.drunk) {
        const b = document.createElement('div');
        b.className = 'state-bubble drunk';
        b.innerText = "醉";
        b.title = "醉酒状态 (技能失效)";
        bubbles.appendChild(b);
      }
      if (p.safe) {
        const b = document.createElement('div');
        b.className = 'state-bubble safe';
        b.innerText = "护";
        b.title = "免死守护状态 (免受恶魔夜间袭击)";
        bubbles.appendChild(b);
      }

      if (bubbles.children.length > 0) {
        seat.appendChild(bubbles);
      }

      viewport.appendChild(seat);
    });

    // 渲染存活指示及日志
    const aliveCount = this.state.players.filter(p => !p.dead).length;
    document.getElementById('grim-alive-fraction').innerText = `存活：${aliveCount} / ${N}`;
    
    this.renderLogs();
  }

  // ==========================================
  // 玩家状态设置修改模态弹窗逻辑 (Player Edit Drawer)
  // ==========================================

  openPlayerEditModal(playerIndex) {
    this.currentEditingPlayerIndex = playerIndex;
    const p = this.state.players[playerIndex];
    if (!p) return;

    // 填充弹窗元素
    document.getElementById('edit-player-number-badge').innerText = `座位号 ${playerIndex + 1}`;
    document.getElementById('edit-player-title-name').innerText = `管理: ${p.name}`;
    document.getElementById('edit-player-name-field').value = p.name;

    // 填充角色下拉框 (本场所有已选角色)
    const select = document.getElementById('edit-player-role-field');
    select.innerHTML = '';

    // 标准模式或混编模式下的可选集
    this.state.pool.forEach(key => {
      const char = this.findRoleData(key);
      const opt = document.createElement('option');
      opt.value = key;
      opt.innerText = char ? char.name : key;
      select.appendChild(opt);
    });

    select.value = p.role;
    this.onModalRoleChange();

    // 勾选状态
    document.getElementById('edit-state-dead').checked = p.dead;
    document.getElementById('edit-state-vote-token').checked = p.hasVoteToken;
    document.getElementById('edit-state-poisoned').checked = p.poisoned;
    document.getElementById('edit-state-drunk').checked = p.drunk;
    document.getElementById('edit-state-safe').checked = p.safe;

    this.onModalDeadChange();

    // 打开 Backdrop
    document.getElementById('player-edit-modal').classList.add('active');
  }

  onModalRoleChange() {
    const select = document.getElementById('edit-player-role-field');
    const roleKey = select.value;
    const char = this.findRoleData(roleKey);
    const desc = document.getElementById('edit-player-role-ability');
    
    if (char) {
      desc.innerText = `【${this.getRoleTypeCN(char.type)}】: ${char.ability}`;
      desc.style.color = this.getRoleTypeColor(char.type);
    }
  }

  onModalDeadChange() {
    const deadChecked = document.getElementById('edit-state-dead').checked;
    const container = document.getElementById('edit-vote-token-container');
    
    // 如果死了，展示死亡投票权勾选开关
    container.style.display = deadChecked ? 'flex' : 'none';
  }

  closePlayerEditModal() {
    document.getElementById('player-edit-modal').classList.remove('active');
    this.currentEditingPlayerIndex = null;
  }

  savePlayerEditModal() {
    if (this.currentEditingPlayerIndex === null) return;
    
    const idx = this.currentEditingPlayerIndex;
    const p = this.state.players[idx];

    const newName = document.getElementById('edit-player-name-field').value.trim();
    const newRole = document.getElementById('edit-player-role-field').value;
    const dead = document.getElementById('edit-state-dead').checked;
    const voteToken = document.getElementById('edit-state-vote-token').checked;
    const poisoned = document.getElementById('edit-state-poisoned').checked;
    const drunk = document.getElementById('edit-state-drunk').checked;
    const safe = document.getElementById('edit-state-safe').checked;

    let changes = [];
    if (p.name !== newName) {
      changes.push(`改名为 [${newName}]`);
      p.name = newName;
      this.state.playerNames[idx] = newName;
    }
    if (p.role !== newRole) {
      const oldChar = p.roleData;
      const newChar = this.findRoleData(newRole);
      changes.push(`角色从 [${oldChar.name}] 变更为 [${newChar.name}]`);
      p.role = newRole;
      p.roleData = newChar;
    }
    if (p.dead !== dead) {
      changes.push(dead ? "进入了棺木 (死亡)" : "从墓地中复活 (存活)");
      p.dead = dead;
      if (dead) p.hasVoteToken = true; // 死亡默认给予未使用投票标记
    }
    if (dead && p.hasVoteToken !== voteToken) {
      changes.push(voteToken ? "拿回了死亡投票权" : "销毁了死亡投票权");
      p.hasVoteToken = voteToken;
    }
    if (p.poisoned !== poisoned) {
      changes.push(poisoned ? "遭受毒液侵蚀 🧪" : "清除了中毒状态");
      p.poisoned = poisoned;
    }
    if (p.drunk !== drunk) {
      changes.push(drunk ? "陷入昏沉宿醉 🍺" : "清醒了过来");
      p.drunk = drunk;
    }
    if (p.safe !== safe) {
      changes.push(safe ? "得到了圣盾庇护 🛡️" : "守护光环退去");
      p.safe = safe;
    }

    if (changes.length > 0) {
      this.addLog(p.name, changes.join(', '));
    }

    this.closePlayerEditModal();
    this.renderGrimoireCircle();
    this.saveToLocalStorage();
  }

  // ==========================================
  // 日历与日夜状态操作
  // ==========================================

  adjustDay(delta) {
    this.state.dayNumber = Math.max(1, this.state.dayNumber + delta);
    this.addLog("系统", `日程修改为：第 ${this.state.dayNumber} 天`);
    this.renderGrimoireCircle();
    this.saveToLocalStorage();
  }

  toggleDayNightPhase() {
    this.state.phase = this.state.phase === 'night' ? 'day' : 'night';
    this.addLog("系统", `天色变动，当前处于：第 ${this.state.dayNumber} ${this.state.phase === 'night' ? '夜晚' : '白天'}`);
    
    // 如果进入夜晚，重置上一夜的夜间临时状态 (如Monk的Safe, Poisoner的Poisoned)
    if (this.state.phase === 'night') {
      this.state.players.forEach(p => {
        // 自动清除临时状态，符合血染标准结算机制
        p.safe = false; 
      });
      this.addLog("系统", "已自动清空昨晚临时守护状态，请说书人开启今晚引导。");
    }

    this.renderGrimoireCircle();
    this.saveToLocalStorage();
  }

  // ==========================================
  // 智能动态夜晚行动算法 (Night Guide Algorithm)
  // ==========================================

  openNightGuide() {
    // 1. 构建本晚行动队列 steps
    const isFirst = (this.state.dayNumber === 1);
    const stepsQueue = [];

    // 获取当前在场存活角色集合（Vigormortis 枯骨魔可以让死了的爪牙依然苏醒）
    // 间谍、守鸦人、理发师、贤者等死了后依然会满足特定苏醒条件
    const activeRoles = this.state.players.map(p => ({
      playerIndex: p.index,
      playerName: p.name,
      roleKey: p.role,
      role: p.roleData,
      isDead: p.dead
    }));

    // 获取全局排序表
    const orderMap = isFirst ? MASTER_NIGHT_ORDER.firstNight : MASTER_NIGHT_ORDER.otherNight;

    // 2. 根据官方主相对表动态排序在场苏醒角色
    const sortedWakeList = [];

    // 如果是首夜，插入爪牙/恶魔互认的首要步骤
    if (isFirst) {
      sortedWakeList.push({
        type: 'system-info',
        name: '爪牙互认/确认恶魔',
        ability: '爪牙睁眼彼此相认；随后恶魔睁眼，得知所有爪牙身份及三个不在场的善良阵营角色。',
        gesture: '让所有爪牙睁眼对视确认。随后让他们闭眼，唤醒恶魔：向恶魔指点展示其所有爪牙，并在卡牌上向其出示三个本局【未在场】的善良角色。',
        weight: 0.5
      });
    }

    activeRoles.forEach(p => {
      const weight = orderMap[p.roleKey];
      // 如果该角色有分配相对重量，且符合苏醒生存规则
      if (weight !== undefined) {
        
        let shouldWake = false;

        if (isFirst) {
          // 首夜苏醒检查
          if (p.role.firstNight !== undefined) {
            // 打手 (Goon) 首晚不睁眼 (黯月升起标准配置)
            if (p.roleKey === 'goon') {
              shouldWake = false; 
            } else {
              shouldWake = !p.isDead; // 首夜死了的角色通常不需要动
            }
          }
        } else {
          // 其他夜晚苏醒检查
          if (p.role.otherNight !== undefined) {
            // 存活状态下或者死后触发条件
            if (!p.isDead) {
              shouldWake = true;
            } else {
              // 特殊：死人可能依然需要睁眼结算一次的角色
              if (['barber', 'sweetheart', 'ravenkeeper', 'sage'].includes(p.roleKey)) {
                shouldWake = true; // ST 视作临时死夜需要唤醒一次以释放绝唱能力
              }
            }
          }
        }

        if (shouldWake) {
          sortedWakeList.push({
            type: 'role',
            roleKey: p.roleKey,
            playerIndex: p.playerIndex,
            playerName: p.playerName,
            name: p.role.name,
            ability: p.role.ability,
            gesture: isFirst ? (p.role.wakeFirst || '唤醒此角色，展示其标志，让其决定并互动。') : (p.role.wakeOther || '唤醒此角色，向其出示指引并结算。'),
            weight: weight
          });
        }
      }
    });

    // 按重量升序排序 (数值越小越先唤醒)
    sortedWakeList.sort((a, b) => a.weight - b.weight);

    if (sortedWakeList.length === 0) {
      alert("今晚没有任何角色需要苏醒！");
      return;
    }

    this.state.nightGuide.steps = sortedWakeList;
    this.state.nightGuide.currentIndex = 0;

    this.renderNightStep();
    document.getElementById('night-guide-modal').classList.add('active');
  }

  renderNightStep() {
    const guide = this.state.nightGuide;
    const step = guide.steps[guide.currentIndex];
    if (!step) return;

    // 更新索引标题
    document.getElementById('night-step-index-text').innerText = `步骤 ${guide.currentIndex + 1} / ${guide.steps.length}`;
    
    const charNameEl = document.getElementById('night-step-character-name');
    const abilityEl = document.getElementById('night-step-ability-text');
    const gestureEl = document.getElementById('night-step-gesture-text');
    const actionEl = document.getElementById('night-step-action-inputs-container');

    actionEl.innerHTML = ''; // 清空上一页操作面板

    if (step.type === 'system-info') {
      charNameEl.innerText = step.name;
      charNameEl.style.color = 'hsl(var(--gold))';
      abilityEl.innerText = step.ability;
      gestureEl.innerText = step.gesture;
    } else {
      charNameEl.innerText = `${step.name} (${step.playerName})`;
      charNameEl.style.color = this.getRoleTypeColor(step.role.type);
      abilityEl.innerText = `【技能】: ${step.ability}`;
      gestureEl.innerText = step.gesture;

      // 动态生成高级互动目标控制器 (Wow Factor!)
      this.generateNightActionInputs(step, actionEl);
    }

    // 控制上一步下一步按钮状态
    document.getElementById('btn-night-prev').disabled = (guide.currentIndex === 0);
    document.getElementById('btn-night-next-step').innerText = (guide.currentIndex === guide.steps.length - 1) ? "黎明到来 ☀️" : "下一步 ➔";
  }

  generateNightActionInputs(step, container) {
    // 根据角色技能，自动生成高交互的目标指向下拉选择器
    const key = step.roleKey;
    const player = this.state.players[step.playerIndex];

    // 1. 中毒/下毒类 (下毒者, 沙巴)
    if (['poisoner', 'pukka'].includes(key)) {
      this.createNightSelectorRow(container, "施毒/下毒目标:", (targetIdx) => {
        // 先清空所有人的中毒，保证仅单体中毒 (或者说书人自定义维护)
        this.state.players.forEach(p => p.poisoned = false);
        this.state.players[targetIdx].poisoned = true;
        this.addLog(step.name, `给 [${this.state.players[targetIdx].name}] 下了剧毒 🧪`);
      });
    }

    // 2. 守护保命类 (僧侣, 旅店老板)
    else if (['monk', 'innkeeper'].includes(key)) {
      this.createNightSelectorRow(container, "提供圣光守护目标:", (targetIdx) => {
        this.state.players[targetIdx].safe = true;
        this.addLog(step.name, `为 [${this.state.players[targetIdx].name}] 挂载了圣盾 🛡️`);
      });
    }

    // 3. 击杀恶魔/刺客类 (Imp, subassassin, godfather, po, pukka等)
    else if (['imp', 'subassassin', 'godfather', 'po', 'shabaloth', 'zombuul', 'fanggu', 'vigormortis', 'nodashii', 'vortox'].includes(key)) {
      this.createNightSelectorRow(container, "选择刺杀/击杀目标:", (targetIdx) => {
        const target = this.state.players[targetIdx];
        
        // 验证是否有安全守护 (Safe) 且不是刺客刺杀
        if (target.safe && key !== 'subassassin') {
          alert(`【提示】: 该玩家被僧侣或老板守护中，常规击杀将被自动免除！如果你强行处死，可手动保存。`);
        }
        
        target.dead = true;
        target.hasVoteToken = true; // 死亡标记给予
        this.addLog(step.name, `杀害了 [${target.name}] 💀`);
      }, true); // 仅显示存活者做刺杀目标
    }

    // 4. 水手宿醉类 (水手)
    else if (key === 'sailor') {
      this.createNightSelectorRow(container, "水手拼酒目标:", (targetIdx) => {
        // 随机一人醉酒
        const rand = Math.random() < 0.5;
        if (rand) {
          player.drunk = true;
          this.addLog(step.name, `水手醉酒了 🍺`);
        } else {
          this.state.players[targetIdx].drunk = true;
          this.addLog(step.name, `让目标 [${this.state.players[targetIdx].name}] 醉酒了 🍺`);
        }
      });
    }

    // 5. 洗脑类 (洗脑师)
    else if (key === 'cerenovus') {
      this.createNightSelectorRow(container, "洗脑控制目标:", (targetIdx) => {
        this.state.players[targetIdx].drunk = true; // 视作某种软性异常
        this.addLog(step.name, `洗脑控制了 [${this.state.players[targetIdx].name}]`);
      });
    }
  }

  createNightSelectorRow(container, labelText, onApplyCallback, onlyAlive = false) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.flexDirection = 'column';
    row.style.gap = '6px';
    row.style.background = 'rgba(0,0,0,0.3)';
    row.style.padding = '10px';
    row.style.borderRadius = '8px';
    row.style.border = '1px solid rgba(255,255,255,0.05)';

    const label = document.createElement('span');
    label.innerText = labelText;
    label.style.fontSize = '0.8rem';
    label.style.color = 'hsl(var(--gold))';
    label.style.fontWeight = 'bold';

    const select = document.createElement('select');
    select.className = 'form-control';
    
    // 增加空选择占位
    const placeholder = document.createElement('option');
    placeholder.value = "";
    placeholder.innerText = "-- 请点击选择目标玩家 --";
    select.appendChild(placeholder);

    this.state.players.forEach(p => {
      if (onlyAlive && p.dead) return;
      const opt = document.createElement('option');
      opt.value = p.index;
      opt.innerText = `${p.index + 1}号: ${p.name} ${p.dead ? '(已死)' : '(存活)'}`;
      select.appendChild(opt);
    });

    select.onchange = (e) => {
      const val = e.target.value;
      if (val !== "") {
        onApplyCallback(parseInt(val));
        this.saveToLocalStorage();
      }
    };

    row.appendChild(label);
    row.appendChild(select);
    container.appendChild(row);
  }

  prevNightStep() {
    if (this.state.nightGuide.currentIndex > 0) {
      this.state.nightGuide.currentIndex--;
      this.renderNightStep();
    }
  }

  nextNightStep() {
    const guide = this.state.nightGuide;
    if (guide.currentIndex < guide.steps.length - 1) {
      guide.currentIndex++;
      this.renderNightStep();
    } else {
      // 流程完结，天明拂晓
      this.closeNightGuide();
      this.state.phase = 'day';
      this.state.dayNumber++;
      this.addLog("系统", `黎明拂晓，天亮了。进入第 ${this.state.dayNumber} 天白天！说书人请宣布昨晚死讯并开始日间公聊提名。`);
      this.renderGrimoireCircle();
      this.saveToLocalStorage();
    }
  }

  closeNightGuide() {
    document.getElementById('night-guide-modal').classList.remove('active');
  }

  // ==========================================
  // 说书人秘密日志 (ST Logs)
  // ==========================================

  addLog(speaker, content) {
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    this.state.logs.push(`[${timestamp}] <strong>${speaker}</strong>: ${content}`);
    this.renderLogs();
    this.saveToLocalStorage();
  }

  renderLogs() {
    const container = document.getElementById('grimoire-logs-container');
    container.innerHTML = '';
    
    // 反向循环，让最新的日志展示在最顶端，极度人性化！
    for (let i = this.state.logs.length - 1; i >= 0; i--) {
      const row = document.createElement('div');
      row.className = 'log-entry';
      row.innerHTML = this.state.logs[i];
      container.appendChild(row);
    }
  }

  clearLogs() {
    this.state.logs = [];
    this.addLog("系统", "日志已被说书人手动清空。");
  }

  // ==========================================
  // 重置机制与退出
  // ==========================================

  resetEntireGame() {
    localStorage.removeItem('botc_grim_state');
    // 彻底重置
    this.state.view = 'setup-view';
    this.state.players = [];
    this.state.pool = [];
    this.state.logs = [];
    this.state.dayNumber = 1;
    this.state.phase = 'night';
    
    window.location.reload();
  }

  // ==========================================
  // 全局辅助方法 (Helpers)
  // ==========================================

  findRoleData(key) {
    // 跨剧本全局检索
    let found = null;
    Object.keys(ROLES_DATA).forEach(scriptKey => {
      const char = ROLES_DATA[scriptKey].characters[key];
      if (char) found = char;
    });
    return found;
  }

  getRoleTypeCN(type) {
    const map = {
      townsfolk: '村民',
      outsider: '外来者',
      minion: '爪牙',
      demon: '恶魔'
    };
    return map[type] || type;
  }

  getRoleTypeColor(type) {
    const map = {
      townsfolk: '#5dade2',
      outsider: '#f5b041',
      minion: '#ec7063',
      demon: '#ff6b6b'
    };
    return map[type] || '#fff';
  }

  getRandomSubarray(arr, size) {
    const shuffled = arr.slice(0).sort(() => 0.5 - Math.random());
    return shuffled.slice(0, size);
  }
}

// 挂载全局实例
window.app = new AppController();

// 网页 DOM 结构准备完毕后立即执行
document.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
