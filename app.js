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
      },
      currentNightRecord: {},    // 当晚玩家行动与获得信息临时记录
      fortuneTellerRedHerring: "", // 占卜师宿敌 (红鲱鱼) 玩家索引
      nightRecords: {},             // 历夜说书人备忘历史记录
      fangguJumped: false,          // 方古是否已经触发过外来者夺舍夺命变恶魔
      godfatherModifier: 1          // 教父外来者变更偏好 (1 为 +1, -1 为 -1)
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
          const scriptKey = parts[5] || 'tb';
          
          this.playerViewScript = scriptKey;

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
      this.state.pool = []; // 切换剧本时，自动重置角色池以防污染
      this.updateDistributionBadges(); // 重新计算分发席位
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

  getCurrentDistributionRules() {
    const baseRules = this.distributionRules[this.state.playerCount];
    if (!baseRules) {
      return { townsfolk: 0, outsider: 0, minion: 0, demon: 0 };
    }
    const rules = { ...baseRules };
    if (this.state.pool && this.state.pool.includes('baron')) {
      rules.townsfolk = Math.max(0, rules.townsfolk - 2);
      rules.outsider = rules.outsider + 2;
    }
    if (this.state.pool && this.state.pool.includes('fanggu')) {
      rules.townsfolk = Math.max(0, rules.townsfolk - 1);
      rules.outsider = rules.outsider + 1;
    }
    if (this.state.pool && this.state.pool.includes('godfather')) {
      const mod = this.state.godfatherModifier !== undefined ? this.state.godfatherModifier : 1;
      if (mod === 1) {
        rules.townsfolk = Math.max(0, rules.townsfolk - 1);
        rules.outsider = rules.outsider + 1;
      } else if (mod === -1) {
        rules.townsfolk = rules.townsfolk + 1;
        rules.outsider = Math.max(0, rules.outsider - 1);
      }
    }
    return rules;
  }

  updateDistributionBadges() {
    const rules = this.getCurrentDistributionRules();
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

  updatePuzzlemasterDrunkSelectOptions() {
    const fakeSelect = document.getElementById('puzzlemaster-drunk-role-select');
    if (!fakeSelect) return;

    const currentVal = this.state.puzzlemasterDrunkRole;
    fakeSelect.innerHTML = '';

    // 可选的善良角色 (村民 + 外来者, 排除解谜大师自身)，且必须已被勾选在 pool 中
    const selectedGoodRoles = [
      ...this.getAvailableRolesList('townsfolk'),
      ...this.getAvailableRolesList('outsider')
    ].filter(r => r.key !== 'puzzlemaster' && this.state.pool.includes(r.key));

    if (selectedGoodRoles.length > 0) {
      selectedGoodRoles.forEach(tf => {
        const opt = document.createElement('option');
        opt.value = tf.key;
        opt.innerText = tf.name;
        fakeSelect.appendChild(opt);
      });

      // 尽量保留之前的选择，如果之前选择 of 依然有效；否则默认选第一个
      if (currentVal && selectedGoodRoles.some(r => r.key === currentVal)) {
        fakeSelect.value = currentVal;
        this.state.puzzlemasterDrunkRole = currentVal;
      } else {
        fakeSelect.value = selectedGoodRoles[0].key;
        this.state.puzzlemasterDrunkRole = selectedGoodRoles[0].key;
      }
    } else {
      const opt = document.createElement('option');
      opt.value = '';
      opt.innerText = '请先勾选其他好人角色';
      fakeSelect.appendChild(opt);
      this.state.puzzlemasterDrunkRole = '';
    }
  }

  renderPoolSelectionView() {
    // 渲染各类别角色勾选框
    this.renderPoolCategoryGrid('townsfolk', 'pool-grid-townsfolk');
    this.renderPoolCategoryGrid('outsider', 'pool-grid-outsider');
    this.renderPoolCategoryGrid('minion', 'pool-grid-minion');
    this.renderPoolCategoryGrid('demon', 'pool-grid-demon');

    this.updatePoolStatusText();
    // 动态初始化解谜大师可选角色下拉框
    this.updatePuzzlemasterDrunkSelectOptions();
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
      if (item.key === 'drunk' || item.key === 'puzzlemaster' || item.key === 'marionette') {
        label.style.flexWrap = 'wrap'; // 允许换行以便下拉框显示在下方
      }
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = isChecked;
      
      // 动态酒鬼下拉框容器
      let selectContainer = null;
      if (item.key === 'drunk') {
        selectContainer = document.createElement('div');
        selectContainer.className = 'drunk-fake-select-container';
        selectContainer.style.marginTop = '8px';
        selectContainer.style.width = '100%';
        selectContainer.style.display = isChecked ? 'block' : 'none';
        selectContainer.style.borderTop = '1px solid rgba(255,255,255,0.05)';
        selectContainer.style.paddingTop = '6px';
        
        // 阻止点击下拉框时触发外部 label 的勾选状态切换
        selectContainer.onclick = (e) => e.stopPropagation();

        const labelSpan = document.createElement('div');
        labelSpan.innerText = '酒鬼伪装村民选择：';
        labelSpan.style.fontSize = '0.7rem';
        labelSpan.style.color = 'hsl(var(--gold))';
        labelSpan.style.marginBottom = '4px';
        labelSpan.style.fontWeight = 'bold';
        
        const fakeSelect = document.createElement('select');
        fakeSelect.className = 'form-control';
        fakeSelect.style.fontSize = '0.75rem';
        fakeSelect.style.padding = '4px 8px';
        fakeSelect.style.height = 'auto';
        fakeSelect.style.width = '100%';
        fakeSelect.style.background = 'rgba(0,0,0,0.6)';
        fakeSelect.style.border = '1px solid hsla(var(--gold), 0.3)';
        fakeSelect.style.color = '#fff';
        fakeSelect.style.borderRadius = '4px';
        
        const townsfolkList = this.getAvailableRolesList('townsfolk');
        townsfolkList.forEach(tf => {
          const opt = document.createElement('option');
          opt.value = tf.key;
          opt.innerText = tf.name;
          fakeSelect.appendChild(opt);
        });

        // 默认初始化
        if (!this.state.drunkRole && townsfolkList.length > 0) {
          this.state.drunkRole = townsfolkList[0].key;
        }
        fakeSelect.value = this.state.drunkRole || '';

        fakeSelect.onchange = (e) => {
          this.state.drunkRole = e.target.value;
          this.saveToLocalStorage();
        };

        selectContainer.appendChild(labelSpan);
        selectContainer.appendChild(fakeSelect);
      }

      // 动态解谜大师下拉框容器
      if (item.key === 'puzzlemaster') {
        selectContainer = document.createElement('div');
        selectContainer.className = 'puzzlemaster-drunk-select-container';
        selectContainer.style.marginTop = '8px';
        selectContainer.style.width = '100%';
        selectContainer.style.display = isChecked ? 'block' : 'none';
        selectContainer.style.borderTop = '1px solid rgba(255,255,255,0.05)';
        selectContainer.style.paddingTop = '6px';
        
        selectContainer.onclick = (e) => e.stopPropagation();

        const labelSpan = document.createElement('div');
        labelSpan.innerText = '指定被醉酒善良角色：';
        labelSpan.style.fontSize = '0.7rem';
        labelSpan.style.color = 'hsl(var(--gold))';
        labelSpan.style.marginBottom = '4px';
        labelSpan.style.fontWeight = 'bold';
        
        const fakeSelect = document.createElement('select');
        fakeSelect.id = 'puzzlemaster-drunk-role-select';
        fakeSelect.className = 'form-control';
        fakeSelect.style.fontSize = '0.75rem';
        fakeSelect.style.padding = '4px 8px';
        fakeSelect.style.height = 'auto';
        fakeSelect.style.width = '100%';
        fakeSelect.style.background = 'rgba(0,0,0,0.6)';
        fakeSelect.style.border = '1px solid hsla(var(--gold), 0.3)';
        fakeSelect.style.color = '#fff';
        fakeSelect.style.borderRadius = '4px';
        
        fakeSelect.onchange = (e) => {
          this.state.puzzlemasterDrunkRole = e.target.value;
          this.saveToLocalStorage();
        };

        selectContainer.appendChild(labelSpan);
        selectContainer.appendChild(fakeSelect);
      }

      // 动态提线木偶下拉框容器
      if (item.key === 'marionette') {
        selectContainer = document.createElement('div');
        selectContainer.className = 'marionette-fake-select-container';
        selectContainer.style.marginTop = '8px';
        selectContainer.style.width = '100%';
        selectContainer.style.display = isChecked ? 'block' : 'none';
        selectContainer.style.borderTop = '1px solid rgba(255,255,255,0.05)';
        selectContainer.style.paddingTop = '6px';
        
        selectContainer.onclick = (e) => e.stopPropagation();

        const labelSpan = document.createElement('div');
        labelSpan.innerText = '提线木偶伪装好人角色：';
        labelSpan.style.fontSize = '0.7rem';
        labelSpan.style.color = 'hsl(var(--gold))';
        labelSpan.style.marginBottom = '4px';
        labelSpan.style.fontWeight = 'bold';
        
        const fakeSelect = document.createElement('select');
        fakeSelect.className = 'form-control';
        fakeSelect.style.fontSize = '0.75rem';
        fakeSelect.style.padding = '4px 8px';
        fakeSelect.style.height = 'auto';
        fakeSelect.style.width = '100%';
        fakeSelect.style.background = 'rgba(0,0,0,0.6)';
        fakeSelect.style.border = '1px solid hsla(var(--gold), 0.3)';
        fakeSelect.style.color = '#fff';
        fakeSelect.style.borderRadius = '4px';
        
        // 可选的所有好人角色 (村民 + 外来者)
        const goodRoles = [
          ...this.getAvailableRolesList('townsfolk'),
          ...this.getAvailableRolesList('outsider')
        ];
        
        goodRoles.forEach(tf => {
          const opt = document.createElement('option');
          opt.value = tf.key;
          opt.innerText = tf.name;
          fakeSelect.appendChild(opt);
        });

        // 默认初始化
        if (!this.state.marionetteRole && goodRoles.length > 0) {
          this.state.marionetteRole = goodRoles[0].key;
        }
        fakeSelect.value = this.state.marionetteRole || '';

        fakeSelect.onchange = (e) => {
          this.state.marionetteRole = e.target.value;
          this.saveToLocalStorage();
        };

        selectContainer.appendChild(labelSpan);
        selectContainer.appendChild(fakeSelect);
      }

      checkbox.onchange = (e) => {
        if (e.target.checked) {
          if (!this.state.pool.includes(item.key)) {
            this.state.pool.push(item.key);
          }
          label.classList.add('checked');
          if (selectContainer) selectContainer.style.display = 'block';
        } else {
          this.state.pool = this.state.pool.filter(k => k !== item.key);
          label.classList.remove('checked');
          if (selectContainer) selectContainer.style.display = 'none';
        }
        this.updatePoolStatusText();
        this.updatePuzzlemasterDrunkSelectOptions();
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

      // 单独的角色说明 ⓘ 按钮，点击不切换勾选状态，而是弹窗角色说明
      const infoBtn = document.createElement('div');
      infoBtn.className = 'role-checkbox-info-btn';
      infoBtn.innerText = 'ⓘ';
      infoBtn.style.marginLeft = 'auto';
      infoBtn.style.cursor = 'pointer';
      infoBtn.style.fontSize = '0.75rem';
      infoBtn.style.color = 'hsla(var(--gold), 0.5)';
      infoBtn.style.width = '20px';
      infoBtn.style.height = '20px';
      infoBtn.style.borderRadius = '50%';
      infoBtn.style.display = 'flex';
      infoBtn.style.alignItems = 'center';
      infoBtn.style.justifyContent = 'center';
      infoBtn.style.border = '1px solid hsla(var(--gold), 0.2)';
      infoBtn.style.zIndex = '5';
      infoBtn.style.transition = 'all 0.15s ease';

      infoBtn.onmouseover = () => {
        infoBtn.style.color = 'hsl(var(--gold))';
        infoBtn.style.border = '1px solid hsl(var(--gold))';
        infoBtn.style.background = 'rgba(212, 175, 55, 0.15)';
      };
      infoBtn.onmouseout = () => {
        infoBtn.style.color = 'hsla(var(--gold), 0.5)';
        infoBtn.style.border = '1px solid hsla(var(--gold), 0.2)';
        infoBtn.style.background = 'transparent';
      };

      infoBtn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.openSingleRoleModal(item.key);
      };

      label.appendChild(checkbox);
      label.appendChild(avatar);
      label.appendChild(info);
      label.appendChild(infoBtn);
      if (selectContainer) {
        label.appendChild(selectContainer);
      }
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
    const rules = this.getCurrentDistributionRules();
    
    // 分类统计已选中的角色数量
    let selectedTownsfolk = 0;
    let selectedOutsider = 0;
    let selectedMinion = 0;
    let selectedDemon = 0;

    this.state.pool.forEach(key => {
      const char = this.findRoleData(key);
      if (char) {
        if (char.type === 'townsfolk') selectedTownsfolk++;
        else if (char.type === 'outsider') selectedOutsider++;
        else if (char.type === 'minion') selectedMinion++;
        else if (char.type === 'demon') selectedDemon++;
      }
    });

    const totalNeeded = rules.townsfolk + rules.outsider + rules.minion + rules.demon;
    badge.innerText = `已选 ${this.state.pool.length} / ${totalNeeded}`;

    // 动态更新各类角色名额及已勾选指示器 (格式: 选 X / Y，极度直观方便)
    const tfEl = document.getElementById('pool-count-townsfolk');
    const outEl = document.getElementById('pool-count-outsider');
    const minEl = document.getElementById('pool-count-minion');
    const demEl = document.getElementById('pool-count-demon');
    if (tfEl) tfEl.innerText = `选 ${selectedTownsfolk} / ${rules.townsfolk}`;
    if (outEl) outEl.innerText = `选 ${selectedOutsider} / ${rules.outsider}`;
    if (minEl) minEl.innerText = `选 ${selectedMinion} / ${rules.minion}`;
    if (demEl) demEl.innerText = `选 ${selectedDemon} / ${rules.demon}`;

    const nextBtn = document.getElementById('btn-pool-next');
    if (this.state.pool.length >= totalNeeded) {
      nextBtn.removeAttribute('disabled');
      badge.style.color = 'hsl(var(--gold))';
    } else {
      nextBtn.setAttribute('disabled', 'true');
      badge.style.color = 'hsl(var(--text-muted))';
    }

    // 动态控制教父外来者变更 UI
    const gfContainer = document.getElementById('godfather-modifier-container');
    if (gfContainer) {
      if (this.state.pool && this.state.pool.includes('godfather')) {
        gfContainer.style.display = 'flex';
        const mod = this.state.godfatherModifier !== undefined ? this.state.godfatherModifier : 1;
        const radios = document.getElementsByName('godfather-mod');
        for (let r of radios) {
          if (r.value === 'plus' && mod === 1) r.checked = true;
          if (r.value === 'minus' && mod === -1) r.checked = true;
        }
      } else {
        gfContainer.style.display = 'none';
      }
    }
  }

  setGodfatherModifier(val) {
    this.state.godfatherModifier = val;
    this.updatePoolStatusText();
    this.saveToLocalStorage();
  }

  clearPoolSelection() {
    this.state.pool = [];
    this.renderPoolSelectionView();
    this.saveToLocalStorage();
  }

  // 匹配名额一键随机勾选
  autoRandomPool() {
    this.state.pool = [];
    const baseRules = this.distributionRules[this.state.playerCount];

    // 1. 先抽取 恶魔 和 爪牙 (Minions & Demons)
    const minionList = this.getAvailableRolesList('minion');
    const minionShuffled = [...minionList].sort(() => 0.5 - Math.random());
    const selectedMinions = minionShuffled.slice(0, baseRules.minion);
    selectedMinions.forEach(item => this.state.pool.push(item.key));

    const demonList = this.getAvailableRolesList('demon');
    const demonShuffled = [...demonList].sort(() => 0.5 - Math.random());
    const selectedDemons = demonShuffled.slice(0, baseRules.demon);
    selectedDemons.forEach(item => this.state.pool.push(item.key));

    // 2. 依据是否包含“男爵”动态计算当前的分配名额规则
    const rules = this.getCurrentDistributionRules();

    // 3. 抽取外来者 (Outsiders)
    const outsiderList = this.getAvailableRolesList('outsider');
    const outsiderShuffled = [...outsiderList].sort(() => 0.5 - Math.random());
    const selectedOutsiders = outsiderShuffled.slice(0, rules.outsider);
    selectedOutsiders.forEach(item => this.state.pool.push(item.key));

    // 4. 抽取村民 (Townsfolk)
    const townsfolkList = this.getAvailableRolesList('townsfolk');
    const townsfolkShuffled = [...townsfolkList].sort(() => 0.5 - Math.random());
    const selectedTownsfolk = townsfolkShuffled.slice(0, rules.townsfolk);
    selectedTownsfolk.forEach(item => this.state.pool.push(item.key));

    // 如果随机勾选了酒鬼，确保其有一个伪装角色
    if (this.state.pool.includes('drunk') && !this.state.drunkRole) {
      if (townsfolkList.length > 0) {
        this.state.drunkRole = townsfolkList[Math.floor(Math.random() * townsfolkList.length)].key;
      }
    }

    // 如果随机勾选了解谜大师，确保从被勾选的善良角色中随机指定一个被解谜大师醉酒的角色
    if (this.state.pool.includes('puzzlemaster')) {
      const goodRolesInPool = [
        ...this.getAvailableRolesList('townsfolk'),
        ...this.getAvailableRolesList('outsider')
      ].filter(r => r.key !== 'puzzlemaster' && this.state.pool.includes(r.key));
      
      if (goodRolesInPool.length > 0) {
        if (!this.state.puzzlemasterDrunkRole || !goodRolesInPool.some(r => r.key === this.state.puzzlemasterDrunkRole)) {
          this.state.puzzlemasterDrunkRole = goodRolesInPool[Math.floor(Math.random() * goodRolesInPool.length)].key;
        }
      } else {
        this.state.puzzlemasterDrunkRole = '';
      }
    }

    // 如果随机勾选了提线木偶，确保其有一个好人伪装角色
    if (this.state.pool.includes('marionette') && !this.state.marionetteRole) {
      const goodRoles = [
        ...this.getAvailableRolesList('townsfolk'),
        ...this.getAvailableRolesList('outsider')
      ];
      if (goodRoles.length > 0) {
        this.state.marionetteRole = goodRoles[Math.floor(Math.random() * goodRoles.length)].key;
      }
    }

    this.renderPoolSelectionView();
    this.saveToLocalStorage();
  }

  // ==========================================
  // 视图 3: 身份分发页逻辑 (Distribution View)
  // ==========================================

  goToDistribution() {
    const rules = this.getCurrentDistributionRules();
    
    // 1. 统计各个分类的已勾选角色
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

    // 2. 严格的下限校验：防止抽取时数量不足
    if (poolTownsfolk.length < rules.townsfolk) {
      alert(`【角色结构不合规】\n\n本局需要至少 ${rules.townsfolk} 个村民，但您仅勾选了 ${poolTownsfolk.length} 个村民角色！请在村民池中多勾选一些。`);
      return;
    }
    if (poolOutsider.length < rules.outsider) {
      const hasBaron = this.state.pool.includes('baron');
      const hasFanggu = this.state.pool.includes('fanggu');
      const hasGodfather = this.state.pool.includes('godfather');
      let tips = [];
      if (hasBaron) tips.push('已选男爵 (外来者+2)');
      if (hasFanggu) tips.push('已选蚀梦游魂 (外来者+1)');
      if (hasGodfather) {
        const mod = this.state.godfatherModifier !== undefined ? this.state.godfatherModifier : 1;
        tips.push(`已选教父 (外来者${mod > 0 ? '+1' : '-1'})`);
      }
      let tip = tips.length > 0 ? `当前配置了：${tips.join('，')}，已重新计算外来者席位` : '未勾选任何修改外来者配置的角色';
      alert(`【角色结构不合规】\n\n本局需要至少 ${rules.outsider} 个外来者，但您仅勾选了 ${poolOutsider.length} 个外来者角色！\n\n提示：${tip}。请在外来者池中多勾选角色。`);
      return;
    }
    if (poolMinion.length < rules.minion) {
      alert(`【角色结构不合规】\n\n本局需要至少 ${rules.minion} 个爪牙，但您仅勾选了 ${poolMinion.length} 个爪牙角色！请在爪牙池中多勾选一些。`);
      return;
    }
    if (poolDemon.length < rules.demon) {
      alert(`【角色结构不合规】\n\n本局需要至少 ${rules.demon} 个恶魔，但您仅勾选了 ${poolDemon.length} 个恶魔角色！请在恶魔池中多勾选一些。`);
      return;
    }

    // 3. 严格的外来者上限校验：防止多选外来者破坏游戏平衡
    if (poolOutsider.length > rules.outsider) {
      if (rules.outsider === 0) {
        alert(`【角色结构不合规】\n\n当前人数配置不需要任何【外来者】。但您在池中勾选了 ${poolOutsider.length} 个外来者角色！\n\n若想加入外来者，请在爪牙池中勾选【男爵】（Baron）、【教父】（Godfather）或在恶魔池中勾选【蚀梦游魂】（Fang Gu）。`);
      } else {
        alert(`【角色结构不合规】\n\n本局限制最多只能有 ${rules.outsider} 个【外来者】。但您在池中勾选了 ${poolOutsider.length} 个外来者角色！\n\n请在下方外来者列表中取消多余的外来者勾选，或者在爪牙/恶魔池中勾选【男爵】/【蚀梦游魂】/【教父】来增加外来者席位。`);
      }
      return;
    }

    // 校验通过，初始化分发状态
    this.state.distCurrentIndex = 0;
    this.state.distRevealed = false;
    this.state.distManualRoles = {};
    this.state.distQRPlayersDone = new Array(this.state.playerCount).fill(false);

    // 随机把角色池中的部分角色洗入真实发牌池 (如果说书人多勾选了，则随机抽)
    this.distributeFinalRolesPool();

    this.renderDistributionView();
    this.switchView('dist-view');
  }


  distributeFinalRolesPool() {
    const rules = this.getCurrentDistributionRules();
    
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

    // 提线木偶与恶魔物理相邻自校准
    if (finalShuffled.includes('marionette')) {
      const demonIdx = finalShuffled.findIndex(role => {
        const data = this.findRoleData(role);
        return data && data.type === 'demon';
      });
      if (demonIdx !== -1) {
        const marioIdx = finalShuffled.indexOf('marionette');
        const diff = Math.abs(marioIdx - demonIdx);
        const isAdjacent = (diff === 1 || diff === finalShuffled.length - 1);
        if (!isAdjacent) {
          const targetSeat = Math.random() < 0.5 
            ? (demonIdx - 1 + finalShuffled.length) % finalShuffled.length
            : (demonIdx + 1) % finalShuffled.length;
          const temp = finalShuffled[marioIdx];
          finalShuffled[marioIdx] = finalShuffled[targetSeat];
          finalShuffled[targetSeat] = temp;
        }
      }
    }

    // 解谜大师首夜指定被醉酒角色校验：
    // 如果解谜大师在场，我们检查指定的醉酒角色 puzzlemasterDrunkRole 是否在 finalShuffled 中。
    // 如果没有指定，或者指定的角色恰好没有被分配到本局中，则从本局已分配的好人角色（Townsfolk/Outsider）中随机选一个作为实际生效的醉酒角色！
    if (finalShuffled.includes('puzzlemaster')) {
      let targetRole = this.state.puzzlemasterDrunkRole;
      if (!targetRole || !finalShuffled.includes(targetRole)) {
        const goodRolesInPlay = finalShuffled.filter(role => {
          const rData = this.findRoleData(role);
          return rData && ['townsfolk', 'outsider'].includes(rData.type) && role !== 'puzzlemaster';
        });
        if (goodRolesInPlay.length > 0) {
          targetRole = goodRolesInPlay[Math.floor(Math.random() * goodRolesInPlay.length)];
        }
      }
      this.state.puzzlemasterDrunkRole = targetRole;
    }

    // 重置方古夺舍标记
    this.state.fangguJumped = false;

    // 灌入初始玩家模型数组
    this.state.players = [];
    for (let i = 0; i < this.state.playerCount; i++) {
      const roleKey = finalShuffled[i];
      const charData = this.findRoleData(roleKey);
      const isDrunkRole = (roleKey === 'drunk');
      const isPuzzlemasterDrunk = (roleKey === this.state.puzzlemasterDrunkRole) && finalShuffled.includes('puzzlemaster');
      
      this.state.players.push({
        index: i,
        name: this.state.playerNames[i],
        role: roleKey,
        roleData: charData,
        dead: false,
        deathType: null, // 死亡类型：null, 'killed', 'executed'
        hasVoteToken: true,
        poisoned: false,
        drunk: (isDrunkRole || isPuzzlemasterDrunk) ? true : false, // 自动置为醉酒
        drunkRole: isDrunkRole ? (this.state.drunkRole || '') : undefined, // 继承说书人的指定伪装
        marionetteRole: (roleKey === 'marionette') ? (this.state.marionetteRole || '') : undefined, // 继承说书人的指定伪装
        puzzlemasterDrunk: isPuzzlemasterDrunk ? true : undefined, // 额外做个解谜大师醉酒标记
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
        if (val === 'drunk') {
          this.state.players[i].drunk = true;
          this.state.players[i].drunkRole = this.state.drunkRole || '';
        } else {
          delete this.state.players[i].drunkRole;
        }
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
      
      // 酒鬼发牌伪装逻辑：如果真实角色是酒鬼，则向玩家显示其伪装的村民卡牌信息
      if (playerObj.role === 'drunk' && playerObj.drunkRole) {
        char = this.findRoleData(playerObj.drunkRole) || char;
      }
      
      // 提线木偶发牌伪装逻辑：如果真实角色是提线木偶，则向玩家显示其伪装的善良卡牌信息
      if (playerObj.role === 'marionette' && playerObj.marionetteRole) {
        char = this.findRoleData(playerObj.marionetteRole) || char;
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

    if (p.role === 'drunk' && p.drunkRole) {
      const fakeChar = this.findRoleData(p.drunkRole);
      if (fakeChar) {
        roleKey = p.drunkRole;
        roleName = fakeChar.name;
        roleType = fakeChar.type;
        roleAbility = fakeChar.ability;
      }
    }

    if (p.role === 'marionette' && p.marionetteRole) {
      const fakeChar = this.findRoleData(p.marionetteRole);
      if (fakeChar) {
        roleKey = p.marionetteRole;
        roleName = fakeChar.name;
        roleType = fakeChar.type;
        roleAbility = fakeChar.ability;
      }
    }

    // 序列化编码玩家数据至 URL 参数以供完全解密
    const secretPayload = `${p.name}::${roleKey}::${roleName}::${roleType}::${roleAbility}::${this.state.script}`;
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
    
    this.state.fangguJumped = false;
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

    // 酒鬼说书人提醒机制：检测是否有玩家分配到“酒鬼”身份
    const drunkPlayer = this.state.players.find(p => p.role === 'drunk');
    if (drunkPlayer && drunkPlayer.drunkRole) {
      const fakeChar = this.findRoleData(drunkPlayer.drunkRole);
      const fakeName = fakeChar ? fakeChar.name : drunkPlayer.drunkRole;
      
      setTimeout(() => {
        alert(`【🚨 说书人重要警示 - 酒鬼已配置】\n\n本局游戏中有玩家分配到了【酒鬼】(Drunk) 角色！\n\n👤 玩家名称: ${drunkPlayer.name} (座位号 ${drunkPlayer.index + 1})\n🎭 伪装村民: ${fakeName}\n\n该玩家刚才在看牌时被告知他是【${fakeName}】。\n\n说书人重要提示：\n1. 他不知道自己是酒鬼，他以为自己是【${fakeName}】；\n2. 他的所有技能都失效，你需要根据【${fakeName}】的醒来顺序唤醒他，并向他提供完全【虚假/错误】的信息。`);
      }, lunaticPlayer ? 800 : 300);
      
      this.addLog("系统", `🚨 <strong>说书人警示</strong>: 玩家 [${drunkPlayer.name}] (座位 ${drunkPlayer.index + 1}) 的真实角色为【酒鬼】，他以为自己是村民【${fakeName}】。`);
    }

    // 解谜大师说书人提醒机制：检测是否有玩家因解谜大师技能处于“解谜大师醉酒”状态
    const pmDrunkPlayer = this.state.players.find(p => p.puzzlemasterDrunk);
    if (pmDrunkPlayer) {
      const pmDrunkRoleChar = pmDrunkPlayer.roleData;
      const pmDrunkRoleName = pmDrunkRoleChar ? pmDrunkRoleChar.name : pmDrunkPlayer.role;
      
      setTimeout(() => {
        alert(`【🚨 说书人重要警示 - 解谜大师醉酒已配置】\n\n本局游戏中有玩家因【解谜大师】技能处于【醉酒】状态！\n\n👤 玩家名称: ${pmDrunkPlayer.name} (座位号 ${pmDrunkPlayer.index + 1})\n🎭 真实身份: ${pmDrunkRoleName}\n\n该玩家刚才在看牌或扫码时【只知道自己是真实角色，完全不知道自己已醉酒】！\n\n说书人重要提示：\n1. 他不知道自己已醉酒，他以为自己是正常的村民/外来者；\n2. 他的所有技能都失效，你需要向其提供完全【虚假/错误】的信息；\n3. 他的醉酒状态已在您的魔典中以【🍺 醉酒】徽章高亮标记出来。`);
      }, (lunaticPlayer && drunkPlayer) ? 1300 : (lunaticPlayer || drunkPlayer) ? 800 : 300);
      
      this.addLog("系统", `🚨 <strong>说书人警示</strong>: 玩家 [${pmDrunkPlayer.name}] (座位 ${pmDrunkPlayer.index + 1}) 的真实角色为【${pmDrunkRoleName}】，他因解谜大师能力处于【醉酒】状态，其技能已失效，但看牌时完全不知情。`);
    }

    // 提线木偶说书人提醒机制：检测是否有玩家分配到“提线木偶”身份，如果有则提示说书人其真身与伪装身份
    const marionettePlayer = this.state.players.find(p => p.role === 'marionette');
    if (marionettePlayer && marionettePlayer.marionetteRole) {
      const fakeChar = this.findRoleData(marionettePlayer.marionetteRole);
      const fakeName = fakeChar ? fakeChar.name : marionettePlayer.marionetteRole;
      
      setTimeout(() => {
        alert(`【🚨 说书人重要警示 - 提线木偶已配置】\n\n本局游戏中有玩家分配到了【提线木偶】(Marionette) 角色！\n\n👤 玩家名称: ${marionettePlayer.name} (座位号 ${marionettePlayer.index + 1})\n🎭 伪装好人: ${fakeName}\n\n该玩家刚才在看牌时被告知他是【${fakeName}】。\n\n说书人重要提示：\n1. 他不知道自己是提线木偶，他以为自己是【${fakeName}】并且是善良阵营；\n2. 他的技能失效（如果他以为的那个角色有技能的话），你需要按照【${fakeName}】的醒来顺序唤醒他，并向他提供【虚假/错误】的信息；\n3. 他的座位必须在恶魔的隔壁（物理邻居，本助手在发牌时已自动调整）。`);
      }, (lunaticPlayer && drunkPlayer && pmDrunkPlayer) ? 1800 : (lunaticPlayer || drunkPlayer || pmDrunkPlayer) ? 1200 : 300);
      
      this.addLog("系统", `🚨 <strong>说书人警示</strong>: 玩家 [${marionettePlayer.name}] (座位 ${marionettePlayer.index + 1}) 的真实角色为【提线木偶】，他以为自己是好人【${fakeName}】。其座位必须与恶魔相邻。`);
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
      seat.className = `player-seat-node ${p.dead ? 'dead' : ''} ${p.dead ? (p.deathType === 'executed' ? 'death-executed' : 'death-killed') : ''}`;
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
      if (p.role === 'drunk' && p.drunkRole) {
        const fakeChar = this.findRoleData(p.drunkRole);
        rName.innerText = `${p.roleData.name} (${fakeChar ? fakeChar.name : p.drunkRole})`;
      } else if (p.role === 'marionette' && p.marionetteRole) {
        const fakeChar = this.findRoleData(p.marionetteRole);
        rName.innerText = `${p.roleData.name} (伪装: ${fakeChar ? fakeChar.name : p.marionetteRole})`;
      } else {
        rName.innerText = p.roleData.name;
      }
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

      if (this.state.fortuneTellerRedHerring !== "" && i === parseInt(this.state.fortuneTellerRedHerring)) {
        const b = document.createElement('div');
        b.className = 'state-bubble';
        b.style.background = '#e67e22';
        b.style.color = '#fff';
        b.innerText = "宿";
        b.title = "占卜师宿敌 (红鲱鱼) - 感知中始终注册为恶魔";
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
    this.renderLastNightMemo();
  }

  saveNightRecord(playerIndex, roleName, playerName, text) {
    if (!this.state.nightRecords) {
      this.state.nightRecords = {};
    }
    const nightKey = this.state.dayNumber;
    if (!this.state.nightRecords[nightKey]) {
      this.state.nightRecords[nightKey] = {};
    }
    this.state.nightRecords[nightKey][playerIndex] = {
      roleName: roleName,
      playerName: playerName,
      text: text
    };

    // Also sync to currentNightRecord for backwards compatibility
    if (!this.state.currentNightRecord) {
      this.state.currentNightRecord = {};
    }
    this.state.currentNightRecord[playerIndex] = {
      roleName: roleName,
      playerName: playerName,
      text: text
    };

    // 如果是首死发动技能的角色，记录已被唤醒结算并标志能力已使用
    const playerObj = this.state.players[playerIndex];
    if (playerObj) {
      let actualRole = playerObj.role;
      if (playerObj.role === 'drunk' && playerObj.drunkRole) {
        actualRole = playerObj.drunkRole;
      }
      if (['ravenkeeper', 'sage', 'barber', 'sweetheart'].includes(actualRole)) {
        playerObj.abilityUsed = true;
      }
    }

    this.addLog(playerName ? `${roleName} (${playerName})` : roleName, text);
    this.saveToLocalStorage();
  }

  renderLastNightMemo() {
    const card = document.getElementById('last-night-memo-card');
    const container = document.getElementById('last-night-memo-container');
    const phaseText = document.getElementById('last-night-memo-phase-text');
    
    if (!card || !container) return;

    const hasRecords = this.state.nightRecords && Object.keys(this.state.nightRecords).length > 0;
    
    if (hasRecords) {
      card.style.display = 'block';
      if (phaseText) {
        phaseText.innerText = `📋 玩家行动与信息历史备忘`;
      }
      
      container.innerHTML = '';
      
      // Sort nights descending to keep the most recent night at the top
      const nights = Object.keys(this.state.nightRecords).map(Number).sort((a, b) => b - a);
      
      nights.forEach(nightNum => {
        const nightGroup = document.createElement('div');
        nightGroup.style.marginBottom = '12px';
        
        const groupTitle = document.createElement('div');
        groupTitle.style.fontSize = '0.8rem';
        groupTitle.style.fontWeight = 'bold';
        groupTitle.style.color = 'hsl(var(--gold))';
        groupTitle.style.borderBottom = '1px solid rgba(212, 175, 55, 0.2)';
        groupTitle.style.paddingBottom = '4px';
        groupTitle.style.marginBottom = '6px';
        groupTitle.innerText = `★ 第 ${nightNum} 夜记录`;
        nightGroup.appendChild(groupTitle);
        
        const records = this.state.nightRecords[nightNum];
        Object.keys(records).forEach(playerIdxKey => {
          const record = records[playerIdxKey];
          const playerObj = this.state.players[playerIdxKey];
          if (!playerObj) return;

          const row = document.createElement('div');
          row.className = 'memo-entry-row';
          row.style.display = 'flex';
          row.style.flexDirection = 'column';
          row.style.gap = '4px';
          row.style.padding = '8px 10px';
          row.style.borderRadius = '6px';
          row.style.background = 'rgba(0, 0, 0, 0.2)';
          row.style.borderLeft = `3px solid ${this.getRoleTypeColor(playerObj.roleData.type)}`;
          row.style.marginBottom = '6px';
          
          const header = document.createElement('div');
          header.style.display = 'flex';
          header.style.justifyContent = 'space-between';
          header.style.fontSize = '0.75rem';
          header.style.fontWeight = 'bold';
          
          const nameSpan = document.createElement('span');
          nameSpan.innerText = `${record.roleName} (${record.playerName})`;
          nameSpan.style.color = this.getRoleTypeColor(playerObj.roleData.type);
          
          const statusSpan = document.createElement('span');
          let statuses = [];
          if (playerObj.poisoned) statuses.push('🧪中毒');
          if (playerObj.drunk) statuses.push('🍺醉酒');
          if (statuses.length > 0) {
            statusSpan.innerText = ` [${statuses.join('/')}下获取]`;
            statusSpan.style.color = '#e74c3c';
          }
          
          header.appendChild(nameSpan);
          header.appendChild(statusSpan);
          
          const content = document.createElement('div');
          content.style.fontSize = '0.8rem';
          content.style.color = '#e5e7eb';
          content.style.wordBreak = 'break-all';
          content.style.lineHeight = '1.35';
          content.innerText = record.text;
          
          row.appendChild(header);
          row.appendChild(content);
          nightGroup.appendChild(row);
        });
        
        container.appendChild(nightGroup);
      });
    } else {
      card.style.display = 'none';
    }
  }

  saveNightRecord(playerIndex, roleName, playerName, text) {
    if (!this.state.currentNightRecord) {
      this.state.currentNightRecord = {};
    }
    this.state.currentNightRecord[playerIndex] = {
      roleName: roleName,
      playerName: playerName,
      text: text
    };
    this.addLog(playerName ? `${roleName} (${playerName})` : roleName, text);
    this.saveToLocalStorage();
  }

  renderLastNightMemo() {
    const card = document.getElementById('last-night-memo-card');
    const container = document.getElementById('last-night-memo-container');
    const phaseText = document.getElementById('last-night-memo-phase-text');
    
    if (!card || !container) return;

    const hasRecords = this.state.currentNightRecord && Object.keys(this.state.currentNightRecord).length > 0;
    
    if (this.state.phase === 'day' && hasRecords) {
      card.style.display = 'block';
      if (phaseText) {
        phaseText.innerText = `第 ${this.state.dayNumber - 1} 夜晚记录`;
      }
      
      container.innerHTML = '';
      
      Object.keys(this.state.currentNightRecord).forEach(playerIdxKey => {
        const record = this.state.currentNightRecord[playerIdxKey];
        const playerObj = this.state.players[playerIdxKey];
        if (!playerObj) return;

        const row = document.createElement('div');
        row.className = 'memo-entry-row';
        row.style.display = 'flex';
        row.style.flexDirection = 'column';
        row.style.gap = '4px';
        row.style.padding = '8px 10px';
        row.style.borderRadius = '6px';
        row.style.background = 'rgba(0, 0, 0, 0.2)';
        row.style.borderLeft = `3px solid ${this.getRoleTypeColor(playerObj.roleData.type)}`;
        row.style.marginBottom = '6px';
        
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.fontSize = '0.75rem';
        header.style.fontWeight = 'bold';
        
        const nameSpan = document.createElement('span');
        nameSpan.innerText = `${record.roleName} (${record.playerName})`;
        nameSpan.style.color = this.getRoleTypeColor(playerObj.roleData.type);
        
        const statusSpan = document.createElement('span');
        let statuses = [];
        if (playerObj.poisoned) statuses.push('🧪中毒');
        if (playerObj.drunk) statuses.push('🍺醉酒');
        if (statuses.length > 0) {
          statusSpan.innerText = `[${statuses.join('/')}下获取]`;
          statusSpan.style.color = '#e74c3c';
        }
        
        header.appendChild(nameSpan);
        header.appendChild(statusSpan);
        
        const content = document.createElement('div');
        content.style.fontSize = '0.8rem';
        content.style.color = '#e5e7eb';
        content.style.wordBreak = 'break-all';
        content.style.lineHeight = '1.35';
        content.innerText = record.text;
        
        row.appendChild(header);
        row.appendChild(content);
        container.appendChild(row);
      });
    } else {
      card.style.display = 'none';
    }
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

    // 酒鬼/提线木偶 伪装角色下拉框初始化
    const drunkContainer = document.getElementById('edit-player-drunk-role-container');
    const drunkSelect = document.getElementById('edit-player-drunk-role-field');
    drunkSelect.innerHTML = '';
    
    let listForFake = [];
    if (p.role === 'drunk') {
      listForFake = this.getAvailableRolesList('townsfolk');
    } else if (p.role === 'marionette') {
      listForFake = [
        ...this.getAvailableRolesList('townsfolk'),
        ...this.getAvailableRolesList('outsider')
      ];
    }
    
    listForFake.forEach(tf => {
      const opt = document.createElement('option');
      opt.value = tf.key;
      opt.innerText = tf.name;
      drunkSelect.appendChild(opt);
    });

    const labelEl = document.querySelector('#edit-player-drunk-role-container label');
    if (labelEl) {
      labelEl.innerText = p.role === 'drunk' 
        ? "酒鬼伪装村民角色 (Drunk's Fake Role)" 
        : "提线木偶伪装好人角色 (Marionette's Fake Role)";
    }

    if (p.role === 'drunk') {
      drunkContainer.style.display = 'block';
      drunkSelect.value = p.drunkRole || (listForFake[0] ? listForFake[0].key : '');
    } else if (p.role === 'marionette') {
      drunkContainer.style.display = 'block';
      drunkSelect.value = p.marionetteRole || (listForFake[0] ? listForFake[0].key : '');
    } else {
      drunkContainer.style.display = 'none';
    }

    // 占卜师宿敌选择器初始化
    const ftContainer = document.getElementById('edit-player-ft-redherring-container');
    const ftSelect = document.getElementById('edit-player-ft-redherring-field');
    ftSelect.innerHTML = '';
    
    const ftPlaceholder = document.createElement('option');
    ftPlaceholder.value = "";
    ftPlaceholder.innerText = "-- 请点选一位玩家为宿敌 --";
    ftSelect.appendChild(ftPlaceholder);
    
    this.state.players.forEach(otherP => {
      if (otherP.index === playerIndex) return; // 排除自身
      const opt = document.createElement('option');
      opt.value = otherP.index;
      opt.innerText = `${otherP.index + 1}号: ${otherP.name} (${otherP.roleData.name})`;
      ftSelect.appendChild(opt);
    });

    const isFT = p.role === 'fortuneteller' || (p.role === 'drunk' && p.drunkRole === 'fortuneteller');
    if (isFT) {
      ftContainer.style.display = 'block';
      ftSelect.value = this.state.fortuneTellerRedHerring;
    } else {
      ftContainer.style.display = 'none';
    }

    this.onModalRoleChange();

    // 勾选状态
    document.getElementById('edit-state-dead').checked = p.dead;
    document.getElementById('edit-state-vote-token').checked = p.hasVoteToken;
    document.getElementById('edit-state-poisoned').checked = p.poisoned;
    document.getElementById('edit-state-drunk').checked = p.drunk;
    document.getElementById('edit-state-safe').checked = p.safe;

    const deathTypeSelect = document.getElementById('edit-death-type-field');
    if (deathTypeSelect) {
      deathTypeSelect.value = p.deathType || 'killed';
    }

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

    // 动态显隐酒鬼伪装下拉框
    const drunkContainer = document.getElementById('edit-player-drunk-role-container');
    if (roleKey === 'drunk') {
      drunkContainer.style.display = 'block';
      this.onModalDrunkRoleChange();
    } else {
      drunkContainer.style.display = 'none';
    }

    // 动态显隐占卜师宿敌下拉框
    const ftContainer = document.getElementById('edit-player-ft-redherring-container');
    const drunkSelect = document.getElementById('edit-player-drunk-role-field');
    const isFT = roleKey === 'fortuneteller' || (roleKey === 'drunk' && drunkSelect.value === 'fortuneteller');
    if (isFT) {
      ftContainer.style.display = 'block';
    } else {
      ftContainer.style.display = 'none';
    }
  }

  onModalDrunkRoleChange() {
    const select = document.getElementById('edit-player-drunk-role-field');
    const roleKey = select.value;
    const char = this.findRoleData(roleKey);
    const desc = document.getElementById('edit-player-drunk-role-ability');
    if (char) {
      desc.innerText = `【村民能力】: ${char.ability}`;
    }

    // 动态显隐占卜师宿敌下拉框
    const ftContainer = document.getElementById('edit-player-ft-redherring-container');
    if (roleKey === 'fortuneteller') {
      ftContainer.style.display = 'block';
    } else {
      ftContainer.style.display = 'none';
    }
  }

  onModalDeadChange() {
    const deadChecked = document.getElementById('edit-state-dead').checked;
    const container = document.getElementById('edit-vote-token-container');
    const deathTypeContainer = document.getElementById('edit-death-type-container');
    
    // 如果死了，展示死亡投票权勾选开关和死亡类型选择器
    container.style.display = deadChecked ? 'flex' : 'none';
    if (deathTypeContainer) {
      deathTypeContainer.style.display = deadChecked ? 'block' : 'none';
    }
  }

  closePlayerEditModal() {
    document.getElementById('player-edit-modal').classList.remove('active');
    this.currentEditingPlayerIndex = null;
  }

  savePlayerEditModal() {
    if (this.currentEditingPlayerIndex === null) return;
    
    const idx = this.currentEditingPlayerIndex;
    const p = this.state.players[idx];
    const wasAlive = !p.dead;

    const newName = document.getElementById('edit-player-name-field').value.trim();
    const newRole = document.getElementById('edit-player-role-field').value;
    const dead = document.getElementById('edit-state-dead').checked;
    const voteToken = document.getElementById('edit-state-vote-token').checked;
    const poisoned = document.getElementById('edit-state-poisoned').checked;
    const drunk = document.getElementById('edit-state-drunk').checked;
    const safe = document.getElementById('edit-state-safe').checked;
    const deathType = document.getElementById('edit-death-type-field').value;

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

    // 如果角色是酒鬼，更新/保存其伪装角色
    if (p.role === 'drunk') {
      const drunkSelect = document.getElementById('edit-player-drunk-role-field');
      const newDrunkRole = drunkSelect.value;
      if (p.drunkRole !== newDrunkRole) {
        const fakeChar = this.findRoleData(newDrunkRole);
        changes.push(`酒鬼伪装村民从 [${p.drunkRole ? (this.findRoleData(p.drunkRole) ? this.findRoleData(p.drunkRole).name : p.drunkRole) : '无'}] 变更为 [${fakeChar ? fakeChar.name : newDrunkRole}]`);
        p.drunkRole = newDrunkRole;
        // 自动设为醉酒
        p.drunk = true;
      }
    } else {
      delete p.drunkRole;
    }

    // 如果角色是提线木偶，更新/保存其伪装角色
    if (p.role === 'marionette') {
      const drunkSelect = document.getElementById('edit-player-drunk-role-field');
      const newMarionetteRole = drunkSelect.value;
      if (p.marionetteRole !== newMarionetteRole) {
        const fakeChar = this.findRoleData(newMarionetteRole);
        changes.push(`提线木偶伪装角色从 [${p.marionetteRole ? (this.findRoleData(p.marionetteRole) ? this.findRoleData(p.marionetteRole).name : p.marionetteRole) : '无'}] 变更为 [${fakeChar ? fakeChar.name : newMarionetteRole}]`);
        p.marionetteRole = newMarionetteRole;
      }
    } else {
      delete p.marionetteRole;
    }

    // 如果角色是占卜师（或者是酒鬼且伪装为占卜师），更新/保存其宿敌选择
    const isFT = p.role === 'fortuneteller' || (p.role === 'drunk' && p.drunkRole === 'fortuneteller');
    if (isFT) {
      const ftSelectVal = document.getElementById('edit-player-ft-redherring-field').value;
      if (this.state.fortuneTellerRedHerring !== ftSelectVal) {
        this.state.fortuneTellerRedHerring = ftSelectVal;
        const targetP = this.state.players[ftSelectVal];
        changes.push(`配置占卜师宿敌为 [${targetP ? targetP.name : '未选'}]`);
      }
    }

    let finalDead = dead;
    let finalDeathType = deathType;

    if (p.dead !== dead && dead) {
      // 试图让玩家死亡
      // 1. 检查茶水女免死保护
      const isTeaLadyProtected = this.isProtectedByTeaLady(p.index);
      if (isTeaLadyProtected) {
        if (!confirm(`【⚠️ 茶水女免死结界保护】\n\n玩家 [${p.name}] 正受到存活的、未醉酒中毒的【茶水女】结界保护（其左右存活邻居皆为善良阵营）！\n\n正常规则下他【无法死亡】。\n是否依然要出于说书人权能强行处死？`)) {
          finalDead = false;
          finalDeathType = null;
        }
      }

      // 2. 检查弄臣免死
      if (finalDead && p.role === 'fool') {
        const isDrunkOrPoisoned = p.drunk || p.poisoned;
        if (!isDrunkOrPoisoned) {
          if (!p.foolLifeUsed) {
            alert(`【🎭 弄臣首次死亡免死】\n\n玩家 [${p.name}] (弄臣) 首次面临死亡，且未处于醉酒或中毒状态！\n\n系统已自动触发其免死金牌：本次死亡被免除，扣除一次免死次数，继续保持存活！`);
            p.foolLifeUsed = true;
            finalDead = false;
            finalDeathType = null;
            this.addLog("说书人", `弄臣 [${p.name}] 触发首次死亡免死：消耗免死金牌，本局继续存活！`);
          } else {
            alert(`【⚠️ 弄臣警告】\n\n玩家 [${p.name}] (弄臣) 之前已经消耗过免死金牌，今日/今晚将正常死亡！`);
          }
        } else {
          alert(`【🚨 弄臣失效警告】\n\n玩家 [${p.name}] (弄臣) 当前处于【醉酒/中毒】状态，其免死技能失效，将被正常处死！`);
        }
      }
    }

    if (p.dead !== finalDead) {
      changes.push(finalDead ? `进入了棺木 (因[${finalDeathType === 'executed' ? '处决 🪓' : '被杀 💀'}]死亡)` : "从墓地中复活 (存活)");
      p.dead = finalDead;
      p.deathType = finalDead ? finalDeathType : null;
      p.deathDay = finalDead ? this.state.dayNumber : null;
      p.deathPhase = finalDead ? this.state.phase : null;
      if (finalDead) p.hasVoteToken = true; // 死亡默认给予未使用投票标记
    } else if (finalDead) {
      // 状态没变，但在死亡状态下修改了死亡类型
      if (p.deathType !== finalDeathType) {
        changes.push(`死亡类型变更为 [${finalDeathType === 'executed' ? '处决 🪓' : '被杀 💀'}]`);
        p.deathType = finalDeathType;
        p.deathDay = this.state.dayNumber;
        p.deathPhase = this.state.phase;
      }
    } else {
      p.deathType = null;
      p.deathDay = null;
      p.deathPhase = null;
    }

    // 死亡时的状态自动清洗规则
    if (p.dead) {
      p.poisoned = false;
      p.safe = false;
      if (p.role !== 'drunk') {
        p.drunk = false;
      }
      
      // 规则：下毒者一旦死亡，被其毒害的目标必须立刻解毒！
      if (p.role === 'poisoner') {
        this.state.players.forEach(otherP => {
          if (otherP.poisoned) {
            otherP.poisoned = false;
            changes.push(`因下毒者死亡，自动清除了 [${otherP.name}] 的中毒状态 🧪`);
          }
        });
      }

      // 规则：守鸦人在白天被处决死亡，其技能无法在夜间发动，直接标记能力已使用以防唤醒
      let actualRole = p.role;
      if (p.role === 'drunk' && p.drunkRole) {
        actualRole = p.drunkRole;
      }
      if (actualRole === 'ravenkeeper' && p.deathType === 'executed') {
        p.abilityUsed = true;
      }
    }

    if (dead && p.hasVoteToken !== voteToken) {
      changes.push(voteToken ? "拿回了死亡投票权" : "销毁了死亡投票权");
      p.hasVoteToken = voteToken;
    }
    if (p.poisoned !== poisoned) {
      changes.push(poisoned ? "遭受毒液侵蚀 🧪" : "清除了中毒状态");
      p.poisoned = poisoned;
    }
    if (p.role !== 'drunk' && p.drunk !== drunk) { // 真实酒鬼本身永远醉酒，不由该手动开关覆盖
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

    // 检查死亡的角色是否是心上人
    let actualRole = p.role;
    if (p.role === 'drunk' && p.drunkRole) {
      actualRole = p.drunkRole;
    }
    const isSweetheart = (actualRole === 'sweetheart');
    
    if (wasAlive && dead && isSweetheart && !p.abilityUsed) {
      this.triggerSweetheartDeathDrunk(p);
    }
  }

  triggerSweetheartDeathDrunk(sweetheartPlayer) {
    const isDrunkOrPoisoned = sweetheartPlayer.drunk || sweetheartPlayer.poisoned;
    if (isDrunkOrPoisoned) {
      alert(`💔 智能提示: 【心上人】在死亡时处于 醉酒/中毒 状态 🧪，其临终能力失效，无法触发醉酒。`);
      this.addLog("说书人", `心上人死亡效果：因心上人死亡时处于醉酒/中毒状态，其临终能力失效，无事发生。`);
      sweetheartPlayer.abilityUsed = true;
      this.saveToLocalStorage();
      return;
    }

    // 创建全屏遮罩
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(0, 0, 0, 0.85)';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    
    // 创建卡片
    const card = document.createElement('div');
    card.className = 'glass-card';
    card.style.width = '90vw';
    card.style.maxWidth = '400px';
    card.style.padding = '20px';
    card.style.borderRadius = '12px';
    card.style.border = '1px solid hsla(var(--gold), 0.3)';
    card.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.5)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '15px';
    
    // 标题
    const title = document.createElement('h3');
    title.innerText = '💔 心上人临终怨念 (能力触发)';
    title.style.margin = '0';
    title.style.color = 'hsl(var(--gold))';
    title.style.fontFamily = 'var(--font-title)';
    title.style.fontSize = '1.2rem';
    
    // 描述
    const desc = document.createElement('p');
    desc.innerText = `心上人 [${sweetheartPlayer.name}] 已经死亡！请说书人实时选择一名存活玩家使其永久处于【醉酒】状态：`;
    desc.style.margin = '0';
    desc.style.fontSize = '0.85rem';
    desc.style.color = 'hsl(var(--text-muted))';
    
    // 下拉框
    const select = document.createElement('select');
    select.className = 'form-control';
    select.style.width = '100%';
    select.style.padding = '8px';
    select.style.background = 'rgba(0, 0, 0, 0.5)';
    select.style.color = '#fff';
    select.style.border = '1px solid rgba(255,255,255,0.1)';
    select.style.borderRadius = '6px';
    
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.innerText = '-- 请选择存活玩家 --';
    select.appendChild(placeholder);
    
    this.state.players.forEach(p => {
      if (!p.dead) {
        const opt = document.createElement('option');
        opt.value = p.index;
        opt.innerText = `${p.index + 1}号: ${p.name} [${p.roleData?.name || p.role}]`;
        select.appendChild(opt);
      }
    });
    
    // 确认按钮
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.innerText = '💾 确认并对该玩家施加永久醉酒';
    btn.style.width = '100%';
    btn.disabled = true;
    
    select.onchange = () => {
      btn.disabled = !select.value;
    };
    
    btn.onclick = () => {
      const val = select.value;
      const target = this.state.players[val];
      if (target) {
        target.drunk = true;
        this.addLog("说书人", `心上人死亡效果生效：[${target.name}] 被选定永久处于醉酒状态 🍺`);
        sweetheartPlayer.abilityUsed = true;
        this.renderGrimoireCircle();
        this.saveToLocalStorage();
      }
      overlay.remove();
    };
    
    // 跳过/取消按钮
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.innerText = '❌ 技能失效 / 跳过不触发';
    cancelBtn.style.width = '100%';
    cancelBtn.style.marginTop = '-5px';
    
    cancelBtn.onclick = () => {
      sweetheartPlayer.abilityUsed = true;
      this.addLog("说书人", `心上人死亡效果：说书人选择跳过或不触发临终醉酒效果。`);
      this.saveToLocalStorage();
      overlay.remove();
    };
    
    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(select);
    card.appendChild(btn);
    card.appendChild(cancelBtn);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
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
    
    // 如果进入夜晚，重置只能维持一天一夜的夜间临时状态 (如 Monk 的 Safe, Poisoner 的 Poisoned, 以及常规醉酒 Drunk) ，但酒鬼 (Drunk 角色) 醉酒状态贯穿全场不重置！
    if (this.state.phase === 'night') {
      this.state.players.forEach(p => {
        p.safe = false; 
        p.poisoned = false;
        if (p.role !== 'drunk') {
          p.drunk = false;
        }
      });
      // 绝不重置历夜行动备忘以供说书人复盘
      this.addLog("系统", "已自动重置临时守护 🛡️、中毒 🧪 与常规醉酒 🍺 状态（酒鬼除外），历夜信息备忘与全局日志已全部保留以供复盘。");
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
      isDead: p.dead,
      playerObject: p // 保存玩家对象实例以访问伪装属性
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
      let roleKeyForWaking = p.roleKey;
      let roleDataForWaking = p.role;
      let isDrunkWaking = false;

      if (p.roleKey === 'drunk' && p.playerObject.drunkRole) {
        roleKeyForWaking = p.playerObject.drunkRole;
        roleDataForWaking = this.findRoleData(roleKeyForWaking) || p.role;
        isDrunkWaking = true;
      } else if (p.roleKey === 'marionette' && p.playerObject.marionetteRole) {
        roleKeyForWaking = p.playerObject.marionetteRole;
        roleDataForWaking = this.findRoleData(roleKeyForWaking) || p.role;
        isDrunkWaking = true;
      }

      const weight = orderMap[roleKeyForWaking];
      // 如果该角色有分配相对重量，且符合苏醒生存规则
      if (weight !== undefined) {
        
        let shouldWake = false;

        if (isFirst) {
          // 首夜苏醒检查
          if (roleDataForWaking.firstNight !== undefined) {
            // 打手 (Goon) 首晚不睁眼 (黯月升起标准配置)
            if (roleKeyForWaking === 'goon') {
              shouldWake = false; 
            } else {
              shouldWake = !p.isDead; // 首夜死了的角色通常不需要动
            }
          }
        } else {
          // 其他夜晚苏醒检查
          if (roleDataForWaking.otherNight !== undefined) {
            // 存活状态下或者死后触发条件
            if (!p.isDead) {
              shouldWake = true;
            } else {
              // 特殊：死人可能依然需要睁眼结算一次的角色
              if (['barber', 'sweetheart', 'ravenkeeper', 'sage', 'farmer'].includes(roleKeyForWaking)) {
                // 只有在该死后释放技能尚未被触发结算过的情况下，才在死后苏醒一次！
                if (!p.playerObject.abilityUsed) {
                  shouldWake = true;
                } else {
                  shouldWake = false;
                }
              }
            }
          }
        }

        if (shouldWake) {
          sortedWakeList.push({
            type: 'role',
            roleKey: p.roleKey, // 酒鬼的真实 roleKey 依然是 'drunk'
            roleKeyForWaking: roleKeyForWaking,
            playerIndex: p.playerIndex,
            playerName: p.playerName,
            name: isDrunkWaking ? `${p.role.name} (伪装: ${roleDataForWaking.name})` : p.role.name,
            ability: roleDataForWaking.ability,
            gesture: isDrunkWaking 
              ? `【🚨 特别提示：此玩家是酒鬼！其技能完全失效！请按该伪装村民正常提供虚假/错误信息】\n\n` + (isFirst ? (roleDataForWaking.wakeFirst || '唤醒此角色，展示其标志，让其决定并互动。') : (roleDataForWaking.wakeOther || '唤醒此角色，向其出示指引并结算。'))
              : (isFirst ? (roleDataForWaking.wakeFirst || '唤醒此角色，展示其标志，让其决定并互动。') : (roleDataForWaking.wakeOther || '唤醒此角色，向其出示指引并结算。')),
            weight: weight,
            role: roleDataForWaking
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

  backupPlayersState() {
    this.nightStepPlayersBackup = this.state.players.map(p => ({
      ...p,
      roleData: p.roleData ? { ...p.roleData } : null
    }));
    this.fangguJumpedBackup = this.state.fangguJumped;
  }

  restorePlayersFromBackup() {
    if (!this.nightStepPlayersBackup) return;
    this.state.players.forEach((p, idx) => {
      const backup = this.nightStepPlayersBackup[idx];
      if (backup) {
        p.dead = backup.dead;
        p.deathType = backup.deathType;
        p.hasVoteToken = backup.hasVoteToken;
        p.poisoned = backup.poisoned;
        p.safe = backup.safe;
        p.drunk = backup.drunk;
        p.role = backup.role;
        p.roleData = backup.roleData ? { ...backup.roleData } : null;
        if (backup.drunkRole !== undefined) {
          p.drunkRole = backup.drunkRole;
        } else {
          delete p.drunkRole;
        }
        if (backup.marionetteRole !== undefined) {
          p.marionetteRole = backup.marionetteRole;
        } else {
          delete p.marionetteRole;
        }
      }
    });
    this.state.fangguJumped = this.fangguJumpedBackup;
  }

  renderNightStep() {
    const guide = this.state.nightGuide;
    const step = guide.steps[guide.currentIndex];
    if (!step) return;

    this.backupPlayersState();

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

  isEvilPlayer(player) {
    if (!player || !player.roleData) return false;
    return ['minion', 'demon'].includes(player.roleData.type);
  }

  didAnyOutsiderDieToday() {
    return this.state.players.some(p => {
      if (!p.dead) return false;
      // 检查死亡天数是否是今天
      if (p.deathDay !== this.state.dayNumber) return false;
      
      // 检查死亡阶段是否是白天，或者死亡类型是处决
      const diedInDaytime = (p.deathPhase === 'day' || p.deathType === 'executed');
      if (!diedInDaytime) return false;

      // 检查角色是否是外来者
      const charData = this.findRoleData(p.role);
      return charData && charData.type === 'outsider';
    });
  }

  isProtectedByTeaLady(playerIndex) {
    // 找出场上所有存活、未醉酒、未中毒的茶水女 (tealady)
    const teaLadies = this.state.players.filter(p => p.role === 'tealady' && !p.dead && !p.poisoned && !p.drunk);
    if (teaLadies.length === 0) return false;

    // 对每一个这样的茶水女，检查其左右存活邻居
    return teaLadies.some(tl => {
      const neighbors = this.getLivingNeighbors(tl.index);
      if (!neighbors.left || !neighbors.right) return false;
      
      // 左右邻居必须都是善良阵营
      const leftGood = neighbors.left.roleData && (neighbors.left.roleData.type === 'townsfolk' || neighbors.left.roleData.type === 'outsider');
      const rightGood = neighbors.right.roleData && (neighbors.right.roleData.type === 'townsfolk' || neighbors.right.roleData.type === 'outsider');
      
      if (leftGood && rightGood) {
        // 如果被检查的玩家 playerIndex 是其中一个邻居，则受茶水女保护！
        return neighbors.left.index === playerIndex || neighbors.right.index === playerIndex;
      }
      return false;
    });
  }

  getLivingNeighbors(index) {
    const N = this.state.playerCount;
    let left = null;
    let right = null;
    
    // Look counter-clockwise (left)
    for (let i = 1; i < N; i++) {
      const idx = (index - i + N) % N;
      if (!this.state.players[idx].dead) {
        left = this.state.players[idx];
        break;
      }
    }
    // Look clockwise (right)
    for (let i = 1; i < N; i++) {
      const idx = (index + i) % N;
      if (!this.state.players[idx].dead) {
        right = this.state.players[idx];
        break;
      }
    }
    return { left, right };
  }

  getAdjacentEvilPairs() {
    const N = this.state.playerCount;
    let count = 0;
    for (let i = 0; i < N; i++) {
      const p1 = this.state.players[i];
      const p2 = this.state.players[(i + 1) % N];
      if (this.isEvilPlayer(p1) && this.isEvilPlayer(p2)) {
        count++;
      }
    }
    return count;
  }

  generateNightActionInputs(step, container) {
    const player = this.state.players[step.playerIndex];
    const wakingKey = step.roleKeyForWaking || step.roleKey;

    // Create wrapper div for layout styling
    const formWrapper = document.createElement('div');
    formWrapper.style.display = 'flex';
    formWrapper.style.flexDirection = 'column';
    formWrapper.style.gap = '10px';
    formWrapper.style.marginTop = '10px';
    container.appendChild(formWrapper);

    // Interactive inputs container
    const interactiveArea = document.createElement('div');
    interactiveArea.style.display = 'flex';
    interactiveArea.style.flexDirection = 'column';
    interactiveArea.style.gap = '8px';
    formWrapper.appendChild(interactiveArea);

    // Text Draft container
    const draftContainer = document.createElement('div');
    draftContainer.style.background = 'rgba(0,0,0,0.4)';
    draftContainer.style.padding = '10px';
    draftContainer.style.borderRadius = '8px';
    draftContainer.style.border = '1px solid rgba(255,255,255,0.06)';
    draftContainer.style.display = 'flex';
    draftContainer.style.flexDirection = 'column';
    draftContainer.style.gap = '6px';
    formWrapper.appendChild(draftContainer);

    const draftLabel = document.createElement('label');
    draftLabel.innerText = "💾 备忘录条目草稿 (可编辑):";
    draftLabel.style.fontSize = '0.75rem';
    draftLabel.style.color = 'hsl(var(--gold))';
    draftLabel.style.fontWeight = 'bold';
    draftContainer.appendChild(draftLabel);

    const draftInput = document.createElement('textarea');
    draftInput.className = 'form-control';
    draftInput.rows = 2;
    draftInput.style.fontSize = '0.8rem';
    draftInput.style.background = 'rgba(0,0,0,0.3)';
    draftInput.style.color = '#fff';
    draftInput.style.border = '1px solid rgba(255,255,255,0.1)';
    draftInput.placeholder = "通过上方交互选择后自动生成, 或直接在此手动备注...";
    draftContainer.appendChild(draftInput);

    // Dynamic warning area (for poisoned, drunk, or Vortox)
    const warningArea = document.createElement('div');
    warningArea.style.fontSize = '0.75rem';
    warningArea.style.lineHeight = '1.3';
    draftContainer.appendChild(warningArea);

    // Vortox detection
    const isVortoxInPlay = this.state.players.some(p => p.role === 'vortox' && !p.dead && !p.poisoned && !p.drunk);
    const isGoodCamp = (step.role && (step.role.type === 'townsfolk' || step.role.type === 'outsider'));
    
    // Check if the current waking player's info must be completely false
    const mustBeFalse = (player && (player.poisoned || player.drunk)) || (isVortoxInPlay && isGoodCamp);

    let warningText = "";
    if (player && (player.poisoned || player.drunk)) {
      const reason = player.poisoned ? "中毒 🧪" : "醉酒 🍺";
      warningText += `⚠️ <strong>状态警告</strong>: 该玩家当前处于 [${reason}] 状态！其技能已失效，你<strong>必须</strong>向其提供<strong>【虚假/错误】</strong>的信息！（助手已为您自动预设错误选项）<br>`;
    }
    if (player && player.role === 'marionette') {
      const fakeRoleName = this.findRoleData(player.marionetteRole)?.name || player.marionetteRole;
      warningText += `⚠️ <strong>🚨 提线木偶虚假唤醒 🚨</strong>: 该玩家的真实角色为【提线木偶】！他自身坚信自己是【${fakeRoleName}】！你<strong>必须</strong>向其提供<strong>【虚假/错误】</strong>的信息，切勿向其泄露其真实身份！<br>`;
    }
    if (isVortoxInPlay && isGoodCamp) {
      warningText += `⚠️ <strong>混乱风暴规律干扰</strong>: 场上有存活的恶魔【混乱风暴】运作中，所有善良阵营玩家的感知信息<strong>【必须为假】</strong>！（助手已为您自动预设错误选项）<br>`;
    }

    if (warningText) {
      warningArea.style.display = 'block';
      warningArea.style.color = '#ff6b6b';
      warningArea.style.background = 'rgba(231, 76, 60, 0.1)';
      warningArea.style.padding = '8px';
      warningArea.style.borderRadius = '6px';
      warningArea.style.border = '1px solid rgba(231, 76, 60, 0.2)';
      warningArea.innerHTML = warningText;
    } else {
      warningArea.style.display = 'none';
    }

    // Save Button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-gold';
    saveBtn.style.fontSize = '0.8rem';
    saveBtn.style.padding = '8px';
    saveBtn.style.marginTop = '4px';
    saveBtn.innerText = "💾 确认保存此行动备忘";
    draftContainer.appendChild(saveBtn);

    // Save button event handler
    saveBtn.onclick = () => {
      const text = draftInput.value.trim();
      if (!text) {
        alert("请输入备注信息再保存！");
        return;
      }
      this.saveNightRecord(step.playerIndex, step.name, step.playerName, text);
      alert(`已成功保存 [${step.name}] 的行动记录并归档日志！`);
    };

    // Helper functions for updating draftInput
    const setDraft = (str) => {
      draftInput.value = str;
    };

    // Helper row for real-time calculations
    const helperRow = document.createElement('div');
    helperRow.style.fontSize = '0.75rem';
    helperRow.style.fontWeight = 'bold';
    helperRow.style.padding = '6px';
    helperRow.style.borderRadius = '4px';
    helperRow.style.display = 'none';
    helperRow.style.marginTop = '4px';

    // --- Dynamic Specialized Input Generators ---
    
    // washerwoman, librarian, investigator
    if (['washerwoman', 'librarian', 'investigator'].includes(wakingKey)) {
      const labelText = wakingKey === 'washerwoman' ? '选择村民角色:' : wakingKey === 'librarian' ? '选择外来者角色:' : '选择爪牙角色:';
      const roleType = wakingKey === 'washerwoman' ? 'townsfolk' : wakingKey === 'librarian' ? 'outsider' : 'minion';

      const selReal = this.createSTPlayerSelectorElement("选择真实目标玩家 (说书人决定):");
      const selDecoy = this.createSTPlayerSelectorElement("选择干扰/假目标玩家 (说书人决定):");
      const selRole = this.createRoleSelectorElement(labelText, roleType);

      interactiveArea.appendChild(selReal.row);
      interactiveArea.appendChild(selDecoy.row);
      interactiveArea.appendChild(selRole.row);

      const updateClueText = () => {
        const pReal = this.state.players[selReal.select.value];
        const pDecoy = this.state.players[selDecoy.select.value];
        const roleData = this.findRoleData(selRole.select.value);

        if (pReal && pDecoy && roleData) {
          const typeCN = wakingKey === 'washerwoman' ? '村民' : wakingKey === 'librarian' ? '外来者' : '爪牙';
          setDraft(`得知 [${pReal.name}] 与 [${pDecoy.name}] 之一是${typeCN}【${roleData.name}】`);
        }
      };

      selReal.select.onchange = () => {
        const p = this.state.players[selReal.select.value];
        if (p) {
          let roleKey = p.role;
          if (p.role === 'drunk' && p.drunkRole) {
            roleKey = p.drunkRole;
          }
          const rData = this.findRoleData(roleKey);
          if (rData && rData.type === roleType) {
            selRole.select.value = roleKey;
          }
        }
        updateClueText();
      };
      
      selDecoy.select.onchange = updateClueText;
      selRole.select.onchange = updateClueText;

      // Special for Librarian: "No Outsiders" option
      if (wakingKey === 'librarian') {
        const noOutsiderRow = document.createElement('div');
        noOutsiderRow.style.display = 'flex';
        noOutsiderRow.style.alignItems = 'center';
        noOutsiderRow.style.gap = '8px';
        noOutsiderRow.style.fontSize = '0.8rem';
        noOutsiderRow.style.marginBottom = '4px';
        
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.id = 'librarian-no-outsider-chk';
        
        const lbl = document.createElement('label');
        lbl.htmlFor = 'librarian-no-outsider-chk';
        lbl.innerText = "场上无外来者在场 (信息为 0)";
        lbl.style.margin = '0';
        
        noOutsiderRow.appendChild(chk);
        noOutsiderRow.appendChild(lbl);
        interactiveArea.insertBefore(noOutsiderRow, selReal.row);

        chk.onchange = (e) => {
          if (e.target.checked) {
            selReal.select.disabled = true;
            selDecoy.select.disabled = true;
            selRole.select.disabled = true;
            setDraft(`得知本局场上无任何外来者在场`);
          } else {
            selReal.select.disabled = false;
            selDecoy.select.disabled = false;
            selRole.select.disabled = false;
            updateClueText();
          }
        };
      }
    }

    // chef
    else if (wakingKey === 'chef') {
      const countSel = this.createDropdownElement("邪恶相邻对数:", [0, 1, 2, 3, 4]);
      interactiveArea.appendChild(countSel.row);
      interactiveArea.appendChild(helperRow);

      const correctResult = this.getAdjacentEvilPairs();
      let suggestedCount = correctResult;
      
      if (mustBeFalse) {
        suggestedCount = correctResult === 0 ? 1 : 0;
        
        helperRow.style.display = 'block';
        helperRow.innerText = `🔍 助手提示 (已处理中毒/醉酒/混乱风暴): 实际对数为 ${correctResult} 对。但因处于失效/干扰状态，你必须提供错误信息。已为您自动选择错误值：${suggestedCount} 🔴`;
        helperRow.style.color = '#e74c3c';
        helperRow.style.background = 'rgba(231, 76, 60, 0.1)';
        helperRow.style.border = '1px solid rgba(231, 76, 60, 0.2)';
      } else {
        helperRow.style.display = 'block';
        helperRow.innerText = `🔍 助手提示: 邪恶阵营相邻对数实际为: ${correctResult} 对 🟢`;
        helperRow.style.color = '#2ecc71';
        helperRow.style.background = 'rgba(46, 204, 113, 0.1)';
        helperRow.style.border = '1px solid rgba(46, 204, 113, 0.2)';
      }

      countSel.select.value = suggestedCount;
      setDraft(`得知有 ${suggestedCount} 对相邻的邪恶玩家`);

      countSel.select.onchange = (e) => {
        const count = e.target.value;
        if (count !== "") {
          setDraft(`得知有 ${count} 对相邻的邪恶玩家`);
        }
      };
    }

    // empath
    else if (wakingKey === 'empath') {
      const countSel = this.createDropdownElement("相邻存活邪恶玩家数:", [0, 1, 2]);
      interactiveArea.appendChild(countSel.row);
      interactiveArea.appendChild(helperRow);

      const neighbors = this.getLivingNeighbors(step.playerIndex);
      let correctResult = 0;
      if (neighbors.left && this.isEvilPlayer(neighbors.left)) correctResult++;
      if (neighbors.right && this.isEvilPlayer(neighbors.right)) correctResult++;

      let suggestedCount = correctResult;
      if (mustBeFalse) {
        suggestedCount = correctResult === 0 ? 1 : 0;
        
        helperRow.style.display = 'block';
        helperRow.innerText = `🔍 助手提示 (已处理中毒/醉酒/混乱风暴): 实际存活邪恶邻座数为 ${correctResult}。但因处于失效/干扰状态，你必须提供错误信息。已为您自动选择错误值：${suggestedCount} 🔴`;
        helperRow.style.color = '#e74c3c';
        helperRow.style.background = 'rgba(231, 76, 60, 0.1)';
        helperRow.style.border = '1px solid rgba(231, 76, 60, 0.2)';
      } else {
        helperRow.style.display = 'block';
        let neighborsStr = "";
        if (neighbors.left) neighborsStr += `${neighbors.left.index + 1}号(${neighbors.left.name}:${neighbors.left.roleData.name})`;
        if (neighbors.right) neighborsStr += ` 和 ${neighbors.right.index + 1}号(${neighbors.right.name}:${neighbors.right.roleData.name})`;
        helperRow.innerText = `🔍 助手提示: 邻座玩家 ${neighborsStr}，其中邪恶人数为: ${correctResult} 🟢`;
        helperRow.style.color = '#2ecc71';
        helperRow.style.background = 'rgba(46, 204, 113, 0.1)';
        helperRow.style.border = '1px solid rgba(46, 204, 113, 0.2)';
      }

      countSel.select.value = suggestedCount;
      setDraft(`得知相邻的两名存活玩家中有 ${suggestedCount} 名是邪恶阵营`);

      countSel.select.onchange = (e) => {
        const count = e.target.value;
        if (count !== "") {
          setDraft(`得知相邻的两名存活玩家中有 ${count} 名是邪恶阵营`);
        }
      };
    }

    // fortuneteller
    else if (wakingKey === 'fortuneteller') {
      // Setup Red Herring selection
      const redHerringSel = this.createSelectorElement("配置本局【宿敌】(贯穿整局且魔典上标宿):", false);
      if (this.state.fortuneTellerRedHerring !== "") {
        redHerringSel.select.value = this.state.fortuneTellerRedHerring;
      }

      const selA = this.createSelectorElement("占卜目标一:", false);
      const selB = this.createSelectorElement("占卜目标二:", false);

      const resultSel = this.createDropdownElement("占卜结果:", ["摇头 (否) 🔴", "点头 (是) 🟢"]);

      interactiveArea.appendChild(redHerringSel.row);
      interactiveArea.appendChild(selA.row);
      interactiveArea.appendChild(selB.row);
      interactiveArea.appendChild(resultSel.row);
      interactiveArea.appendChild(helperRow);

      const updateFTText = () => {
        // Save Red Herring persistently
        if (redHerringSel.select.value !== "") {
          const oldRH = this.state.fortuneTellerRedHerring;
          if (oldRH !== redHerringSel.select.value) {
            this.state.fortuneTellerRedHerring = redHerringSel.select.value;
            this.addLog("说书人", `将占卜师宿敌指定为 ${parseInt(redHerringSel.select.value) + 1}号 [${this.state.players[redHerringSel.select.value].name}]`);
            this.renderGrimoireCircle();
            this.saveToLocalStorage();
          }
        }

        const pA = this.state.players[selA.select.value];
        const pB = this.state.players[selB.select.value];

        if (pA && pB) {
          const isADemon = pA.roleData && pA.roleData.type === 'demon';
          const isBDemon = pB.roleData && pB.roleData.type === 'demon';
          const isARedHerring = parseInt(selA.select.value) === parseInt(this.state.fortuneTellerRedHerring);
          const isBRedHerring = parseInt(selB.select.value) === parseInt(this.state.fortuneTellerRedHerring);

          const correctYes = isADemon || isBDemon || isARedHerring || isBRedHerring;
          let suggestedResult = correctYes ? "点头 (是) 🟢" : "摇头 (否) 🔴";
          
          if (mustBeFalse) {
            suggestedResult = correctYes ? "摇头 (否) 🔴" : "点头 (是) 🟢";
            
            helperRow.style.display = 'block';
            helperRow.innerText = `🔍 助手提示 (已处理中毒/醉酒/混乱风暴): 正常应 ${correctYes ? '点头 (是)' : '摇头 (否)'}。因处于失效状态，必须给假信息！已自动预设错误值：${suggestedResult} 🔴`;
            helperRow.style.color = '#e74c3c';
            helperRow.style.background = 'rgba(231, 76, 60, 0.1)';
            helperRow.style.border = '1px solid rgba(231, 76, 60, 0.2)';
          } else {
            helperRow.style.display = 'block';
            let detail = [];
            if (isADemon) detail.push(`${pA.name}为恶魔`);
            if (isBDemon) detail.push(`${pB.name}为恶魔`);
            if (isARedHerring) detail.push(`${pA.name}为宿敌`);
            if (isBRedHerring) detail.push(`${pB.name}为宿敌`);
            
            helperRow.innerText = `🔍 助手提示: 包含魔鬼或宿敌 (${detail.length > 0 ? detail.join(', ') : '无'})，应当 ${correctYes ? '点头 (是) 🟢' : '摇头 (否) 🔴'}`;
            helperRow.style.color = '#2ecc71';
            helperRow.style.background = 'rgba(46, 204, 113, 0.1)';
            helperRow.style.border = '1px solid rgba(46, 204, 113, 0.2)';
          }

          resultSel.select.value = suggestedResult;
          setDraft(`占卜 [${pA.name}] 与 [${pB.name}]。感知结果: ${suggestedResult}`);
        }
      };

      redHerringSel.select.onchange = updateFTText;
      selA.select.onchange = updateFTText;
      selB.select.onchange = updateFTText;
      resultSel.select.onchange = () => {
        const pA = this.state.players[selA.select.value];
        const pB = this.state.players[selB.select.value];
        if (pA && pB) {
          setDraft(`占卜 [${pA.name}] 与 [${pB.name}]。感知结果: ${resultSel.select.value}`);
        }
      };
    }

    // chambermaid
    else if (wakingKey === 'chambermaid') {
      const selA = this.createSelectorElement("选择侍女感知玩家 A:", true); // living only
      const selB = this.createSelectorElement("选择侍女感知玩家 B:", true); // living only
      const countSel = this.createDropdownElement("苏醒过的人数:", [0, 1, 2]);

      interactiveArea.appendChild(selA.row);
      interactiveArea.appendChild(selB.row);
      interactiveArea.appendChild(countSel.row);
      interactiveArea.appendChild(helperRow);

      const updateChambermaidText = () => {
        const pA = this.state.players[selA.select.value];
        const pB = this.state.players[selB.select.value];

        if (pA && pB) {
          const idxA = parseInt(selA.select.value);
          const idxB = parseInt(selB.select.value);

          const wokeA = this.state.nightGuide.steps.some(s => s.playerIndex === idxA && s.type === 'role');
          const wokeB = this.state.nightGuide.steps.some(s => s.playerIndex === idxB && s.type === 'role');

          let correctResult = 0;
          if (wokeA) correctResult++;
          if (wokeB) correctResult++;

          let suggestedCount = correctResult;
          if (mustBeFalse) {
            suggestedCount = correctResult === 0 ? 1 : 0;
            
            helperRow.style.display = 'block';
            helperRow.innerText = `🔍 助手提示 (已处理中毒/醉酒/混乱风暴): 实际苏醒数为 ${correctResult}。因处于失效状态，必须给假信息！已自动预设错误值：${suggestedCount} 🔴`;
            helperRow.style.color = '#e74c3c';
            helperRow.style.background = 'rgba(231, 76, 60, 0.1)';
            helperRow.style.border = '1px solid rgba(231, 76, 60, 0.2)';
          } else {
            helperRow.style.display = 'block';
            helperRow.innerText = `🔍 助手判定: 玩家 [${pA.name}] 今晚${wokeA ? '醒过' : '未醒'}，[${pB.name}] 今晚${wokeB ? '醒过' : '未醒'}。苏醒总数: ${correctResult} 🟢`;
            helperRow.style.color = '#3498db';
            helperRow.style.background = 'rgba(52, 152, 219, 0.1)';
            helperRow.style.border = '1px solid rgba(52, 152, 219, 0.2)';
          }

          countSel.select.value = suggestedCount;
          setDraft(`感知 [${pA.name}] 与 [${pB.name}]。得知今晚他们醒来行动过的人数为: ${suggestedCount}`);
        }
      };

      selA.select.onchange = updateChambermaidText;
      selB.select.onchange = updateChambermaidText;
      countSel.select.onchange = () => {
        const pA = this.state.players[selA.select.value];
        const pB = this.state.players[selB.select.value];
        if (pA && pB) {
          setDraft(`感知 [${pA.name}] 与 [${pB.name}]。得知今晚他们醒来行动过的人数为: ${countSel.select.value}`);
        }
      };
    }

    // undertaker
    else if (wakingKey === 'undertaker') {
      const deadExecuted = this.state.players.filter(p => p.dead && p.deathType === 'executed');
      const deadExecutedSel = this.createCustomSelectorElement("今日被处决的死者:", deadExecuted);
      const roleSel = this.createRoleSelectorElement("展示的角色 (说书人决定):", "all");

      interactiveArea.appendChild(deadExecutedSel.row);
      interactiveArea.appendChild(roleSel.row);
      interactiveArea.appendChild(helperRow);

      const updateUndertakerText = () => {
        const target = this.state.players[deadExecutedSel.select.value];
        if (target) {
          let actualRoleKey = target.role;
          if (target.role === 'drunk' && target.drunkRole) {
            actualRoleKey = target.drunkRole;
          }
          
          let suggestedRoleKey = actualRoleKey;
          if (mustBeFalse) {
            const falseRoles = this.state.pool.filter(rk => rk !== actualRoleKey);
            suggestedRoleKey = falseRoles[0] || (actualRoleKey === 'imp' ? 'washerwoman' : 'imp');
            
            helperRow.style.display = 'block';
            helperRow.innerText = `🔍 助手提示 (已处理中毒/醉酒/混乱风暴): 实际今日处决角色为【${this.findRoleData(actualRoleKey).name}】。但处于失效状态，必须给假信息！已自动预设错误角色：【${this.findRoleData(suggestedRoleKey).name}】 🔴`;
            helperRow.style.color = '#e74c3c';
            helperRow.style.background = 'rgba(231, 76, 60, 0.1)';
            helperRow.style.border = '1px solid rgba(231, 76, 60, 0.2)';
          } else {
            helperRow.style.display = 'block';
            helperRow.innerText = `🔍 助手提示: 今日被处决者实际角色为: 【${this.findRoleData(actualRoleKey).name}】 🟢`;
            helperRow.style.color = '#2ecc71';
            helperRow.style.background = 'rgba(46, 204, 113, 0.1)';
            helperRow.style.border = '1px solid rgba(46, 204, 113, 0.2)';
          }
          
          roleSel.select.value = suggestedRoleKey;
          const roleData = this.findRoleData(suggestedRoleKey);
          if (roleData) {
            setDraft(`得知今日被处决玩家 [${target.name}] 的角色为: 【${roleData.name}】`);
          }
        }
      };

      deadExecutedSel.select.onchange = updateUndertakerText;
      roleSel.select.onchange = () => {
        const target = this.state.players[deadExecutedSel.select.value];
        const roleData = this.findRoleData(roleSel.select.value);
        if (target && roleData) {
          setDraft(`得知今日被处决玩家 [${target.name}] 的角色为: 【${roleData.name}】`);
        }
      };

      // Pre-select if there's exactly one executed player today
      if (deadExecuted.length > 0) {
        deadExecutedSel.select.value = deadExecuted[0].index;
        updateUndertakerText();
      }
    }

    // butler
    else if (wakingKey === 'butler') {
      const masterSel = this.createSelectorElement("选择投票主人:", false); // excludes butler themselves
      interactiveArea.appendChild(masterSel.row);

      masterSel.select.onchange = (e) => {
        const val = e.target.value;
        const target = this.state.players[val];
        if (target) {
          setDraft(`选择其他玩家 [${target.name}] 作为明天的投票主人`);
        }
      };
    }

    // dreamer
    else if (wakingKey === 'dreamer') {
      const targetSel = this.createSelectorElement("筑梦目标玩家:", true); // living only
      const goodRoleSel = this.createRoleSelectorElement("展示善良角色:", "good");
      const evilRoleSel = this.createRoleSelectorElement("展示邪恶角色:", "evil");

      interactiveArea.appendChild(targetSel.row);
      interactiveArea.appendChild(goodRoleSel.row);
      interactiveArea.appendChild(evilRoleSel.row);
      interactiveArea.appendChild(helperRow);

      const updateDreamerText = () => {
        const target = this.state.players[targetSel.select.value];
        if (target) {
          let targetRoleKey = target.role;
          if (target.role === 'drunk' && target.drunkRole) {
            targetRoleKey = target.drunkRole;
          }
          
          let suggestedGoodKey = "";
          let suggestedEvilKey = "";
          const isTargetEvil = this.isEvilPlayer(target);
          
          if (mustBeFalse) {
            // Both must be completely false
            const falseGoods = this.state.pool.filter(rk => rk !== targetRoleKey && (this.findRoleData(rk).type === 'townsfolk' || this.findRoleData(rk).type === 'outsider'));
            suggestedGoodKey = falseGoods[0] || 'washerwoman';
            
            const falseEvils = this.state.pool.filter(rk => rk !== targetRoleKey && (this.findRoleData(rk).type === 'minion' || this.findRoleData(rk).type === 'demon'));
            suggestedEvilKey = falseEvils[0] || 'imp';
            
            helperRow.style.display = 'block';
            helperRow.innerText = `🔍 助手提示 (已处理中毒/醉酒/混乱风暴): 处于失效状态，展示的善良和邪恶角色都必须为假！已自动预设错误角色 🔴`;
            helperRow.style.color = '#e74c3c';
            helperRow.style.background = 'rgba(231, 76, 60, 0.1)';
            helperRow.style.border = '1px solid rgba(231, 76, 60, 0.2)';
          } else {
            if (isTargetEvil) {
              const goods = this.state.pool.filter(rk => (this.findRoleData(rk).type === 'townsfolk' || this.findRoleData(rk).type === 'outsider'));
              suggestedGoodKey = goods[0] || 'washerwoman';
              suggestedEvilKey = targetRoleKey;
            } else {
              suggestedGoodKey = targetRoleKey;
              const evils = this.state.pool.filter(rk => (this.findRoleData(rk).type === 'minion' || this.findRoleData(rk).type === 'demon'));
              suggestedEvilKey = evils[0] || 'imp';
            }
            
            helperRow.style.display = 'block';
            helperRow.innerText = `🔍 助手提示: 目标实际为【${isTargetEvil ? '邪恶' : '善良'}】阵营。建议展示其真实角色【${this.findRoleData(targetRoleKey).name}】及对立阵营虚构角色 🟢`;
            helperRow.style.color = '#2ecc71';
            helperRow.style.background = 'rgba(46, 204, 113, 0.1)';
            helperRow.style.border = '1px solid rgba(46, 204, 113, 0.2)';
          }
          
          goodRoleSel.select.value = suggestedGoodKey;
          evilRoleSel.select.value = suggestedEvilKey;
          
          const gRole = this.findRoleData(suggestedGoodKey);
          const eRole = this.findRoleData(suggestedEvilKey);
          if (gRole && eRole) {
            setDraft(`得知 [${target.name}] 可能是善良村民/外来者 [${gRole.name}] 或邪恶爪牙/恶魔 [${eRole.name}]`);
          }
        }
      };

      targetSel.select.onchange = updateDreamerText;
      goodRoleSel.select.onchange = () => {
        const target = this.state.players[targetSel.select.value];
        const gRole = this.findRoleData(goodRoleSel.select.value);
        const eRole = this.findRoleData(evilRoleSel.select.value);
        if (target && gRole && eRole) {
          setDraft(`得知 [${target.name}] 可能是善良村民/外来者 [${gRole.name}] 或邪恶爪牙/恶魔 [${eRole.name}]`);
        }
      };
      evilRoleSel.select.onchange = goodRoleSel.select.onchange;
    }

    // ravenkeeper
    else if (wakingKey === 'ravenkeeper') {
      const targetSel = this.createSelectorElement("选择守鸦人指点玩家:", false);
      const roleSel = this.createRoleSelectorElement("展示的角色 (说书人决定):", "all");

      interactiveArea.appendChild(targetSel.row);
      interactiveArea.appendChild(roleSel.row);
      interactiveArea.appendChild(helperRow);

      const updateRavenkeeperText = () => {
        const target = this.state.players[targetSel.select.value];
        if (target) {
          let targetRoleKey = target.role;
          if (target.role === 'drunk' && target.drunkRole) {
            targetRoleKey = target.drunkRole;
          }
          
          let suggestedRoleKey = targetRoleKey;
          if (mustBeFalse) {
            const falseRoles = this.state.pool.filter(rk => rk !== targetRoleKey);
            suggestedRoleKey = falseRoles[0] || (targetRoleKey === 'imp' ? 'washerwoman' : 'imp');
            
            helperRow.style.display = 'block';
            helperRow.innerText = `🔍 助手提示 (已处理中毒/醉酒/混乱风暴): 处于失效状态，展示的角色必须为假！已自动预设错误角色：【${this.findRoleData(suggestedRoleKey).name}】 🔴`;
            helperRow.style.color = '#e74c3c';
            helperRow.style.background = 'rgba(231, 76, 60, 0.1)';
            helperRow.style.border = '1px solid rgba(231, 76, 60, 0.2)';
          } else {
            helperRow.style.display = 'block';
            helperRow.innerText = `🔍 助手提示: 目标实际角色为: 【${this.findRoleData(targetRoleKey).name}】 🟢`;
            helperRow.style.color = '#2ecc71';
            helperRow.style.background = 'rgba(46, 204, 113, 0.1)';
            helperRow.style.border = '1px solid rgba(46, 204, 113, 0.2)';
          }
          
          roleSel.select.value = suggestedRoleKey;
          const roleData = this.findRoleData(suggestedRoleKey);
          if (roleData) {
            setDraft(`守鸦人临终选择调查 [${target.name}]，得知其角色为: 【${roleData.name}】`);
          }
        }
      };

      targetSel.select.onchange = updateRavenkeeperText;
      roleSel.select.onchange = () => {
        const target = this.state.players[targetSel.select.value];
        const roleData = this.findRoleData(roleSel.select.value);
        if (target && roleData) {
          setDraft(`守鸦人临终选择调查 [${target.name}]，得知其角色为: 【${roleData.name}】`);
        }
      };
    }

    // farmer
    else if (wakingKey === 'farmer') {
      const targetSel = this.createSelectorElement("选择要变成农夫的存活玩家:", true); // onlyAlive = true

      interactiveArea.appendChild(targetSel.row);
      interactiveArea.appendChild(helperRow);

      const updateFarmerText = () => {
        const target = this.state.players[targetSel.select.value];
        if (target) {
          setDraft(`农夫临终传承，指定存活的 [${target.name}] 继承身份转变为村民【农夫】`);
        }
      };

      targetSel.select.onchange = updateFarmerText;
      updateFarmerText();

      const originalSave = saveBtn.onclick;
      saveBtn.onclick = () => {
        this.restorePlayersFromBackup();
        const target = this.state.players[targetSel.select.value];
        if (target) {
          const oldRoleCN = target.roleData ? target.roleData.name : target.role;
          target.role = 'farmer';
          target.roleData = this.findRoleData('farmer');
          
          this.addLog("说书人", `农夫传承：[${target.name}] 的角色由 [${oldRoleCN}] 传承转变为 [农夫]`);
          
          if (player) {
            player.abilityUsed = true;
          }
          this.renderGrimoireCircle();
          this.saveToLocalStorage();
        } else {
          this.renderGrimoireCircle();
          this.saveToLocalStorage();
        }
        originalSave();
      };
    }

    // snakecharmer
    else if (wakingKey === 'snakecharmer') {
      const targetSel = this.createSTPlayerSelectorElement("选择要魅惑的玩家 (存活):", true);
      interactiveArea.appendChild(targetSel.row);
      interactiveArea.appendChild(helperRow);

      const updateSC = () => {
        const target = this.state.players[targetSel.select.value];
        if (target) {
          const isDemon = target.roleData && target.roleData.type === 'demon';
          const isDrunkOrPoisoned = player && (player.drunk || player.poisoned);
          
          if (isDemon) {
            helperRow.style.display = 'block';
            if (isDrunkOrPoisoned) {
              helperRow.style.color = '#e67e22';
              helperRow.style.background = 'rgba(230, 126, 34, 0.1)';
              helperRow.style.border = '1px solid rgba(230, 126, 34, 0.2)';
              helperRow.innerHTML = `🔍 智能提示: 目标 [${target.name}] 是恶魔，但舞蛇人处于醉酒/中毒状态 🧪，魅惑无效，不会触发转换！⚠️`;
              setDraft(`舞蛇人选择玩家 [${target.name}]（恶魔），但舞蛇人处于醉酒/中毒状态，魅惑失败，无事发生。`);
            } else {
              helperRow.style.color = '#2ecc71';
              helperRow.style.background = 'rgba(46, 204, 113, 0.1)';
              helperRow.style.border = '1px solid rgba(46, 204, 113, 0.2)';
              helperRow.innerHTML = `🔍 智能提示: 目标 [${target.name}] 是恶魔！保存后将触发【舞蛇人转换】🟢`;
              setDraft(`舞蛇人选择玩家 [${target.name}]。目标是恶魔！保存后将触发角色与阵营交换（目标变为中毒的舞蛇人，原舞蛇人变为恶魔）`);
            }
          } else {
            helperRow.style.display = 'block';
            helperRow.style.color = 'rgba(255,255,255,0.7)';
            helperRow.style.background = 'rgba(255,255,255,0.05)';
            helperRow.style.border = '1px solid rgba(255,255,255,0.1)';
            helperRow.innerHTML = `🔍 智能提示: 目标 [${target.name}] 不是恶魔。`;
            setDraft(`舞蛇人选择玩家 [${target.name}]，但目标不是恶魔，无事发生。`);
          }
        }
      };

      targetSel.select.onchange = updateSC;
      updateSC();

      const originalSave = saveBtn.onclick;
      saveBtn.onclick = () => {
        this.restorePlayersFromBackup();
        const target = this.state.players[targetSel.select.value];
        if (target) {
          const isDemon = target.roleData && target.roleData.type === 'demon';
          const isDrunkOrPoisoned = player && (player.drunk || player.poisoned);
          
          if (isDemon && !isDrunkOrPoisoned) {
            // Perform swap!
            const oldDemonRole = target.role;
            const oldDemonRoleData = target.roleData;

            // Target becomes poisoned snakecharmer
            target.role = 'snakecharmer';
            target.roleData = this.findRoleData('snakecharmer');
            target.poisoned = true; // snakecharmer is poisoned

            // Original Snake Charmer (player) becomes the demon
            if (player) {
              player.role = oldDemonRole;
              player.roleData = oldDemonRoleData;
            }

            this.addLog("说书人", `舞蛇人转换：舞蛇人 [${player ? player.name : '未知'}] 魅惑了恶魔 [${target.name}]。两者交换角色与阵营！[${target.name}] 变为中毒的【舞蛇人】(邪恶变善良)，[${player ? player.name : '未知'}] 变为新的【${oldDemonRoleData.name}】(善良变邪恶)！`);
            
            this.renderGrimoireCircle();
            this.saveToLocalStorage();
          }
        } else {
          this.renderGrimoireCircle();
          this.saveToLocalStorage();
        }
        originalSave();
      };
    }

    // fanggu
    else if (wakingKey === 'fanggu') {
      const targetSel = this.createSTPlayerSelectorElement("选择袭击/杀害目标 (存活):", true);
      interactiveArea.appendChild(targetSel.row);
      interactiveArea.appendChild(helperRow);

      const updateFG = () => {
        const target = this.state.players[targetSel.select.value];
        if (target) {
          const isOutsider = target.roleData && target.roleData.type === 'outsider';
          const isDrunkOrPoisoned = player && (player.drunk || player.poisoned);
          
          if (isOutsider) {
            if (this.state.fangguJumped) {
              helperRow.style.display = 'block';
              helperRow.style.color = '#e74c3c';
              helperRow.style.background = 'rgba(231, 76, 60, 0.1)';
              helperRow.style.border = '1px solid rgba(231, 76, 60, 0.2)';
              helperRow.innerHTML = `🔍 智能提示: 目标是外来者 [${target.name}]，但蚀梦游魂【本局已夺舍过】，目标将直接被杀害。💀`;
              setDraft(`蚀梦游魂选择杀害外来者 [${target.name}]，但由于本局已夺舍过，目标正常死亡。`);
            } else if (isDrunkOrPoisoned) {
              helperRow.style.display = 'block';
              helperRow.style.color = '#e67e22';
              helperRow.style.background = 'rgba(230, 126, 34, 0.1)';
              helperRow.style.border = '1px solid rgba(230, 126, 34, 0.2)';
              helperRow.innerHTML = `🔍 智能提示: 目标是外来者 [${target.name}]，但蚀梦游魂处于醉酒/中毒状态 🧪，夺舍失效，目标将直接被杀害。💀`;
              setDraft(`蚀梦游魂选择杀害外来者 [${target.name}]，但蚀梦游魂处于醉酒/中毒状态，夺舍失败，目标正常死亡。`);
            } else {
              helperRow.style.display = 'block';
              helperRow.style.color = '#2ecc71';
              helperRow.style.background = 'rgba(46, 204, 113, 0.1)';
              helperRow.style.border = '1px solid rgba(46, 204, 113, 0.2)';
              helperRow.innerHTML = `🔍 智能提示: 目标是外来者 [${target.name}] 且未夺舍过！保存后将触发【蚀梦游魂夺舍】。🟢`;
              setDraft(`蚀梦游魂袭击外来者 [${target.name}] 并成功夺舍！[${target.name}] 转化为邪恶恶魔蚀梦游魂（继续存活），原蚀梦游魂 [${player ? player.name : '未知'}] 暴毙死亡 💀`);
            }
          } else {
            helperRow.style.display = 'block';
            helperRow.style.color = '#e74c3c';
            helperRow.style.background = 'rgba(231, 76, 60, 0.1)';
            helperRow.style.border = '1px solid rgba(231, 76, 60, 0.2)';
            helperRow.innerHTML = `🔍 智能提示: 目标 [${target.name}] 不是外来者，正常被杀害。💀`;
            setDraft(`蚀梦游魂选择杀害玩家 [${target.name}]，目标正常死亡。`);
          }
        }
      };

      targetSel.select.onchange = updateFG;
      updateFG();

      const originalSave = saveBtn.onclick;
      saveBtn.onclick = () => {
        this.restorePlayersFromBackup();
        const target = this.state.players[targetSel.select.value];
        if (target) {
          const isOutsider = target.roleData && target.roleData.type === 'outsider';
          const isDrunkOrPoisoned = player && (player.drunk || player.poisoned);
          
          if (isOutsider && !this.state.fangguJumped && !isDrunkOrPoisoned) {
            // Fang Gu Jump swap!
            const oldOutsiderRole = target.role;
            const oldOutsiderRoleData = target.roleData;

            // Target becomes evil Fang Gu (demon)
            target.role = 'fanggu';
            target.roleData = this.findRoleData('fanggu');
            target.poisoned = false;
            
            // Original Fang Gu dies
            if (player) {
              player.dead = true;
              player.deathType = 'killed';
              player.deathDay = this.state.dayNumber;
              player.deathPhase = this.state.phase;
              player.hasVoteToken = true;
              player.poisoned = false;
              player.safe = false;
              if (player.role !== 'drunk') {
                player.drunk = false;
              }
            }

            this.state.fangguJumped = true;

            this.addLog("说书人", `蚀梦游魂夺舍：蚀梦游魂 [${player ? player.name : '未知'}] 袭击了存活外来者 [${target.name}] (${oldOutsiderRoleData.name})！触发夺舍：[${target.name}] 转变为新的邪恶恶魔【蚀梦游魂】并继续存活，原蚀梦游魂 [${player ? player.name : '未知'}] 暴毙死亡！`);
            
            this.renderGrimoireCircle();
            this.saveToLocalStorage();
          } else {
            // Normal kill
            if (target.safe) {
              alert(`【警示】: 目标玩家 [${target.name}] 受到僧侣/老板守护免死 🛡️，但如果您出于说书人权能强制杀害，可继续保存。`);
            }
            target.dead = true;
            target.deathType = 'killed';
            target.deathDay = this.state.dayNumber;
            target.deathPhase = this.state.phase;
            target.hasVoteToken = true;

            // Clear temporary states on dead player
            target.poisoned = false;
            target.safe = false;
            if (target.role !== 'drunk') {
              target.drunk = false;
            }

            // If poisoner dies, remove poison
            if (target.role === 'poisoner') {
              this.state.players.forEach(otherP => {
                if (otherP.poisoned) {
                  otherP.poisoned = false;
                  this.addLog("系统", `因下毒者 [${target.name}] 死亡，自动清除了 [${otherP.name}] 的中毒状态 🧪`);
                }
              });
            }

            this.addLog("说书人", `蚀梦游魂袭击：蚀梦游魂 [${player ? player.name : '未知'}] 袭击并杀害了玩家 [${target.name}] 💀`);
            this.renderGrimoireCircle();
            this.saveToLocalStorage();
          }
        } else {
          this.renderGrimoireCircle();
          this.saveToLocalStorage();
        }
        originalSave();
      };
    }

    // sweetheart
    else if (wakingKey === 'sweetheart') {
      const targetSel = this.createSTPlayerSelectorElement("选择永久醉酒的目标玩家:", false);
      interactiveArea.appendChild(targetSel.row);
      interactiveArea.appendChild(helperRow);

      const updateSweetheartText = () => {
        const target = this.state.players[targetSel.select.value];
        const isDrunkOrPoisoned = player && (player.drunk || player.poisoned);
        if (target) {
          if (isDrunkOrPoisoned) {
            helperRow.style.display = 'block';
            helperRow.style.color = '#e67e22';
            helperRow.style.background = 'rgba(230, 126, 34, 0.1)';
            helperRow.style.border = '1px solid rgba(230, 126, 34, 0.2)';
            helperRow.innerHTML = `🔍 智能提示: 心上人处于醉酒/中毒状态 🧪，临终能力失效，保存后不会产生实际醉酒效果。⚠️`;
            setDraft(`心上人死亡，但由于其死亡时处于醉酒/中毒状态，能力失效，无事发生。`);
          } else {
            helperRow.style.display = 'block';
            helperRow.style.color = '#2ecc71';
            helperRow.style.background = 'rgba(46, 204, 113, 0.1)';
            helperRow.style.border = '1px solid rgba(46, 204, 113, 0.2)';
            helperRow.innerHTML = `🔍 智能提示: 保存后玩家 [${target.name}] 将永久处于【醉酒】状态。🟢`;
            setDraft(`心碎临终怨念，选定玩家 [${target.name}] 从此永久处于醉酒状态 🍺`);
          }
        }
      };

      targetSel.select.onchange = updateSweetheartText;
      updateSweetheartText();

      const originalSave = saveBtn.onclick;
      saveBtn.onclick = () => {
        this.restorePlayersFromBackup();
        const target = this.state.players[targetSel.select.value];
        const isDrunkOrPoisoned = player && (player.drunk || player.poisoned);
        if (target) {
          if (!isDrunkOrPoisoned) {
            target.drunk = true;
            this.addLog("说书人", `心上人死亡效果生效：[${target.name}] 被选定永久处于醉酒状态 🍺`);
          } else {
            this.addLog("说书人", `心上人死亡效果：因心上人处于醉酒/中毒状态，其临终能力失效。`);
          }
          if (player) {
            player.abilityUsed = true;
          }
          this.renderGrimoireCircle();
          this.saveToLocalStorage();
        } else {
          this.renderGrimoireCircle();
          this.saveToLocalStorage();
        }
        originalSave();
      };
    }

    // poisoner
    else if (wakingKey === 'poisoner') {
      const sel = this.createSelectorElement("下毒目标:", false);
      interactiveArea.appendChild(sel.row);

      sel.select.onchange = (e) => {
        this.restorePlayersFromBackup();
        const val = e.target.value;
        const target = this.state.players[val];
        if (target) {
          // Apply poison
          this.state.players.forEach(p => p.poisoned = false);
          target.poisoned = true;
          this.renderGrimoireCircle();
          this.saveToLocalStorage();
          
          setDraft(`对玩家 [${target.name}] 施加毒药 🧪`);
        } else {
          setDraft("");
          this.renderGrimoireCircle();
          this.saveToLocalStorage();
        }
      };
    }

    // monk
    else if (wakingKey === 'monk') {
      const sel = this.createSelectorElement("守护目标:", true); // living only
      interactiveArea.appendChild(sel.row);

      sel.select.onchange = (e) => {
        this.restorePlayersFromBackup();
        const val = e.target.value;
        const target = this.state.players[val];
        if (target) {
          target.safe = true;
          this.renderGrimoireCircle();
          this.saveToLocalStorage();

          setDraft(`为玩家 [${target.name}] 提供圣盾保护，今晚免受恶魔袭击 🛡️`);
        } else {
          setDraft("");
          this.renderGrimoireCircle();
          this.saveToLocalStorage();
        }
      };
    }

    // sailor
    else if (wakingKey === 'sailor') {
      const sel = this.createSelectorElement("拼酒目标:", true); // living only
      const drinkResultSel = this.createDropdownElement("谁醉酒:", ["水手自己 🍺", "目标玩家 🍺", "均清醒 (水手已醉酒免除等)"]);

      interactiveArea.appendChild(sel.row);
      interactiveArea.appendChild(drinkResultSel.row);

      const updateSailorText = () => {
        this.restorePlayersFromBackup();
        const target = this.state.players[sel.select.value];
        const res = drinkResultSel.select.value;
        if (target) {
          if (res.includes("水手自己")) {
            player.drunk = true;
            target.drunk = false;
          } else if (res.includes("目标玩家")) {
            player.drunk = false;
            target.drunk = true;
          } else {
            player.drunk = false;
            target.drunk = false;
          }
          this.renderGrimoireCircle();
          this.saveToLocalStorage();

          setDraft(`与存活玩家 [${target.name}] 拼酒。拼酒结果为: ${res}`);
        } else {
          setDraft("");
          this.renderGrimoireCircle();
          this.saveToLocalStorage();
        }
      };

      sel.select.onchange = updateSailorText;
      drinkResultSel.select.onchange = updateSailorText;
    }

    // cerenovus
    else if (wakingKey === 'cerenovus') {
      const sel = this.createSelectorElement("洗脑目标:", true); // living only
      const fakeRoleSel = this.createRoleSelectorElement("命令假装角色:", "all");

      interactiveArea.appendChild(sel.row);
      interactiveArea.appendChild(fakeRoleSel.row);

      const updateCereText = () => {
        const target = this.state.players[sel.select.value];
        const role = this.findRoleData(fakeRoleSel.select.value);
        if (target && role) {
          setDraft(`对存活玩家 [${target.name}] 实施洗脑，命令其明天必须假扮村民/外来者【${role.name}】`);
        }
      };

      sel.select.onchange = updateCereText;
      fakeRoleSel.select.onchange = updateCereText;
    }

    // --- 教派与紫罗兰 (Sects & Violets) 专属高阶交互与算法支持 ---
    
    // clockmaker
    else if (wakingKey === 'clockmaker') {
      interactiveArea.appendChild(helperRow);
      
      const N = this.state.playerCount;
      const demon = this.state.players.find(p => p.roleData && p.roleData.type === 'demon');
      const minions = this.state.players.filter(p => p.roleData && p.roleData.type === 'minion');
      
      let minDistance = null;
      if (demon && minions.length > 0) {
        minions.forEach(minion => {
          const cw = (minion.index - demon.index + N) % N;
          const ccw = (demon.index - minion.index + N) % N;
          const dist = Math.min(cw, ccw);
          if (minDistance === null || dist < minDistance) {
            minDistance = dist;
          }
        });
      }
      
      if (minDistance !== null) {
        helperRow.style.display = 'block';
        helperRow.style.color = '#2ecc71';
        helperRow.style.background = 'rgba(46, 204, 113, 0.1)';
        helperRow.style.border = '1px solid rgba(46, 204, 113, 0.2)';
        helperRow.innerHTML = `🔍 助手自动判定: 距离恶魔最近的爪牙身位距离为: <strong>${minDistance}</strong> 🟢`;
        setDraft(`得知距离恶魔最近的爪牙玩家有 ${minDistance} 个身位`);
      } else {
        helperRow.style.display = 'block';
        helperRow.style.color = '#e67e22';
        helperRow.style.background = 'rgba(230, 126, 34, 0.1)';
        helperRow.style.border = '1px solid rgba(230, 126, 34, 0.2)';
        helperRow.innerHTML = `🔍 助手提示: 场上缺少恶魔或爪牙，无法自动计算身位距离。⚠️`;
        setDraft(`得知距离恶魔最近的爪牙身位距离为: 未知`);
      }
    }

    // mathematician
    else if (wakingKey === 'mathematician') {
      interactiveArea.appendChild(helperRow);
      
      // Count abnormal players (poisoned or drunk)
      const count = this.state.players.filter(p => p.poisoned || p.drunk).length;
      
      helperRow.style.display = 'block';
      helperRow.style.color = '#2ecc71';
      helperRow.style.background = 'rgba(46, 204, 113, 0.1)';
      helperRow.style.border = '1px solid rgba(46, 204, 113, 0.2)';
      helperRow.innerHTML = `🔍 助手提示: 当前有 <strong>${count}</strong> 名玩家的能力因中毒/醉酒异常运作 🟢`;
      setDraft(`得知今天共有 ${count} 名玩家的能力运作异常。`);
    }

    // oracle
    else if (wakingKey === 'oracle') {
      interactiveArea.appendChild(helperRow);
      
      // Count dead evil players
      const deadEvilCount = this.state.players.filter(p => p.dead && p.roleData && ['minion', 'demon'].includes(p.roleData.type)).length;
      
      helperRow.style.display = 'block';
      helperRow.style.color = '#3498db';
      helperRow.style.background = 'rgba(52, 152, 219, 0.1)';
      helperRow.style.border = '1px solid rgba(52, 152, 219, 0.2)';
      helperRow.innerHTML = `🔍 助手计算: 已出局死亡的玩家中共有 <strong>${deadEvilCount}</strong> 名邪恶阵营玩家 🟢`;
      setDraft(`得知当前已出局死亡的玩家群体中，共有 ${deadEvilCount} 名邪恶阵营玩家。`);
    }

    // flowergirl
    else if (wakingKey === 'flowergirl') {
      const resultSel = this.createDropdownElement("恶魔今天白天是否参与过投票？", ["否 ❌", "是 投票过 🪓"]);
      interactiveArea.appendChild(resultSel.row);
      
      const updateFGText = () => {
        const voted = resultSel.select.value.includes("是");
        setDraft(`告知卖花女：恶魔今天白天在处决投票中 [${voted ? '是' : '否'}] 进行过举手投票。`);
      };
      resultSel.select.onchange = updateFGText;
      updateFGText();
    }

    // towncrier
    else if (wakingKey === 'towncrier') {
      const resultSel = this.createDropdownElement("今天白天是否有爪牙进行过提名发言？", ["否 ❌", "是 发起过提名 📢"]);
      interactiveArea.appendChild(resultSel.row);
      
      const updateTCText = () => {
        const nominated = resultSel.select.value.includes("是");
        setDraft(`告知公告员：今天白天的提名人选环节中，[${nominated ? '有' : '没有'}] 爪牙发起过提名。`);
      };
      resultSel.select.onchange = updateTCText;
      updateTCText();
    }

    // philosopher
    else if (wakingKey === 'philosopher') {
      const goodRoles = [
        ...this.getAvailableRolesList('townsfolk'),
        ...this.getAvailableRolesList('outsider')
      ].filter(r => r.key !== 'philosopher');
      
      const selRole = this.createRoleSelectorElement("夺取哪个善良角色的能力:", "all");
      interactiveArea.appendChild(selRole.row);
      interactiveArea.appendChild(helperRow);
      
      const updatePhilo = () => {
        const roleKey = selRole.select.value;
        const roleData = this.findRoleData(roleKey);
        
        if (roleKey && roleData) {
          const inPlayTarget = this.state.players.find(p => p.role === roleKey && !p.dead);
          if (inPlayTarget) {
            helperRow.style.display = 'block';
            helperRow.style.color = '#e67e22';
            helperRow.style.background = 'rgba(230, 126, 34, 0.1)';
            helperRow.style.border = '1px solid rgba(230, 126, 34, 0.2)';
            helperRow.innerHTML = `🔍 智能提示: 该角色当前在场由 [${inPlayTarget.name}] 扮演！保存后将导致该玩家处于【哲学家醉酒】状态。⚠️`;
            setDraft(`哲学家选择夺取善良角色【${roleData.name}】的能力，在场玩家 [${inPlayTarget.name}] 陷入醉酒 🍺`);
          } else {
            helperRow.style.display = 'block';
            helperRow.style.color = '#2ecc71';
            helperRow.style.background = 'rgba(46, 204, 113, 0.1)';
            helperRow.style.border = '1px solid rgba(46, 204, 113, 0.2)';
            helperRow.innerHTML = `🔍 智能提示: 该角色当前不在场，你可以无副作用地获得其能力。🟢`;
            setDraft(`哲学家选择夺取不在场善良角色【${roleData.name}】的能力。`);
          }
        } else {
          helperRow.style.display = 'none';
          setDraft("哲学家放弃夺取任何能力或未做出选择。");
        }
      };
      
      selRole.select.onchange = updatePhilo;
      updatePhilo();
      
      const originalSave = saveBtn.onclick;
      saveBtn.onclick = () => {
        this.restorePlayersFromBackup();
        const roleKey = selRole.select.value;
        if (roleKey) {
          player.philosopherChosenRole = roleKey;
          
          // Apply drunk to anyone playing that role
          const inPlayTarget = this.state.players.find(p => p.role === roleKey && !p.dead);
          if (inPlayTarget) {
            inPlayTarget.drunk = true;
            this.addLog("说书人", `哲学家抢夺能力生效：在场玩家 [${inPlayTarget.name}] (${inPlayTarget.roleData?.name}) 陷入【哲学家醉酒】状态 🍺`);
          }
          if (player) {
            player.abilityUsed = true;
          }
          this.renderGrimoireCircle();
          this.saveToLocalStorage();
        } else {
          this.renderGrimoireCircle();
          this.saveToLocalStorage();
        }
        originalSave();
      };
    }

    // seamstress
    else if (wakingKey === 'seamstress') {
      const selA = this.createSelectorElement("选择调查玩家 A:", false);
      const selB = this.createSelectorElement("选择调查玩家 B:", false);
      
      interactiveArea.appendChild(selA.row);
      interactiveArea.appendChild(selB.row);
      interactiveArea.appendChild(helperRow);
      
      const updateSeamstress = () => {
        const pA = this.state.players[selA.select.value];
        const pB = this.state.players[selB.select.value];
        
        if (pA && pB) {
          const isAEvil = this.isEvilPlayer(pA);
          const isBEvil = this.isEvilPlayer(pB);
          const sameCamp = isAEvil === isBEvil;
          
          helperRow.style.display = 'block';
          helperRow.style.color = '#2ecc71';
          helperRow.style.background = 'rgba(46, 204, 113, 0.1)';
          helperRow.style.border = '1px solid rgba(46, 204, 113, 0.2)';
          helperRow.innerHTML = `🔍 助手判定: 两位玩家阵营【${sameCamp ? '相同' : '不同'}】 🟢 (A是${isAEvil ? '邪恶' : '善良'}，B是${isBEvil ? '邪恶' : '善良'})`;
          
          setDraft(`裁缝使用一次性技能调查 [${pA.name}] 与 [${pB.name}]，得知他们两人的阵营 [${sameCamp ? '相同' : '不同'}]。`);
        } else {
          helperRow.style.display = 'none';
          setDraft("裁缝尚未决定调查对象。");
        }
      };
      
      selA.select.onchange = updateSeamstress;
      selB.select.onchange = updateSeamstress;
      updateSeamstress();
      
      const originalSave = saveBtn.onclick;
      saveBtn.onclick = () => {
        const pA = this.state.players[selA.select.value];
        const pB = this.state.players[selB.select.value];
        if (pA && pB) {
          if (player) {
            player.abilityUsed = true;
          }
          this.renderGrimoireCircle();
          this.saveToLocalStorage();
        }
        originalSave();
      };
    }

    // witch
    else if (wakingKey === 'witch') {
      const sel = this.createSelectorElement("下毒咒目标 (明天首次提名将暴毙):", true); // living only
      interactiveArea.appendChild(sel.row);
      
      sel.select.onchange = (e) => {
        this.restorePlayersFromBackup();
        const val = e.target.value;
        const target = this.state.players[val];
        if (target) {
          this.state.players.forEach(p => p.witchCursed = false);
          target.witchCursed = true;
          this.renderGrimoireCircle();
          this.saveToLocalStorage();
          setDraft(`女巫对存活玩家 [${target.name}] 施加提名诅咒 ☠️`);
        } else {
          this.state.players.forEach(p => p.witchCursed = false);
          setDraft("");
          this.renderGrimoireCircle();
          this.saveToLocalStorage();
        }
      };
    }

    // pithag
    else if (wakingKey === 'pithag') {
      const targetSel = this.createSelectorElement("选择要变形的目标玩家:", false);
      const roleSel = this.createRoleSelectorElement("将其变形为新角色:", "all");
      
      interactiveArea.appendChild(targetSel.row);
      interactiveArea.appendChild(roleSel.row);
      
      const updatePitHag = () => {
        const target = this.state.players[targetSel.select.value];
        const roleKey = roleSel.select.value;
        const roleData = this.findRoleData(roleKey);
        
        if (target && roleKey && roleData) {
          setDraft(`熬药巫婆施展变形术，将玩家 [${target.name}] 转换为【${roleData.name}】🔮`);
        } else {
          setDraft("熬药巫婆尚未决定变形目标与角色。");
        }
      };
      
      targetSel.select.onchange = updatePitHag;
      roleSel.select.onchange = updatePitHag;
      updatePitHag();
      
      const originalSave = saveBtn.onclick;
      saveBtn.onclick = () => {
        this.restorePlayersFromBackup();
        const target = this.state.players[targetSel.select.value];
        const roleKey = roleSel.select.value;
        const roleData = this.findRoleData(roleKey);
        
        if (target && roleKey && roleData) {
          const oldRoleCN = target.roleData ? target.roleData.name : target.role;
          
          target.role = roleKey;
          target.roleData = roleData;
          
          this.addLog("说书人", `熬药巫婆变形效果生效：[${target.name}] 的角色由 [${oldRoleCN}] 转变为 [${roleData.name}] 🔮`);
          this.renderGrimoireCircle();
          this.saveToLocalStorage();
        } else {
          this.renderGrimoireCircle();
          this.saveToLocalStorage();
        }
        originalSave();
      };
    }

    // barber
    else if (wakingKey === 'barber') {
      const selA = this.createSelectorElement("交换存活玩家 A:", true);
      const selB = this.createSelectorElement("交换存活玩家 B:", true);
      
      const swapBtn = document.createElement('button');
      swapBtn.className = 'btn btn-secondary';
      swapBtn.style.fontSize = '0.75rem';
      swapBtn.style.padding = '6px';
      swapBtn.innerText = "🔄 秘密交换角色并保存";
      
      interactiveArea.appendChild(selA.row);
      interactiveArea.appendChild(selB.row);
      interactiveArea.appendChild(swapBtn);
      interactiveArea.appendChild(helperRow);
      
      swapBtn.onclick = () => {
        const pA = this.state.players[selA.select.value];
        const pB = this.state.players[selB.select.value];
        
        if (pA && pB && pA.index !== pB.index) {
          const tempRole = pA.role;
          const tempRoleData = pA.roleData;
          
          pA.role = pB.role;
          pA.roleData = pB.roleData;
          
          pB.role = tempRole;
          pB.roleData = tempRoleData;
          
          this.addLog("系统", `【理发师死亡特殊效果】：说书人秘密交换了存活玩家 [${pA.name}] 与 [${pB.name}] 的身份卡牌 🔄`);
          
          helperRow.style.display = 'block';
          helperRow.style.color = '#2ecc71';
          helperRow.style.background = 'rgba(46, 204, 113, 0.1)';
          helperRow.style.border = '1px solid rgba(46, 204, 113, 0.2)';
          helperRow.innerHTML = `🔄 交换成功！[${pA.name}] 与 [${pB.name}] 的卡牌已成功互调。请注意秘密告知邪恶阵营新交换结果！`;
          
          setDraft(`理发师死亡效果：说书人交换了存活玩家 [${pA.name}] (${pB.roleData?.name}) 与 [${pB.name}] (${pA.roleData?.name}) 的身份。`);
          
          if (player) {
            player.abilityUsed = true;
          }
          this.renderGrimoireCircle();
          this.saveToLocalStorage();
        } else {
          alert("请选择两个不同的存活玩家再进行交换！");
        }
      };
    }

    // eviltwin
    else if (wakingKey === 'eviltwin') {
      const goodTwinSel = this.createSelectorElement("选择与该邪恶双子绑定的善良双子玩家:", false);
      interactiveArea.appendChild(goodTwinSel.row);
      
      const updateTwin = () => {
        const target = this.state.players[goodTwinSel.select.value];
        if (target) {
          setDraft(`邪恶双子 [${player ? player.name : '未分配'}] 与善良双子 [${target.name}] 互相确认身份 👥`);
        }
      };
      
      goodTwinSel.select.onchange = updateTwin;
      updateTwin();
    }

    // juggler
    else if (wakingKey === 'juggler') {
      const countSel = this.createDropdownElement("杂耍艺人今天猜对的善良玩家数:", [0, 1, 2, 3, 4, 5]);
      interactiveArea.appendChild(countSel.row);
      
      const updateJuggler = () => {
        setDraft(`杂耍艺人醒来，得知他今天白天公开猜对身份的善良玩家数量为: 【${countSel.select.value}】个`);
      };
      
      countSel.select.onchange = updateJuggler;
      updateJuggler();
    }

    // sage
    else if (wakingKey === 'sage') {
      const demon = this.state.players.find(p => p.roleData && p.roleData.type === 'demon');
      const otherLiving = this.state.players.filter(p => !p.dead && p.index !== (demon ? demon.index : -1));
      
      const decoySel = this.createSTPlayerSelectorElement("选择干扰/假恶魔备选目标玩家 (存活):", true);
      interactiveArea.appendChild(decoySel.row);
      interactiveArea.appendChild(helperRow);
      
      const updateSage = () => {
        const decoy = this.state.players[decoySel.select.value];
        const actualDemonName = demon ? demon.name : "未分配的恶魔";
        
        if (decoy) {
          helperRow.style.display = 'block';
          helperRow.style.color = '#3498db';
          helperRow.style.background = 'rgba(52, 152, 219, 0.1)';
          helperRow.style.border = '1px solid rgba(52, 152, 219, 0.2)';
          helperRow.innerHTML = `🔍 智能提示: 杀死贤者的恶魔是 [${actualDemonName}]。您选择展示的两个备选项为: 【[${actualDemonName}] 和 [${decoy.name}]】 🟢`;
          setDraft(`贤者夜间被恶魔杀死暴毙，唤醒并得知两名玩家 [${actualDemonName}] 与 [${decoy.name}] 之一是恶魔。`);
        } else {
          helperRow.style.display = 'none';
          setDraft("贤者暴毙，尚未决定要出示的另一名假目标。");
        }
      };
      
      decoySel.select.onchange = updateSage;
      
      if (otherLiving.length > 0) {
        decoySel.select.value = otherLiving[Math.floor(Math.random() * otherLiving.length)].index;
        updateSage();
      }
      
      const originalSave = saveBtn.onclick;
      saveBtn.onclick = () => {
        if (player) {
          player.abilityUsed = true;
        }
        this.renderGrimoireCircle();
        this.saveToLocalStorage();
        originalSave();
      };
    }

    // godfather
    else if (wakingKey === 'godfather') {
      const isFirst = (this.state.dayNumber === 1);
      
      if (isFirst) {
        // 第一夜教父是知道外来者的
        // 查找在场的外来者玩家
        const outsiders = this.state.players.filter(p => {
          const charData = this.findRoleData(p.role);
          return charData && charData.type === 'outsider';
        });

        const infoDiv = document.createElement('div');
        infoDiv.style.background = 'rgba(212, 175, 55, 0.1)';
        infoDiv.style.border = '1px solid rgba(212, 175, 55, 0.3)';
        infoDiv.style.padding = '10px';
        infoDiv.style.borderRadius = '8px';
        infoDiv.style.marginBottom = '10px';
        infoDiv.style.color = 'hsl(var(--gold))';
        infoDiv.style.fontSize = '0.9rem';
        infoDiv.style.lineHeight = '1.4';

        if (outsiders.length > 0) {
          let listHtml = outsiders.map(p => {
            const charData = this.findRoleData(p.role);
            const roleName = charData ? charData.name : p.role;
            return `👤 <strong>${p.name}</strong> (座位 ${p.index + 1}) — 角色: <strong>${roleName}</strong>`;
          }).join('<br>');
          infoDiv.innerHTML = `👁️ <strong>【教父首夜专属信息】</strong><br>本局在场的外来者如下，说书人请指点并告知教父：<br>${listHtml}`;
          setDraft(`首夜唤醒教父，并告知其本局在场的外来者：${outsiders.map(p => `${p.name}(${this.findRoleData(p.role)?.name || p.role})`).join('、')}。`);
        } else {
          infoDiv.innerHTML = `👁️ <strong>【教父首夜专属信息】</strong><br>本局没有外来者在场 🟢`;
          setDraft(`首夜唤醒教父，得知本局没有外来者在场。`);
        }
        interactiveArea.appendChild(infoDiv);

      } else {
        // 非首夜：如果今天有外来者死亡，教父晚上带刀
        // 检测今日是否有外来者死亡
        const outsiderDied = this.didAnyOutsiderDieToday();
        
        const infoDiv = document.createElement('div');
        infoDiv.style.padding = '10px';
        infoDiv.style.borderRadius = '8px';
        infoDiv.style.marginBottom = '10px';
        infoDiv.style.fontSize = '0.9rem';
        infoDiv.style.lineHeight = '1.4';

        if (outsiderDied) {
          // 找到死亡的外来者有哪些
          const deadOutsidersToday = this.state.players.filter(p => {
            if (!p.dead || p.deathDay !== this.state.dayNumber) return false;
            const diedInDaytime = (p.deathPhase === 'day' || p.deathType === 'executed');
            if (!diedInDaytime) return false;
            const charData = this.findRoleData(p.role);
            return charData && charData.type === 'outsider';
          });
          const deadNames = deadOutsidersToday.map(p => `【${p.name} (${this.findRoleData(p.role)?.name})】`).join('，');

          infoDiv.style.background = 'rgba(231, 76, 60, 0.15)';
          infoDiv.style.border = '1px solid rgba(231, 76, 60, 0.3)';
          infoDiv.style.color = '#e74c3c';
          infoDiv.innerHTML = `⚔️ <strong>【教父带刀提醒】</strong><br>今日有外来者死亡！(${deadNames})<br>👉 <strong>教父今晚带刀，拥有一次击杀机会！</strong>`;
          interactiveArea.appendChild(infoDiv);

          // 显示选择击杀目标的下拉框
          const sel = this.createSelectorElement("教父刺杀目标:", true); // living only
          interactiveArea.appendChild(sel.row);

          const updateGodfatherKill = () => {
            this.restorePlayersFromBackup();
            const target = this.state.players[sel.select.value];
            if (target) {
              let actualKilled = true;
              let draftMsg = `教父今晚带刀发动袭击，杀害了存活玩家 [${target.name}] 💀`;

              // 1. 检查茶水女保护
              const isTeaLadyProtected = this.isProtectedByTeaLady(target.index);
              if (isTeaLadyProtected) {
                if (!confirm(`【⚠️ 茶水女免死结界警告】\n\n目标玩家 [${target.name}] 当前正受到存活且未醉酒中毒的【茶水女】保护！\n\n正常情况下他今晚【无法死亡】。是否要强制杀害？`)) {
                  actualKilled = false;
                  draftMsg = `教父试图袭击受茶水女保护的玩家 [${target.name}]，但被茶水女免死结界阻挡，无人死亡 🛡️`;
                }
              }

              // 2. 检查弄臣免死 (如果依然要杀死，且是弄臣)
              if (actualKilled && target.role === 'fool') {
                const isDrunkOrPoisoned = target.drunk || target.poisoned;
                if (!isDrunkOrPoisoned) {
                  if (!target.foolLifeUsed) {
                    alert(`【🎭 弄臣首次死亡免死】\n\n袭击目标 [${target.name}] (弄臣) 首次死亡，且处于清醒健康状态！\n\n系统已自动触发其免死金牌：免除今晚的死亡，扣除一次免死机会，弄臣平安度过此夜！`);
                    target.foolLifeUsed = true;
                    actualKilled = false;
                    draftMsg = `教父袭击了清醒健康的弄臣 [${target.name}]，触发弄臣首次免死，弄臣平安存活并扣除一次免死机会 ✨`;
                    this.addLog("说书人", `弄臣 [${target.name}] 夜间受到袭击，触发首次免死，继续存活！`);
                  } else {
                    alert(`【⚠️ 弄臣警告】\n\n袭击目标 [${target.name}] (弄臣) 之前已经消耗过免死金牌，今晚将正常死亡！`);
                  }
                } else {
                  alert(`【🚨 弄臣失效警告】\n\n袭击目标 [${target.name}] (弄臣) 当前处于【醉酒/中毒】状态，其技能失效，正常死亡！`);
                }
              }

              if (actualKilled) {
                if (target.safe) {
                  alert(`【警示】: 目标玩家 [${target.name}] 受到僧侣/老板守护免死 🛡️，但如果您出于说书人权能强制杀害，可继续保存。`);
                }
                target.dead = true;
                target.deathType = 'killed';
                target.deathDay = this.state.dayNumber;
                target.deathPhase = this.state.phase;
                target.hasVoteToken = true;
                
                // 自动清洗死者的临时状态
                target.poisoned = false;
                target.safe = false;
                if (target.role !== 'drunk') {
                  target.drunk = false;
                }

                // 下毒者死亡解毒规则
                if (target.role === 'poisoner') {
                  this.state.players.forEach(otherP => {
                    if (otherP.poisoned) {
                      otherP.poisoned = false;
                      this.addLog("系统", `因下毒者 [${target.name}] 死亡，自动清除了 [${otherP.name}] 的中毒状态 🧪`);
                    }
                  });
                }
              }

              this.renderGrimoireCircle();
              this.saveToLocalStorage();
              setDraft(draftMsg);
            } else {
              setDraft("教父今晚带刀选择空切，无人死亡。");
              this.renderGrimoireCircle();
              this.saveToLocalStorage();
            }
          };

          sel.select.onchange = updateGodfatherKill;
          updateGodfatherKill();

        } else {
          infoDiv.style.background = 'rgba(46, 204, 113, 0.15)';
          infoDiv.style.border = '1px solid rgba(46, 204, 113, 0.3)';
          infoDiv.style.color = '#2ecc71';
          infoDiv.innerHTML = `🛡️ <strong>【教父不带刀】</strong><br>今日没有外来者死亡。<br>👉 <strong>教父今晚没有杀人权利（不带刀）。说书人请直接确认过夜。</strong>`;
          interactiveArea.appendChild(infoDiv);
          
          setDraft("教父今晚不带刀（今日无外来者死亡），直接确认过夜。");
        }
      }
    }

    // imp & other killing demons
    else if (['imp', 'subassassin', 'po', 'shabaloth', 'zombuul', 'fanggu', 'vigormortis', 'nodashii', 'vortox'].includes(wakingKey)) {
      const isAssassin = wakingKey === 'subassassin';
      const labelText = isAssassin ? "刺客必死刺杀目标:" : "袭击/杀害目标:";
      const sel = this.createSelectorElement(labelText, true); // living only
      interactiveArea.appendChild(sel.row);

      sel.select.onchange = (e) => {
        this.restorePlayersFromBackup();
        const val = e.target.value;
        const target = this.state.players[val];
        if (target) {
          let actualKilled = true;
          let draftMsg = isAssassin ? `刺客发动必死刺杀，残忍杀害了玩家 [${target.name}] 💀` : `恶魔发动夜间袭击，杀害了存活玩家 [${target.name}] 💀`;

          // 1. 检查茶水女保护
          const isTeaLadyProtected = this.isProtectedByTeaLady(target.index);
          if (isTeaLadyProtected && !isAssassin) {
            if (!confirm(`【⚠️ 茶水女免死结界警告】\n\n目标玩家 [${target.name}] 当前正受到存活且未醉酒中毒的【茶水女】保护！\n\n正常情况下他今晚【无法死亡】。是否要强制杀害？`)) {
              actualKilled = false;
              draftMsg = `恶魔试图袭击受茶水女保护的玩家 [${target.name}]，但被茶水女免死结界阻挡，无人死亡 🛡️`;
            }
          }

          // 2. 检查弄臣免死 (如果依然要杀死，且是弄臣)
          if (actualKilled && target.role === 'fool') {
            const isDrunkOrPoisoned = target.drunk || target.poisoned;
            if (!isDrunkOrPoisoned) {
              if (!target.foolLifeUsed) {
                alert(`【🎭 弄臣首次死亡免死】\n\n袭击目标 [${target.name}] (弄臣) 首次死亡，且处于清醒健康状态！\n\n系统已自动触发其免死金牌：免除今晚的死亡，扣除一次免死机会，弄臣平安度过此夜！`);
                target.foolLifeUsed = true;
                actualKilled = false;
                draftMsg = `恶魔袭击了清醒健康的弄臣 [${target.name}]，触发弄臣首次免死，弄臣平安存活并扣除一次免死机会 ✨`;
                this.addLog("说书人", `弄臣 [${target.name}] 夜间受到袭击，触发首次免死，继续存活！`);
              } else {
                alert(`【⚠️ 弄臣警告】\n\n袭击目标 [${target.name}] (弄臣) 之前已经消耗过免死金牌，今晚将正常死亡！`);
              }
            } else {
              alert(`【🚨 弄臣失效警告】\n\n袭击目标 [${target.name}] (弄臣) 当前处于【醉酒/中毒】状态，其技能失效，正常死亡！`);
            }
          }

          if (actualKilled) {
            if (target.safe && !isAssassin) {
              alert(`【警示】: 目标玩家 [${target.name}] 受到僧侣/老板守护免死 🛡️，但如果您出于说书人权能强制杀害，可继续保存。`);
            }
            target.dead = true;
            target.deathType = 'killed';
            target.deathDay = this.state.dayNumber;
            target.deathPhase = this.state.phase;
            target.hasVoteToken = true;

            // 自动清洗死者的临时状态
            target.poisoned = false;
            target.safe = false;
            if (target.role !== 'drunk') {
              target.drunk = false;
            }

            // 规则：下毒者一旦死亡，被其毒害的目标必须立刻解毒！
            if (target.role === 'poisoner') {
              this.state.players.forEach(otherP => {
                if (otherP.poisoned) {
                  otherP.poisoned = false;
                  this.addLog("系统", `因下毒者 [${target.name}] 死亡，自动清除了 [${otherP.name}] 的中毒状态 🧪`);
                }
              });
            }
          }

          this.renderGrimoireCircle();
          this.saveToLocalStorage();
          setDraft(draftMsg);
        } else {
          setDraft("");
          this.renderGrimoireCircle();
          this.saveToLocalStorage();
        }
      };
    }

    // Fallback: Generic Waking Notes
    else {
      setDraft(`已唤醒，无特殊魔典指示，行动正常结算完毕`);
    }
  }

  // --- HTML Elements Creators Helpers ---

  createSelectorElement(labelText, onlyAlive = false) {
    return this.createCustomSelectorElement(labelText, this.state.players, onlyAlive);
  }

  createSTPlayerSelectorElement(labelText, onlyAlive = false) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.gap = '8px';
    
    const lbl = document.createElement('span');
    lbl.innerText = labelText;
    lbl.style.fontSize = '0.8rem';
    lbl.style.color = '#e5e7eb';
    
    const select = document.createElement('select');
    select.className = 'manual-select';
    select.style.maxWidth = '180px';
    
    const placeholder = document.createElement('option');
    placeholder.value = "";
    placeholder.innerText = "-- 请点选玩家 --";
    select.appendChild(placeholder);
    
    this.state.players.forEach(p => {
      if (onlyAlive && p.dead) return;
      const opt = document.createElement('option');
      opt.value = p.index;
      
      let roleDesc = "";
      if (p.role === 'drunk') {
        roleDesc = `[酒鬼-${p.drunkRole ? (this.findRoleData(p.drunkRole)?.name || p.drunkRole) : '未设'}]`;
      } else if (p.roleData) {
        roleDesc = `[${p.roleData.name}]`;
      }
      
      opt.innerText = `${p.index + 1}号: ${p.name} ${roleDesc} ${p.dead ? '(已死)' : '(存活)'}`;
      select.appendChild(opt);
    });
    
    row.appendChild(lbl);
    row.appendChild(select);
    return { row, select };
  }

  createCustomSelectorElement(labelText, playersList, onlyAlive = false) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.gap = '8px';
    
    const lbl = document.createElement('span');
    lbl.innerText = labelText;
    lbl.style.fontSize = '0.8rem';
    lbl.style.color = '#e5e7eb';
    
    const select = document.createElement('select');
    select.className = 'manual-select';
    select.style.maxWidth = '180px';
    
    const placeholder = document.createElement('option');
    placeholder.value = "";
    placeholder.innerText = "-- 请点选玩家 --";
    select.appendChild(placeholder);
    
    playersList.forEach(p => {
      if (onlyAlive && p.dead) return;
      const opt = document.createElement('option');
      opt.value = p.index;
      opt.innerText = `${p.index + 1}号: ${p.name} ${p.dead ? '(已死)' : '(存活)'}`;
      select.appendChild(opt);
    });
    
    row.appendChild(lbl);
    row.appendChild(select);
    return { row, select };
  }

  createRoleSelectorElement(labelText, filterType = "all") {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.gap = '8px';
    
    const lbl = document.createElement('span');
    lbl.innerText = labelText;
    lbl.style.fontSize = '0.8rem';
    lbl.style.color = '#e5e7eb';
    
    const select = document.createElement('select');
    select.className = 'manual-select';
    select.style.maxWidth = '180px';
    
    const placeholder = document.createElement('option');
    placeholder.value = "";
    placeholder.innerText = "-- 请选择角色 --";
    select.appendChild(placeholder);
    
    // Scan pool roles
    this.state.pool.forEach(key => {
      const char = this.findRoleData(key);
      if (char) {
        if (filterType === 'townsfolk' && char.type !== 'townsfolk') return;
        if (filterType === 'outsider' && char.type !== 'outsider') return;
        if (filterType === 'minion' && char.type !== 'minion') return;
        if (filterType === 'demon' && char.type !== 'demon') return;
        
        if (filterType === 'good' && (char.type !== 'townsfolk' && char.type !== 'outsider')) return;
        if (filterType === 'evil' && (char.type !== 'minion' && char.type !== 'demon')) return;
        
        const opt = document.createElement('option');
        opt.value = key;
        opt.innerText = char.name;
        select.appendChild(opt);
      }
    });
    
    row.appendChild(lbl);
    row.appendChild(select);
    return { row, select };
  }

  createDropdownElement(labelText, optionsList) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.gap = '8px';
    
    const lbl = document.createElement('span');
    lbl.innerText = labelText;
    lbl.style.fontSize = '0.8rem';
    lbl.style.color = '#e5e7eb';
    
    const select = document.createElement('select');
    select.className = 'manual-select';
    select.style.maxWidth = '180px';
    
    const placeholder = document.createElement('option');
    placeholder.value = "";
    placeholder.innerText = "-- 请点选 --";
    select.appendChild(placeholder);
    
    optionsList.forEach(val => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.innerText = val;
      select.appendChild(opt);
    });
    
    row.appendChild(lbl);
    row.appendChild(select);
    return { row, select };
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

  openScriptReferenceModal(scriptKey) {
    const targetScript = scriptKey || this.state.script;
    const modal = document.getElementById('script-reference-modal');
    const titleEl = document.getElementById('ref-modal-title');
    const bodyEl = document.getElementById('ref-modal-body');
    
    if (!modal || !bodyEl) return;
    
    bodyEl.innerHTML = '';
    
    let characters = {};
    let scriptName = '';
    
    if (this.state.customMix && !scriptKey) {
      scriptName = '当前混编勾选角色';
      this.state.pool.forEach(key => {
        const char = this.findRoleData(key);
        if (char) {
          if (!characters[char.type]) characters[char.type] = [];
          characters[char.type].push({ key, ...char });
        }
      });
    } else {
      const scriptData = ROLES_DATA[targetScript];
      if (!scriptData) return;
      scriptName = scriptData.name;
      
      const charMap = scriptData.characters;
      Object.keys(charMap).forEach(key => {
        const char = charMap[key];
        if (!characters[char.type]) characters[char.type] = [];
        characters[char.type].push({ key, ...char });
      });
    }
    
    titleEl.innerText = `${scriptName} - 角色说明表 📜`;
    
    const typesOrder = ['townsfolk', 'outsider', 'minion', 'demon'];
    typesOrder.forEach(type => {
      const list = characters[type];
      if (!list || list.length === 0) return;
      
      const catHeader = document.createElement('div');
      catHeader.className = 'ref-category-header';
      catHeader.style.color = this.getRoleTypeColor(type);
      catHeader.style.fontSize = '0.95rem';
      catHeader.style.fontWeight = 'bold';
      catHeader.style.marginTop = '15px';
      catHeader.style.marginBottom = '8px';
      catHeader.style.borderBottom = `1px solid rgba(255,255,255,0.08)`;
      catHeader.style.paddingBottom = '4px';
      catHeader.innerText = `${this.getRoleTypeCN(type)} (${list.length})`;
      bodyEl.appendChild(catHeader);
      
      list.forEach(char => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'ref-role-item';
        itemDiv.style.marginBottom = '12px';
        itemDiv.style.background = 'rgba(255,255,255,0.02)';
        itemDiv.style.padding = '8px 12px';
        itemDiv.style.borderRadius = '8px';
        itemDiv.style.border = '1px solid rgba(255,255,255,0.04)';
        
        const nameRow = document.createElement('div');
        nameRow.style.display = 'flex';
        nameRow.style.justifyContent = 'space-between';
        nameRow.style.alignItems = 'baseline';
        nameRow.style.marginBottom = '4px';
        
        const nameSpan = document.createElement('span');
        nameSpan.style.fontFamily = 'var(--font-title)';
        nameSpan.style.fontWeight = 'bold';
        nameSpan.style.color = '#fff';
        nameSpan.style.fontSize = '0.9rem';
        nameSpan.innerText = char.name;
        
        const enSpan = document.createElement('span');
        enSpan.style.fontSize = '0.7rem';
        enSpan.style.color = 'hsl(var(--text-muted))';
        enSpan.innerText = char.en;
        
        nameRow.appendChild(nameSpan);
        nameRow.appendChild(enSpan);
        itemDiv.appendChild(nameRow);
        
        const descDiv = document.createElement('div');
        descDiv.style.fontSize = '0.75rem';
        descDiv.style.color = 'hsla(0, 0%, 100%, 0.8)';
        descDiv.style.lineHeight = '1.4';
        descDiv.innerText = char.ability;
        itemDiv.appendChild(descDiv);
        
        bodyEl.appendChild(itemDiv);
      });
    });
    
    modal.classList.add('active');
  }
  
  closeScriptReferenceModal() {
    const modal = document.getElementById('script-reference-modal');
    if (modal) modal.classList.remove('active');
  }

  getRoleTypeBg(type) {
    const map = {
      townsfolk: 'rgba(93, 173, 226, 0.12)',
      outsider: 'rgba(245, 176, 65, 0.12)',
      minion: 'rgba(236, 112, 99, 0.12)',
      demon: 'rgba(255, 107, 107, 0.12)'
    };
    return map[type] || 'rgba(255, 255, 255, 0.1)';
  }

  openSingleRoleModal(roleKey) {
    const char = this.findRoleData(roleKey);
    if (!char) return;

    const modal = document.getElementById('single-role-modal');
    const titleEl = document.getElementById('single-role-modal-title');
    const bodyEl = document.getElementById('single-role-modal-body');

    if (!modal || !bodyEl || !titleEl) return;

    titleEl.innerText = `${char.name} (${char.en})`;

    bodyEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div style="font-size: 0.8rem; font-weight: bold; color: ${this.getRoleTypeColor(char.type)}; background: ${this.getRoleTypeBg(char.type)}; padding: 4px 8px; border-radius: 4px; align-self: flex-start; border: 1px solid ${this.getRoleTypeColor(char.type)}2b;">
          ${this.getRoleTypeCN(char.type)}
        </div>
        <div style="font-size: 0.85rem; color: #fff; line-height: 1.5; margin-top: 5px; border: 1px solid rgba(255,255,255,0.06); padding: 10px; border-radius: 6px; background: rgba(0,0,0,0.25);">
          ${char.ability}
        </div>
        ${char.wakeFirst ? `
          <div style="margin-top: 8px;">
            <div style="font-size: 0.75rem; color: hsl(var(--gold)); font-weight: bold; margin-bottom: 2px;">首夜行动说书人指引：</div>
            <div style="font-size: 0.75rem; color: #d1d5db; line-height: 1.4; padding-left: 8px; border-left: 2px solid hsl(var(--gold));">${char.wakeFirst}</div>
          </div>
        ` : ''}
        ${char.wakeOther ? `
          <div style="margin-top: 8px;">
            <div style="font-size: 0.75rem; color: hsl(var(--gold)); font-weight: bold; margin-bottom: 2px;">其他夜晚行动说书人指引：</div>
            <div style="font-size: 0.75rem; color: #d1d5db; line-height: 1.4; padding-left: 8px; border-left: 2px solid hsl(var(--gold));">${char.wakeOther}</div>
          </div>
        ` : ''}
      </div>
    `;

    modal.classList.add('active');
  }

  closeSingleRoleModal() {
    const modal = document.getElementById('single-role-modal');
    if (modal) modal.classList.remove('active');
  }

  openGameOverModal() {
    const players = this.state.players;
    if (!players || players.length === 0) {
      alert("当前游戏中没有玩家，无法进行结算！");
      return;
    }

    const alivePlayers = players.filter(p => !p.dead);
    const aliveCount = alivePlayers.length;

    // 找出所有恶魔及存活状态
    const demons = players.filter(p => p.roleData && p.roleData.type === 'demon');
    const aliveDemons = demons.filter(p => !p.dead);
    const totalDemons = demons.length;

    // 检查特殊角色是否在场/死亡
    const isRoleInPlay = (roleKey) => players.some(p => p.role === roleKey);
    const isRoleDead = (roleKey) => players.some(p => p.role === roleKey && p.dead);

    const hasEvilTwin = isRoleInPlay('eviltwin');
    const isEvilTwinAlive = players.some(p => p.role === 'eviltwin' && !p.dead);
    const hasSaint = isRoleInPlay('saint');
    const isSaintDead = isRoleDead('saint');
    const hasGoblin = isRoleInPlay('goblin');
    const isGoblinDead = isRoleDead('goblin');
    const hasKlutz = isRoleInPlay('klutz');
    const isKlutzDead = isRoleDead('klutz');
    const hasHeretic = isRoleInPlay('heretic');
    const hasMayor = isRoleInPlay('mayor');
    const isMayorAlive = players.some(p => p.role === 'mayor' && !p.dead);

    // 判定逻辑
    let recommendation = "";
    let statusText = "";
    let statusColor = "";
    let rulesApplied = [];

    if (totalDemons === 0) {
      statusText = "⚖️ 游戏进行中 / 需手动裁决";
      statusColor = "hsl(var(--gold))";
      recommendation = "当前魔典中尚未分配任何恶魔角色。请在分配完恶魔并进行游戏后再进行判定。";
    } else {
      // 1. 检查邪恶阵营获胜条件：只剩 2 人存活且恶魔存活
      if (aliveCount === 2 && aliveDemons.length > 0) {
        statusText = "🔴 建议判定：邪恶阵营获胜！";
        statusColor = "#e74c3c";
        recommendation = "场上目前**仅剩 2 名存活玩家**，且其中**包含存活的恶魔**。邪恶阵营已锁定胜局！";
        rulesApplied.push("仅剩 2 名存活玩家且包含恶魔（恶魔拥有绝对平局支配权）。");
      }
      // 2. 检查善良阵营获胜条件：恶魔全部死亡，且双子不同时存活
      else if (aliveDemons.length === 0) {
        if (hasEvilTwin && isEvilTwinAlive && alivePlayers.some(p => p.roleData && ['townsfolk', 'outsider'].includes(p.roleData.type))) {
          statusText = "⚖️ 判定提示：恶魔虽死，但游戏继续";
          statusColor = "#f39c12";
          recommendation = "场上的**恶魔已全部死亡出局**。但是，由于场上**邪恶双子依然存活**，善良阵营暂时无法获胜！必须先投票处决双子中的邪恶方，或处决善良双子让邪恶直接获胜。";
          rulesApplied.push("恶魔死亡，但邪恶双子依然存活并限制了善良获胜。");
        } else {
          statusText = "🟢 建议判定：善良阵营获胜！";
          statusColor = "#2ecc71";
          recommendation = "场上的**恶魔已全部死亡出局**！且当前没有限制获胜的特殊爪牙（如邪恶双子）存活。善良阵营赢得胜利！";
          rulesApplied.push("所有恶魔玩家均已出局。");
        }
      }
      // 3. 默认进行中
      else {
        statusText = "⚖️ 建议判定：游戏仍在进行中";
        statusColor = "#3498db";
        recommendation = "场上还有存活的恶魔（共 " + aliveDemons.length + " 个），且存活总人数为 " + aliveCount + " 人。游戏正在激烈进行中！";
      }

      // 添加特殊角色提醒
      if (hasSaint && isSaintDead) {
        rulesApplied.push("⚠️ 检测到【圣徒】已死亡。如果是由于白天处决而死，则邪恶直接获胜！");
      }
      if (hasGoblin && isGoblinDead) {
        rulesApplied.push("⚠️ 检测到【小精灵】已死亡。如果是在白天被处决且宣称是小精灵，则邪恶直接获胜！");
      }
      if (hasKlutz && isKlutzDead) {
        rulesApplied.push("⚠️ 检测到【傻瓜】已死亡。如果他死时公开指向的存活玩家是邪恶阵营，则邪恶直接获胜！");
      }
      if (hasHeretic) {
        rulesApplied.push("🚨 检测到【异教徒】在场！所有胜负判定条件完全颠倒（即原本输的阵营获胜）！");
      }
      if (hasMayor && isMayorAlive && aliveCount === 3 && aliveDemons.length > 0) {
        rulesApplied.push("ℹ️ 提示：【市长】存活且当前存活人数为 3 人。如果今天白天没有发生处决，善良阵营将通过市长能力获胜。");
      }
    }

    let playersHtml = "";
    players.forEach(p => {
      const isEvil = p.roleData && ['minion', 'demon'].includes(p.roleData.type);
      const factionText = isEvil ? "🔴 邪恶" : "🟢 善良";
      const factionColor = isEvil ? "#e74c3c" : "#2ecc71";
      const statusText = p.dead ? "💀 已出局" : "🟢 存活";
      const statusColor = p.dead ? "#95a5a6" : "#2ecc71";
      const roleName = p.roleData ? p.roleData.name : "未知";
      const roleColor = this.getRoleTypeColor(p.roleData?.type);
      const roleBg = this.getRoleTypeBg(p.roleData?.type);

      playersHtml += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 0.8rem;">
          <div style="display: flex; align-items: center; gap: 8px; flex: 1.5;">
            <span style="color: #888; font-weight: bold; width: 22px;">#${p.index + 1}</span>
            <span style="color: #fff; font-weight: 500;">${p.name}</span>
          </div>
          <div style="flex: 1.5;">
            <span style="font-size: 0.75rem; color: ${roleColor}; background: ${roleBg}; padding: 2px 6px; border-radius: 4px; border: 1px solid ${roleColor}2b;">
              ${roleName}
            </span>
          </div>
          <div style="flex: 1; text-align: center; color: ${factionColor}; font-weight: bold;">
            ${factionText}
          </div>
          <div style="flex: 1; text-align: right; color: ${statusColor};">
            ${statusText}
          </div>
        </div>
      `;
    });

    const analysisEl = document.getElementById('game-over-analysis');
    let rulesHtml = "";
    if (rulesApplied.length > 0) {
      rulesHtml = `
        <div style="margin-top: 8px; font-size: 0.75rem; color: #fff;">
          <div style="font-weight: bold; margin-bottom: 3px; color: hsl(var(--gold));">判定依据：</div>
          <ul style="margin: 0; padding-left: 15px; display: flex; flex-direction: column; gap: 3px;">
            ${rulesApplied.map(r => `<li>${r}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    analysisEl.innerHTML = `
      <div style="border: 2px solid ${statusColor}; background: ${statusColor}14; padding: 12px; border-radius: 10px; margin-bottom: 10px; display: flex; flex-direction: column; gap: 6px;">
        <div style="font-size: 1.1rem; font-family: var(--font-title); font-weight: bold; color: ${statusColor}; text-shadow: 0 0 10px ${statusColor}4b;">
          ${statusText}
        </div>
        <div style="font-size: 0.8rem; color: #e1e1e1; line-height: 1.4;">
          ${recommendation}
        </div>
        ${rulesHtml}
      </div>
    `;

    document.getElementById('game-over-players-list').innerHTML = playersHtml;
    
    const modal = document.getElementById('game-over-modal');
    if (modal) modal.classList.add('active');
  }

  closeGameOverModal() {
    const modal = document.getElementById('game-over-modal');
    if (modal) modal.classList.remove('active');
  }

  declareWinner(faction) {
    const name = faction === 'good' ? '🟢 善良阵营获胜！恭喜正义战胜邪恶！' : '🔴 邪恶阵营获胜！黑暗笼罩了魔典！';
    this.addLog("宣告获胜", `说书人正式裁决并宣告：${name} 🏆`);
    alert(`🏆 宣告裁决成功！\n\n${name}\n\n该结算已成功归档入全局系统日志。`);
    this.closeGameOverModal();
  }

  openStorytellerLogModal() {
    this.renderLogs();
    const modal = document.getElementById('storyteller-log-modal');
    if (modal) modal.classList.add('active');
  }

  closeStorytellerLogModal() {
    const modal = document.getElementById('storyteller-log-modal');
    if (modal) modal.classList.remove('active');
  }
  
  openPlayerScriptReferenceModal() {
    this.openScriptReferenceModal(this.playerViewScript);
  }
}

// 挂载全局实例
window.app = new AppController();

// 网页 DOM 结构准备完毕后立即执行
document.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
