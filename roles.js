// 血染钟楼三大官方剧本角色数据库 (含自定义混编全局相对夜顺)
const ROLES_DATA = {
  // === 剧本 1: 灾祸滋生 (Trouble Brewing) ===
  tb: {
    name: "灾祸滋生",
    characters: {
      // 村民 (Townsfolk)
      washerwoman: {
        name: "洗衣妇",
        en: "Washerwoman",
        type: "townsfolk",
        ability: "你在首个夜晚开始时，会得知两名玩家中的一位是特定的村民角色。",
        wakeFirst: "展示【村民】标志，并指向两个人。其中一个是这个角色。",
        firstNight: 90
      },
      librarian: {
        name: "图书管理员",
        en: "Librarian",
        type: "townsfolk",
        ability: "你在首个夜晚开始时，会得知两名玩家中的一位是特定的外来者角色。（如果无外来者在场，你会得知这一信息。）",
        wakeFirst: "展示【外来者】标志，并指向两个人（其中一个是这个角色）或者给【0】的手势。",
        firstNight: 100
      },
      investigator: {
        name: "调查员",
        en: "Investigator",
        type: "townsfolk",
        ability: "你在首个夜晚开始时，会得知两名玩家中的一位是特定的爪牙角色。",
        wakeFirst: "展示【爪牙】标志，并指向两个人。其中一个是这个角色。",
        firstNight: 110
      },
      chef: {
        name: "厨师",
        en: "Chef",
        type: "townsfolk",
        ability: "你在首个夜晚开始时，会得知有多少对邪恶玩家彼此相邻。",
        wakeFirst: "用手指展示彼此相邻的邪恶玩家对数（0, 1, 2...）。",
        firstNight: 120
      },
      empath: {
        name: "共情者",
        en: "Empath",
        type: "townsfolk",
        ability: "每个夜晚，你会得知你相邻的两名存活玩家中有多少名是邪恶玩家。",
        wakeFirst: "用手指展示相邻存活邪恶玩家的数量（0, 1, 2）。",
        wakeOther: "用手指展示相邻存活邪恶玩家的数量（0, 1, 2）。",
        firstNight: 140,
        otherNight: 200
      },
      fortuneteller: {
        name: "占卜师",
        en: "Fortune Teller",
        type: "townsfolk",
        ability: "每个夜晚，选择两名玩家：你会得知其中是否存在恶魔。有一名善良玩家在你的感知中始终注册为恶魔（宿敌）。",
        wakeFirst: "指向两名玩家。如果其中有恶魔或你的【宿敌】目标，则说书人点头，否则摇头。",
        wakeOther: "指向两名玩家。如果其中有恶魔或你的【宿敌】目标，则说书人点头，否则摇头。",
        firstNight: 150,
        otherNight: 210
      },
      undertaker: {
        name: "掘墓人",
        en: "Undertaker",
        type: "townsfolk",
        ability: "每个夜晚*，你会得知今天因处决而死亡的玩家的角色。",
        wakeOther: "如果今天有人被处决并死亡，向掘墓人展示该玩家的角色标记，否则直接让他睡去。",
        otherNight: 180
      },
      monk: {
        name: "僧侣",
        en: "Monk",
        type: "townsfolk",
        ability: "每个夜晚*，选择一名其他玩家：该玩家在今天夜里免受恶魔袭击。",
        wakeOther: "选择一名其他玩家，为其戴上【被保护】标记。",
        otherNight: 50
      },
      ravenkeeper: {
        name: "守鸦人",
        en: "Ravenkeeper",
        type: "townsfolk",
        ability: "如果你在夜里被杀死，你会立即被唤醒并选择一名玩家：你会得知其角色身份。",
        wakeOther: "如果守鸦人今晚被恶魔杀死：唤醒他，让他指向一名玩家，向他展示该玩家的角色标记。",
        otherNight: 170
      },
      virgin: {
        name: "圣女",
        en: "Virgin",
        type: "townsfolk",
        ability: "当你被提名时，如果提名你的是一名村民，该玩家会立即被处决而你不会死。",
        abilityType: "passive"
      },
      slayer: {
        name: "杀手",
        en: "Slayer",
        type: "townsfolk",
        ability: "每个游戏一次，在白天，你可以公开选择一名玩家：如果该玩家是恶魔，他会死亡。",
        abilityType: "passive"
      },
      soldier: {
        name: "士兵",
        en: "Soldier",
        type: "townsfolk",
        ability: "你免受恶魔的夜间袭击。",
        abilityType: "passive"
      },
      mayor: {
        name: "市长",
        en: "Mayor",
        type: "townsfolk",
        ability: "如果没有人在白天被处决且只有三名玩家存活，善良阵营获胜。如果你在夜里死亡，可能会有另一名存活玩家代替你死亡。",
        abilityType: "passive"
      },
      // 外来者 (Outsiders)
      butler: {
        name: "管家",
        en: "Butler",
        type: "outsider",
        ability: "每个夜晚，选择一名其他玩家（主人）：明天在进行投票时，只有当该玩家举手投票时，你才能投票。",
        wakeFirst: "选择一名其他玩家作为明天投票的主人。",
        wakeOther: "选择一名其他玩家作为明天投票的主人。",
        firstNight: 160,
        otherNight: 310
      },
      drunk: {
        name: "酒鬼",
        en: "Drunk",
        type: "outsider",
        ability: "你不知道自己是醉汉。你以为自己是一个村民，但你的能力并不起作用。",
        abilityType: "passive"
      },
      recluse: {
        name: "隐士",
        en: "Recluse",
        type: "outsider",
        ability: "你可能会在被感知时注册为邪恶阵营、爪牙或恶魔，即使你已经死亡。",
        abilityType: "passive"
      },
      saint: {
        name: "圣徒",
        en: "Saint",
        type: "outsider",
        ability: "如果你因处决而死亡，善良阵营落败。",
        abilityType: "passive"
      },
      // 爪牙 (Minions)
      poisoner: {
        name: "下毒者",
        en: "Poisoner",
        type: "minion",
        ability: "每个夜晚，选择一名玩家：该玩家在今晚和明天白天中毒。",
        wakeFirst: "选择一名玩家下毒。标记该玩家为【中毒】。",
        wakeOther: "选择一名玩家下毒。标记该玩家为【中毒】（移除上一晚的中毒标记）。",
        firstNight: 30,
        otherNight: 20
      },
      spy: {
        name: "间谍",
        en: "Spy",
        type: "minion",
        ability: "每个夜晚，你可以查看魔典。你可能会在被感知时注册为善良阵营、村民或外来者，即使你已经死亡。",
        wakeFirst: "向间谍展示当前的魔典（所有身份和状态）。",
        wakeOther: "向间谍展示当前的魔典（所有身份和状态）。",
        firstNight: 230,
        otherNight: 330
      },
      scarletwoman: {
        name: "魅魔",
        en: "Scarlet Woman",
        type: "minion",
        ability: "如果存活玩家人数不小于五人且恶魔死亡，你变成恶魔。",
        wakeOther: "如果原恶魔今天死亡且存活玩家 >= 5 人：唤醒魅魔，向她展示恶魔标志，并告诉她【你是恶魔】。",
        otherNight: 140
      },
      baron: {
        name: "男爵",
        en: "Baron",
        type: "minion",
        ability: "本局游戏的外来者数量会修正 [+2 外来者] (即村民-2，外来者+2)。",
        abilityType: "passive"
      },
      // 恶魔 (Demons)
      imp: {
        name: "小恶魔",
        en: "Imp",
        type: "demon",
        ability: "每个夜晚*，选择一名玩家：该玩家死亡。如果你通过这种方式选择杀死自己，你死亡且一名存活爪牙会变成小恶魔。",
        wakeOther: "选择一名玩家杀害。如果选择杀死自己，指派一名存活的爪牙并向其展示小恶魔标志，宣布原小恶魔死亡但游戏继续。",
        otherNight: 130
      }
    }
  },

  // === 剧本 2: 黯月升起 (Bad Moon Rising) ===
  bmr: {
    name: "黯月升起",
    characters: {
      // 村民
      grandmother: {
        name: "祖母",
        en: "Grandmother",
        type: "townsfolk",
        ability: "你在首个夜晚开始时，会得知一名善良玩家的身份及其具体角色。如果恶魔杀死了他，你也会死亡。",
        wakeFirst: "展示他的【孙子】玩家及其对应的角色标记。",
        firstNight: 80
      },
      sailor: {
        name: "水手",
        en: "Sailor",
        type: "townsfolk",
        ability: "每个夜晚，选择一名存活玩家：你或他中的一人在明天黄昏前处于醉酒状态。你不会死亡。",
        wakeFirst: "选择一名存活玩家（可以是自己）。标记【水手醉酒】或【目标醉酒】。",
        wakeOther: "选择一名存活玩家（可以是自己）。更新【水手醉酒】或【目标醉酒】状态。",
        firstNight: 40,
        otherNight: 30
      },
      chambermaid: {
        name: "侍女",
        en: "Chambermaid",
        type: "townsfolk",
        ability: "每个夜晚，选择两名存活玩家（不包括你自己）：你会得知他们今天夜里是否因为自身角色能力而苏醒过。",
        wakeFirst: "选择两名存活玩家。用手指展示今天夜里他们中醒来行动过的人数（0, 1, 2）。",
        wakeOther: "选择两名存活玩家。用手指展示今天夜里他们中醒来行动过的人数（0, 1, 2）。",
        firstNight: 200,
        otherNight: 290
      },
      exorcist: {
        name: "驱魔人",
        en: "Exorcist",
        type: "townsfolk",
        ability: "每个夜晚*，选择一名玩家（不能与上一晚相同）：如果他为恶魔，他会得知你的身份且他今晚无法苏醒，也无法产生夜间击杀。",
        wakeOther: "选择一名玩家。如果是恶魔，把驱魔人翻回并唤醒恶魔，指向驱魔人展示【该玩家选择你了】；恶魔今晚不进行击杀步骤。",
        otherNight: 120
      },
      innkeeper: {
        name: "旅店老板",
        en: "Innkeeper",
        type: "townsfolk",
        ability: "每个夜晚*，选择两名玩家：他们在今晚无法死亡，但他们中的一人在明天黄昏前处于醉酒状态。",
        wakeOther: "选择两名玩家。标记他们为【保护安全】，并指派一人为【醉酒】状态。",
        otherNight: 40
      },
      gambler: {
        name: "赌徒",
        en: "Gambler",
        type: "townsfolk",
        ability: "每个夜晚*，选择一名玩家并猜测其具体的角色类型：如果你猜错了，你在今晚死亡。",
        wakeOther: "选择一名玩家，并用卡片猜测其角色。如果不正确，标记赌徒为【今晚死亡】。",
        otherNight: 260
      },
      gossip: {
        name: "造谣者",
        en: "Gossip",
        type: "townsfolk",
        ability: "每个白天，你可以公开说出一句陈述。今天夜里，如果该陈述为真，会有一名玩家死亡。",
        abilityType: "passive"
      },
      courtier: {
        name: "侍臣",
        en: "Courtier",
        type: "townsfolk",
        ability: "每个游戏一次，在夜晚，选择一个特定的角色：该角色在接下来三天三夜里处于醉酒状态。",
        wakeFirst: "你可以选择一个角色（例如下毒者），使其【醉酒 3 天】（也可以不选择）。",
        wakeOther: "如果尚未使用能力，你可以选择一个角色使其【醉酒 3 天】。",
        firstNight: 50,
        otherNight: 10
      },
      professor: {
        name: "教授",
        en: "Professor",
        type: "townsfolk",
        ability: "每个游戏一次，在夜晚*，选择一名已死亡的村民：该玩家复活并重新获得生命。",
        wakeOther: "如果能力尚未使用，你可以选择一名死亡村民复活。如果选择成功，该玩家复活并重新获得生命与选角标记。",
        otherNight: 270
      },
      minstrel: {
        name: "吟游诗人",
        en: "Minstrel",
        type: "townsfolk",
        ability: "如果一名爪牙在白天因处决而死亡，在今天夜里和明天白天，除了你之外的所有玩家均处于醉酒状态。",
        abilityType: "passive"
      },
      tealady: {
        name: "茶水女",
        en: "Tea Lady",
        type: "townsfolk",
        ability: "如果你相邻的两名存活玩家均是善良阵营的，他们便无法死亡。",
        abilityType: "passive"
      },
      pacifist: {
        name: "和平主义者",
        en: "Pacifist",
        type: "townsfolk",
        ability: "因处决而将被处死的善良玩家可能会被说书人赦免而不死。",
        abilityType: "passive"
      },
      fool: {
        name: "弄臣",
        en: "Fool",
        type: "townsfolk",
        ability: "当你首次死亡时，你不会死亡（保留你的存活标记，该免死特效仅触发一次）。",
        abilityType: "passive"
      },
      // 外来者
      tinker: {
        name: "修补匠",
        en: "Tinker",
        type: "outsider",
        ability: "你可能会在任何时间以任何方式被说书人宣布死亡。",
        abilityType: "passive"
      },
      moonchild: {
        name: "月之子",
        en: "Moonchild",
        type: "outsider",
        ability: "当你被处决并死亡时，在今天夜里，你必须公开指定一名存活玩家：如果该玩家是善良的，他会死亡。",
        abilityType: "passive"
      },
      goon: {
        name: "暴徒",
        en: "Goon",
        type: "outsider",
        ability: "每个夜晚，第一个使用自身能力选择你作为目标的玩家会处于醉酒状态直至黄昏。你变成与他相同的阵营。",
        abilityType: "passive"
      },
      lunatic: {
        name: "疯子",
        en: "Lunatic",
        type: "outsider",
        ability: "你不知道自己是疯子。你以为自己是恶魔，但你的选择不产生实际效果。在首个夜晚，你会得知谁是你的爪牙，但他们得知你是疯子。每个夜晚，你会被唤醒并选择击杀目标，且你会得知恶魔今晚的选择。",
        wakeFirst: "向其展示【恶魔】角色标记。指向几名玩家代表【爪牙】（真正的爪牙得知他是疯子）。",
        wakeOther: "唤醒疯子并让他选择击杀目标。在真实恶魔苏醒时，把疯子的选择告诉真实恶魔。",
        firstNight: 165,
        otherNight: 125
      },
      // 爪牙
      godfather: {
        name: "教父",
        en: "Godfather",
        type: "minion",
        ability: "在首个夜晚开始时，你会得知本局在场的外来者角色。每个夜晚*，如果今天有外来者因处决死亡，选择一名玩家：他死亡。[+1 外来者 或 -1 外来者]",
        wakeFirst: "向教父展示在场的外来者角色标记（如果有的话）。",
        wakeOther: "如果今天有外来者被处决死亡，唤醒教父选择一名玩家杀害。",
        firstNight: 170,
        otherNight: 110
      },
      devilsadvocate: {
        name: "魔鬼代言人",
        en: "Devil's Advocate",
        type: "minion",
        ability: "每个夜晚*，选择一名玩家（不能与上一晚相同）：该玩家在明天即使被处决也免于死亡。",
        wakeOther: "选择一名玩家。标记其为【免除处决死亡】。",
        otherNight: 60
      },
      subassassin: {
        name: "刺客",
        en: "Assassin",
        type: "minion",
        ability: "每个游戏一次，在夜晚*，选择一名玩家：他直接死亡，该死亡无法被任何保护能力免除。",
        wakeOther: "如果能力尚未使用，你可以指向一名玩家。标记该玩家为【被刺客暗杀且必死】。",
        otherNight: 110
      },
      mastermind: {
        name: "幕后主谋",
        en: "Mastermind",
        type: "minion",
        ability: "如果恶魔在白天因处决死亡，游戏不会结束，继续进行一天一夜。善良阵营必须在明天的白天处决你才能获胜。",
        abilityType: "passive"
      },
      // 恶魔
      zombuul: {
        name: "丧尸",
        en: "Zombuul",
        type: "demon",
        ability: "每个夜晚*，选择一名玩家：他死亡。你首次死亡时，你不会真正死去，但你在魔典和大家眼中注册为已死亡（可以继续投票但没有能力），下一次你被处决或在夜间被击杀时你才真正出局。",
        wakeOther: "选择一名玩家杀害（如果上一天没有活人死亡，才可以杀害）。",
        otherNight: 130
      },
      pukka: {
        name: "纯血恶魔",
        en: "Pukka",
        type: "demon",
        ability: "每个夜晚，选择一名玩家：该玩家严重中毒。上一晚被你下毒的玩家在今天夜里被毒死。",
        wakeFirst: "选择一名玩家下毒。标记该玩家为【纯血恶魔下毒】。",
        wakeOther: "上一晚被纯血恶魔下毒的目标死亡。再次选择一名玩家下毒（标记为纯血恶魔下毒）。",
        firstNight: 180,
        otherNight: 130
      },
      shabaloth: {
        name: "暴食者",
        en: "Shabaloth",
        type: "demon",
        ability: "每个夜晚*，选择至多两名玩家：他们死亡。在每个夜晚，可能会有被你吞下的一名已死亡玩家在说书人的裁决下重新复活。",
        wakeOther: "选择两名玩家杀害。说书人可以选择是否复活上一晚被吐出来的死亡玩家。",
        otherNight: 130
      },
      po: {
        name: "魄",
        en: "Po",
        type: "demon",
        ability: "每个夜晚*，选择一名玩家：他死亡。如果你上一晚没有选择杀死任何人，今晚你可以选择杀死至多三名玩家。",
        wakeOther: "选择至多三名玩家（如果上一晚没有杀人）或选择一名玩家杀害。",
        otherNight: 130
      }
    }
  },

  // === 剧本 3: 教派与紫罗兰 (Sects & Violets) ===
  snv: {
    name: "教派与紫罗兰",
    characters: {
      // 村民
      clockmaker: {
        name: "钟表匠",
        en: "Clockmaker",
        type: "townsfolk",
        ability: "你在首个夜晚开始时，会得知距离恶魔最近的爪牙玩家有几个身位（座位间隔）。",
        wakeFirst: "用手指展示恶魔到最近爪牙的顺时针/逆时针的最短身位距离。",
        firstNight: 130
      },
      dreamer: {
        name: "筑梦师",
        en: "Dreamer",
        type: "townsfolk",
        ability: "每个夜晚，选择一名存活玩家（不能是你自己或旅行者）：你会得知一个善良角色和一个邪恶角色，其中之一是他的真实角色。",
        wakeFirst: "选择一名存活玩家。向其展示两个角色标记（一个善良，一个邪恶），其中一个是正确的。",
        wakeOther: "选择一名存活玩家。向其展示两个角色标记（一个善良，一个邪恶），其中一个是正确的。",
        firstNight: 190,
        otherNight: 250
      },
      snakecharmer: {
        name: "蛇魅",
        en: "Snake Charmer",
        type: "townsfolk",
        ability: "每个夜晚，选择一名存活玩家：如果是恶魔，你与他交换角色与阵营，并且他（现在的蛇魅）陷入严重中毒状态。",
        wakeFirst: "选择一名存活玩家。如果是恶魔，互换两人的角色卡与阵营，并标记原恶魔为【严重中毒】；把新恶魔弄醒展示恶魔卡片。",
        wakeOther: "选择一名存活玩家。如果是恶魔，互换两人的角色卡与阵营，并标记原恶魔为【严重中毒】；把新恶魔弄醒展示恶魔卡片。",
        firstNight: 50,
        otherNight: 30
      },
      mathematician: {
        name: "数学家",
        en: "Mathematician",
        type: "townsfolk",
        ability: "每个夜晚，你会得知今天白天起（包含今天夜里），有多少名玩家的角色能力因为其他玩家能力干扰而产生了异常（即失效/给假信息/醉酒/中毒等）。",
        wakeFirst: "用手指展示全场今天异常运作的能力总个数（0, 1, 2...）。",
        wakeOther: "用手指展示全场今天异常运作的能力总个数（0, 1, 2...）。",
        firstNight: 210,
        otherNight: 280
      },
      flowergirl: {
        name: "卖花女孩",
        en: "Flowergirl",
        type: "townsfolk",
        ability: "每个夜晚*，你会得知今天处决处死的投票环节中，恶魔是否进行过举手投票动作。",
        wakeOther: "说书人点头表示【是，恶魔今天投票了】，或摇头表示【否】。",
        otherNight: 230
      },
      towncrier: {
        name: "镇民大声公",
        en: "Town Crier",
        type: "townsfolk",
        ability: "每个夜晚*，你会得知今天白天的提名人选环节中，是否有爪牙进行过提名发言动作。",
        wakeOther: "说书人点头表示【是，爪牙今天发起了提名】，或摇头表示【否】。",
        otherNight: 240
      },
      oracle: {
        name: "神谕者",
        en: "Oracle",
        type: "townsfolk",
        ability: "每个夜晚*，你会得知当前已出局死亡的玩家群体中，总共有多少名邪恶阵营玩家。",
        wakeOther: "用手指手势展示当前死亡的邪恶玩家总数（0, 1, 2...）。",
        otherNight: 220
      },
      savant: {
        name: "博学者",
        en: "Savant",
        type: "townsfolk",
        ability: "每个白天，你可以单独前往私聊找说书人交谈：说书人必须给你两条关于局势的私密情报，其中一条必为真，另一条必为假。",
        abilityType: "passive"
      },
      seamstress: {
        name: "裁缝",
        en: "Seamstress",
        type: "townsfolk",
        ability: "每个游戏一次，在夜晚，选择两名玩家（不包括你自己）：你会得知他们两人的阵营是否相同。",
        wakeFirst: "你可以指向两名玩家。如果是相同阵营说书人点头，不同则摇头。标记能力【已使用】。",
        wakeOther: "如果能力尚未使用，你可以指向两名玩家. 相同阵营说书人点头，不同则摇头。标记能力【已使用】。",
        firstNight: 220,
        otherNight: 320
      },
      philosopher: {
        name: "哲学家",
        en: "Philosopher",
        type: "townsfolk",
        ability: "每个游戏一次，在夜晚，选择一个在场的善良角色：你夺取并获得该角色的全部能力，若该角色已被玩家选定，该玩家陷入醉酒状态。",
        wakeFirst: "你可以选择获得一个善良角色的能力。如果是，进行标记，如果该角色在场，将其标记为【因哲学家醉酒】。",
        wakeOther: "如果能力尚未使用，你可以选择获得一个善良角色的能力并标记【哲学家醉酒】。",
        firstNight: 20,
        otherNight: 10
      },
      artist: {
        name: "艺术家",
        en: "Artist",
        type: "townsfolk",
        ability: "每个游戏一次，在白天，你可以单独向说书人提出任何可以回答【是】、【否】或【不知道】的问题，并获得真实回答。",
        abilityType: "passive"
      },
      juggler: {
        name: "杂耍艺人",
        en: "Juggler",
        type: "townsfolk",
        ability: "在你首个白天，你可以公开猜测至多五名玩家的具体角色身份。今天夜里，你会得知你猜对了几个人。",
        wakeOther: "如果杂耍艺人今天白天公开猜测了身份：唤醒他，用手指展示他今天猜对角色的数量（0, 1...5）。",
        otherNight: 300
      },
      sage: {
        name: "贤者",
        en: "Sage",
        type: "townsfolk",
        ability: "如果你在夜里被恶魔杀害，你会被唤醒并得知有两名玩家中的一位是杀死你的恶魔。",
        wakeOther: "如果贤者今晚被恶魔杀害：唤醒他，向其展示两名玩家（其中一个是恶魔）。",
        otherNight: 170
      },
      // 外来者
      mutant: {
        name: "畸形人",
        en: "Mutant",
        type: "outsider",
        ability: "如果你mad地（疯狂地）坚称自己是外来者，你可能会被说书人当场处决死亡。",
        abilityType: "passive"
      },
      sweetheart: {
        name: "心碎者",
        en: "Sweetheart",
        type: "outsider",
        ability: "当你死亡时，说书人会选择一名玩家：该玩家从现在起永久处于醉酒状态。",
        wakeOther: "如果心碎者今天死亡：说书人秘密挑选一名玩家，打上永久【醉酒】标记。",
        otherNight: 160
      },
      barber: {
        name: "理发师",
        en: "Barber",
        type: "outsider",
        ability: "当你死亡时，今天夜里，说书人可以选择让两个存活玩家秘密交换他们的角色卡片（恶魔交换则需要重新告知邪恶阵营）。",
        wakeOther: "如果理发师今天死亡：唤醒恶魔让其决定是否让两个存活玩家秘密交换角色；或者由说书人代为选择。",
        otherNight: 150
      },
      klutz: {
        name: "笨手笨脚",
        en: "Klutz",
        type: "outsider",
        ability: "当你得知你死亡时，你必须公开指向一名存活玩家：如果此人是邪恶的，善良阵营直接输掉本局游戏。",
        abilityType: "passive"
      },
      // 爪牙
      eviltwin: {
        name: "邪恶双子",
        en: "Evil Twin",
        type: "minion",
        ability: "你和一名特定的善良玩家彼此得知。只要你们两人都存活，善良阵营便无法通过处死恶魔获胜，必须处决双子中的善良方，否则恶魔死后依然是邪恶获胜。",
        wakeFirst: "展示善良双子和邪恶双子互相确认身份，并展示标志告诉他们【这就是你的双子对头】。",
        firstNight: 10
      },
      witch: {
        name: "女巫",
        en: "Witch",
        type: "minion",
        ability: "每个夜晚，选择一名玩家：如果该玩家在明天发起了【提名】说话，他会立即暴毙死亡。",
        wakeFirst: "选择一名玩家施加诅咒。标记【被女巫诅咒】。",
        wakeOther: "选择一名玩家施加诅咒。标记【被女巫诅咒】（移除之前的诅咒）。",
        firstNight: 60,
        otherNight: 70
      },
      cerenovus: {
        name: "洗脑师",
        en: "Cerenovus",
        type: "minion",
        ability: "每个夜晚，选择一名玩家和一个本场剧本的角色：该玩家在明天白天必须mad地（疯狂地）假装自己是该角色，否则可能会被说书人处决死亡。",
        wakeFirst: "选择一名玩家，并展示一个角色标记告诉说书人。标记其为【洗脑状态】并备注猜测假角色。",
        wakeOther: "选择一名玩家，并展示一个角色标记。更新【洗脑状态】和假角色标记。",
        firstNight: 70,
        otherNight: 80
      },
      pithag: {
        name: "深渊巫婆",
        en: "Pit-Hag",
        type: "minion",
        ability: "每个夜晚*，选择一名玩家和一个角色：该玩家转换变成该角色。如果本场原本不存在该角色且变成了恶魔，今晚恶魔无法产生击杀且由说书人指派新的恶魔类型。",
        wakeOther: "选择一名玩家并展示一个角色。将该玩家的角色在魔典中改变，并给予相应的标记转换提示。",
        otherNight: 90
      },
      // 恶魔
      fanggu: {
        name: "方辜",
        en: "Fang Gu",
        type: "demon",
        ability: "每个夜晚*，选择一名玩家：他死亡。你首次选择杀害一名善良外来者时，他变成邪恶阵营的方辜恶魔，而你（原方辜）死亡。",
        wakeOther: "选择一名玩家杀害。如果是善良外来者且首次触发，将其角色转化为【邪恶方辜】，原方辜死亡宣告，新方辜在夜间醒来并被告知恶魔身份。",
        otherNight: 130
      },
      vigormortis: {
        name: "枯骨魔",
        en: "Vigormortis",
        type: "demon",
        ability: "每个夜晚*，选择一名玩家：他死亡。你通过恶魔袭击杀死的一名爪牙邻座虽然注册为已死亡，但可以保留并继续行使他的爪牙夜间苏醒能力，但他在夜里在你的魔典中被视为中毒运作。",
        wakeOther: "选择一名玩家杀害。如果选择杀死存活爪牙，该爪牙表面死亡但可以继续苏醒且能力【受限/中毒】。",
        otherNight: 130
      },
      nodashii: {
        name: "无面魔",
        en: "No Dashii",
        type: "demon",
        ability: "每个夜晚*，选择一名玩家：他死亡。你相邻的两名存活村民在魔典里处于永久中毒状态（即便他们没有意识到，他们的信息为假）。",
        wakeOther: "选择一名玩家杀害。动态更新无面魔左右两侧最近的存活村民的【中毒】状态。",
        otherNight: 130
      },
      vortox: {
        name: "漩涡魔",
        en: "Vortox",
        type: "demon",
        ability: "每个夜晚*，选择一名玩家：他死亡。所有善良玩家的感知和获得情报能力产生的信息必须为【假】。在每个白天，如果没有任何玩家被成功处决，邪恶阵营直接赢得胜利。",
        wakeOther: "选择一名玩家杀害。",
        otherNight: 130
      }
    }
  },

  // === 剧本 4: 胜负难料 (迷你版 - Teensyville) ===
  custom_teensy: {
    name: "胜负难料 (迷你版)",
    characters: {
      // 村民 (Townsfolk)
      farmer: {
        name: "农夫",
        en: "Farmer",
        type: "townsfolk",
        ability: "如果你在夜晚死亡，一名存活玩家会变成【农夫】（即便你没有能力且已死）。",
        wakeOther: "如果今天夜晚有农夫被恶魔杀害：唤醒一名存活的玩家，向其出示农夫标志，并告诉他【你是农夫】。",
        otherNight: 168
      },
      snakecharmer: {
        name: "舞蛇人 (蛇魅)",
        en: "Snake Charmer",
        type: "townsfolk",
        ability: "每个夜晚，选择一名存活玩家：如果是恶魔，你与他交换角色与阵营，并且他（现在的蛇魅）陷入严重中毒状态。",
        wakeFirst: "选择一名存活玩家。如果是恶魔，互换两人的角色卡与阵营，并标记原恶魔为【严重中毒】；把新恶魔弄醒展示恶魔卡片。",
        wakeOther: "选择一名存活玩家。如果是恶魔，互换两人的角色卡与阵营，并标记原恶魔为【严重中毒】；把新恶魔弄醒展示恶魔卡片。",
        firstNight: 50,
        otherNight: 30
      },
      artist: {
        name: "艺术家",
        en: "Artist",
        type: "townsfolk",
        ability: "每个游戏一次，在白天，你可以单独向说书人提出任何可以回答【是】、【否】或【不知道】的问题，并获得真实回答。",
        abilityType: "passive"
      },
      huntsman: {
        name: "猎手 (Huntsman)",
        en: "Huntsman",
        type: "townsfolk",
        ability: "每个游戏一次，在夜晚，选择一名玩家：如果他是女爵，他变成存活的村民（即使你已经死亡/无能力）。（由于本局无女爵，该技能通常无实际效果，但可作为伪装）",
        wakeOther: "您可以选择一名玩家寻找女爵（本局无女爵，将无事发生）。标记能力【已使用】。",
        otherNight: 112
      },
      cannibal: {
        name: "食人族",
        en: "Cannibal",
        type: "townsfolk",
        ability: "如果你邻座的玩家死亡，你获得其能力。如果他是邪恶的，你处于中毒状态。",
        abilityType: "passive"
      },
      ravenkeeper: {
        name: "守鸦人",
        en: "Ravenkeeper",
        type: "townsfolk",
        ability: "如果你在夜里被杀死，你会立即被唤醒并选择一名玩家：你会得知其角色身份。",
        wakeOther: "如果守鸦人今晚被恶魔杀死：唤醒他，让他指向一名玩家，向他展示该玩家的角色标记。",
        otherNight: 170
      },
      // 外来者 (Outsiders)
      heretic: {
        name: "异端分子",
        en: "Heretic",
        type: "outsider",
        ability: "如果异端分子在场，邪恶阵营获胜则善良获胜，反之亦然。",
        abilityType: "passive"
      },
      puzzlemaster: {
        name: "解谜大师",
        en: "Puzzlemaster",
        type: "outsider",
        ability: "有一名善良玩家处于醉酒状态（即便他不知道）。你开始时会得知这一信息。每个游戏一次，在白天，你可以公开猜测谁是恶魔：如果猜对，你会得知谁是醉酒的玩家；如果猜错，无事发生。",
        wakeFirst: "向解谜大师展示因为他的技能而处于【醉酒】状态的玩家（首夜说书人选定）。",
        firstNight: 105
      },
      sweetheart: {
        name: "心上人 (心碎者)",
        en: "Sweetheart",
        type: "outsider",
        ability: "当你死亡时，说书人会选择一名玩家：该玩家从现在起永久处于醉酒状态。",
        wakeOther: "如果心上人今天死亡：说书人秘密挑选一名玩家，打上永久【醉酒】标记。",
        otherNight: 160
      },
      lunatic: {
        name: "疯子",
        en: "Lunatic",
        type: "outsider",
        ability: "你不知道自己是疯子。你以为自己是恶魔，但你的选择不产生实际效果。在首个夜晚，你会得知谁是你的爪牙，但他们得知你是疯子。每个夜晚，你会被唤醒并选择击杀目标，且你会得知恶魔今晚的选择。",
        wakeFirst: "向其展示【恶魔】角色标记。指向几名玩家代表【爪牙】（真正的爪牙得知他是疯子）。",
        wakeOther: "唤醒疯子并让他选择击杀目标。在真实恶魔苏醒时，把疯子的选择告诉真实恶魔。",
        firstNight: 165,
        otherNight: 125
      },
      // 爪牙 (Minions)
      marionette: {
        name: "提线木偶",
        en: "Marionette",
        type: "minion",
        ability: "你不知道自己是提线木偶。你以为自己是善良角色，但你其实是爪牙。你必须与恶魔相邻存活。你免疫恶魔的夜间袭击。",
        abilityType: "passive"
      },
      // 恶魔 (Demons)
      fanggu: {
        name: "方古 (方辜)",
        en: "Fang Gu",
        type: "demon",
        ability: "每个夜晚*，选择一名玩家：他死亡。你首次选择杀害一名善良外来者时，他变成邪恶阵营的方古恶魔，而你（原方古）死亡。[+1 外来者]",
        wakeOther: "选择一名玩家杀害。如果是善良外来者且首次触发，将其角色转化为【邪恶方古】，原方古死亡宣告，新方古在夜间醒来并被告知恶魔身份。",
        otherNight: 135
      }
    }
  }
};

// 全局官方统一相对夜顺表（Universal Master Night Order）
// 本列表决定了在混编（Custom Mix）模式下，任何勾选角色之间的相对执行顺位！
const MASTER_NIGHT_ORDER = {
  // 第一晚相对顺序 (数值越小越先唤醒)
  firstNight: {
    // 爪牙互认 / 恶魔互认 永远第一
    "minion-info": 1,
    "demon-info": 2,
    
    // SNV 双子
    eviltwin: 10,
    
    // 抢身份的哲学家
    philosopher: 20,
    
    // 中毒下毒
    poisoner: 30,
    
    // 水手保命
    sailor: 40,
    
    // 蛇魅吸魔
    snakecharmer: 50,
    
    // 挂诅咒和洗脑
    witch: 60,
    cerenovus: 70,
    
    // 祖母确认孙子
    grandmother: 80,
    
    // 信息收集
    washerwoman: 90,
    librarian: 100,
    puzzlemaster: 105,
    investigator: 110,
    chef: 120,
    clockmaker: 130,
    empath: 140,
    fortuneteller: 150,
    butler: 160,
    lunatic: 165, // Add Lunatic (疯子) here
    godfather: 170,
    pukka: 180,
    dreamer: 190,
    chambermaid: 200,
    mathematician: 210,
    seamstress: 220,
    
    // 间谍
    spy: 230
  },

  // 其它夜晚相对顺序 (数值越小越先唤醒)
  otherNight: {
    // 哲学家最先，可能复制今晚的保护/击杀角色
    philosopher: 10,
    courtier: 15,
    
    // 毒与醉酒
    poisoner: 20,
    sailor: 30,
    innkeeper: 40,
    monk: 50,
    devilsadvocate: 60,
    
    // 诅咒与洗脑
    witch: 70,
    cerenovus: 80,
    
    // 巫婆变身
    pithag: 90,
    
    // 物理击杀/刺客/教父/驱魔
    subassassin: 110,
    huntsman: 112,
    godfather: 115,
    exorcist: 120,
    lunatic: 125, // Add Lunatic (疯子) here
    
    // 恶魔行动阶段 (Imp, Zombuul, Pukka, Shabaloth, Po, Fang Gu, Vigormortis, No Dashii, Vortox)
    // 它们共享同一个相对时间段
    imp: 130,
    zombuul: 131,
    pukka: 132,
    shabaloth: 133,
    po: 134,
    fanggu: 135,
    vigormortis: 136,
    nodashii: 137,
    vortox: 138,
    
    // 晋升检查 (红唇女郎)
    scarletwoman: 140,
    
    // 被动死亡与效果结算 (理发师、心碎者、守鸦人、贤者)
    barber: 150,
    sweetheart: 160,
    farmer: 168,
    ravenkeeper: 170,
    sage: 175,
    
    // 其它获取信息村民
    undertaker: 180,
    empath: 200,
    fortuneteller: 210,
    oracle: 220,
    flowergirl: 230,
    towncrier: 240,
    dreamer: 250,
    gambler: 260,
    professor: 270,
    mathematician: 280,
    juggler: 300,
    butler: 310,
    seamstress: 320,
    spy: 330
  }
};

// 导出模块 (支持浏览器 global 加载 and node 导入)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ROLES_DATA, MASTER_NIGHT_ORDER };
} else {
  window.ROLES_DATA = ROLES_DATA;
  window.MASTER_NIGHT_ORDER = MASTER_NIGHT_ORDER;
}
