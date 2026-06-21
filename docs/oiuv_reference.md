# oiuv_mud (炎黄MUD) 原版参考文档

> **用途**: mud_game 项目开发参考，避免重复分析原版代码。
> **源路径**: `~/projects/oiuv_mud`  
> **统计**: 10,760 个 .c 文件, 138 个 .h 文件, 613,629 行代码
> **引擎**: LPMud / FluffOS (C 语言方言)
> **生成日期**: 2026-06-20

---

## 1. 项目结构总览

```
oiuv_mud/
├── adm/daemons/         # 守护进程 (combatd, questd, auctiond, chard...)
├── adm/single/master/   # 单例 master 对象
├── kungfu/class/        # 39 门派定义
├── kungfu/skill/        # 719 武功技能 (.c 文件)
├── kungfu/condition/    # 70 状态效果
├── clone/               # 可克隆对象库
│   ├── fam/pill/        # 丹药 (人参/灵芝/雪莲/菩提...)
│   ├── fam/etc/         # 特殊道具 (宝石/护身符/雷神珠...)
│   ├── weapon/          # 武器 (剑/刀/鞭/弓/暗器...)
│   ├── poison/          # 毒药
│   ├── medicine/        # 药品
│   ├── shop/            # 15 城市商店
│   ├── questob/         # 任务物品 (48 种)
│   ├── book/            # 书籍
│   ├── cloth/           # 服装
│   ├── food/            # 食物
│   ├── money/           # 钱币
│   ├── npc/             # 通用 NPC
│   └── ultra/           # 转世道具
├── cmds/                # 玩家命令
│   ├── usr/             # 普通玩家命令
│   ├── skill/           # 技能命令
│   ├── chat/            # 聊天命令
│   └── adm/             # 管理员命令
├── world/area/          # 世界地图区域
├── inherit/             # 继承模板
├── include/             # 头文件
├── data/                # 运行时数据
├── docs/                # 文档
└── ai_service/          # AI 服务
```

---

## 2. 全部 39 门派列表

| 序号 | 目录名 | 中文名 | 特色 |
|------|--------|--------|------|
| 1 | shaolin | 少林派 | 佛法武功，七十二绝技 |
| 2 | wudang | 武当派 | 太极正宗，以柔克刚 |
| 3 | emei | 峨眉派 | 女子剑法，倚天剑 |
| 4 | gaibang | 丐帮 | 打狗棒、降龙十八掌 |
| 5 | gumu | 古墓派 | 玉女心经，黯然销魂 |
| 6 | huashan | 华山派 | 独孤九剑，君子剑 |
| 7 | kunlun | 昆仑派 | 松风剑法，飘逸绝尘 |
| 8 | mingjiao | 明教 | 乾坤大挪移，圣火令 |
| 9 | quanzhen | 全真教 | 道家正宗，剑法道术 |
| 10 | xingxiu | 星宿派 | 用毒，化功大法 |
| 11 | xiaoyao | 逍遥派 | 凌波微步，北冥神功 |
| 12 | taohua | 桃花岛 | 弹指神通，奇门五行 |
| 13 | lingjiu | 灵鹫宫 | 生死符，天山折梅手 |
| 14 | shenlong | 神龙教 | 神龙心法 |
| 15 | riyue | 日月神教 | 吸星大法，葵花宝典 |
| 16 | xueshan | 雪山派 | 雪山剑法 |
| 17 | tiezhang | 铁掌帮 | 铁掌功夫 |
| 18 | tangmen | 唐门 | 暗器毒药 |
| 19 | murong | 慕容世家 | 斗转星移 |
| 20 | duan | 段氏皇族 | 一阳指，六脉神剑 |
| 21 | henshan | 衡山派 | 剑法灵巧多变 |
| 22 | honghua | 红花会 | 反清复明 |
| 23 | hu | 胡家 | 胡家刀法 |
| 24 | jueqing | 绝情谷 | 情花毒 |
| 25 | lingxiao | 凌霄城 | 雪山之巅 |
| 26 | meizhuang | 梅庄 | 琴棋书画 |
| 27 | miao | 苗家 | 苗家剑法 |
| 28 | ouyang | 欧阳世家 | 蛤蟆功 |
| 29 | shang | 商家堡 | 八卦刀法 |
| 30 | songshan | 嵩山派 | 五岳之首 |
| 31 | tianlongsi | 天龙寺 | 枯荣禅功 |
| 32 | ultra | 绝世高手 | 转世专属 |
| 33 | wudu | 五毒教 | 蛊术毒功 |
| 34 | xiakedao | 侠客岛 | 太玄经 |
| 35 | xuanming | 玄冥谷 | 玄冥神掌 |
| 36 | xuedao | 血刀门 | 血刀大法 |
| 37 | yunlong | 云龙门 | 云龙三折 |
| 38 | zhenyuan | 震远镖局 | 拳法刚猛 |
| 39 | hell | 修罗地狱 | 魔道汇聚 |

---

## 3. 战斗系统 (combatd.c)

### 核心公式
```
伤害基数 = 武功伤害 + 臂力加成 + 武器伤害
最终伤害 = 基数 × 随机系数(0.8~1.2) × 暴击系数
暴击: 10%概率 × 1.8倍
```

### 防御机制（4层判定）
1. **招架 (parry)**: `chance = parryLv / (parryLv + attackerDex*2)`
2. **躲避 (dodge)**: `chance = dodgeLv / (dodgeLv + attackerDex*3 + 5)`
3. **内力护体 (force)**: `absorb = min(damage, forceLv*2 + mp*0.1)`，消耗 mp
4. **HP 损伤**: 剩余伤害扣 HP

### 战斗特殊机制
- 自动回合制，速度由 `dex + dodgeLevel` 决定
- 多人混战支持
- PvP 有杀人数统计和善恶值(shen)系统
- 打晕 vs 杀死区分（DPS vs PKS 统计）

---

## 4. 武功系统 (719 skills)

### 武功类别
| 类别 | 数量估计 | 示例 |
|------|----------|------|
| 基本拳脚 | — | cuff |
| 基本剑法 | — | sword |
| 基本刀法 | — | blade |
| 基本杖法 | — | staff |
| 基本暗器 | — | throwing |
| 基本鞭法 | — | whip |
| 基本轻功 | — | dodge |
| 基本内功 | — | force |
| 独门武功 | ~700 | 太极拳/六脉神剑/乾坤大挪移... |

### 武功属性（每项 .c 文件定义）
- `damageBase` + `damageScale × level` = 伤害
- 前置要求: `requireSkill` + `requireLevel`
- 门派归属: `schoolId`
- 绝招: 每武功 2-5 个 perform 招式
- 内功运用: exert heal/powerup/roar 等

---

## 5. 状态系统 (70 conditions)

### 状态分类
| 类别 | 数量 | 示例 |
|------|------|------|
| 中毒类 | 20+ | poison, ss_poison, corpse_poison, sanxiao_poison... |
| 冰寒类 | 5 | ice_poison, freezing, iceshock, hanbingdu... |
| 灼烧类 | 3 | burning, fire_poison, zhurong_jian |
| 疾病类 | 4 | ill_fashao, ill_kesou, ill_shanghan, ill_zhongshu |
| 内伤类 | 10+ | nishui, shenzhao, cuixin_zhang, damo_shangshen... |
| 药物类 | 10+ | bonze_drug, cd_drug, slumber_drug, exert_drug... |
| 特殊类 | 8 | drunk, killer, die_guard, bandaged, hunger... |
| 刑罚类 | 3 | bonze_jail, vote_clear, vote_suspension |

### 状态机制
- 每个 condition 独立 .c 文件定义 apply/remove 效果
- 持续扣血/扣内力/降低属性
- 可用药物清除（如 `jiedu-wan` 解毒丸）
- hook 在 combat_beat 中触发

---

## 6. 物品体系

### 丹药 (clone/fam/pill/)
| 品级 | 物品 |
|------|------|
| Lv1 | 人参1/灵芝1/雪莲1/菩提1/舍利1 |
| Lv2 | 人参2/灵芝2/雪莲2/菩提2/舍利2 |
| Lv3 | 人参3/灵芝3/雪莲3/菩提3/舍利3 |
| Lv4 | 人参4/灵芝4/雪莲4/菩提4/舍利4 |
| 特殊 | 内力丹/灵慧丹/食物丹/血脉丹 |

### 属性丹药 (clone/fam/etc/)
力量丹(str)/智力丹(int)/根骨丹(con)/身法丹(dex)/容貌丹(per)
用途：永久提升对应属性 1 点

### 武器 (clone/weapon/)
剑/刀/鞭/杖/弓/暗器/弩，各有普通和极品版本

### 毒药 (clone/poison/)
断肠散/鹤顶红/孔雀胆/五圣散/赤蝎粉/腐肉膏

### 任务物品 (clone/questob/)
金/银/玉如意/玉佛/锦盒/龙须/金匮...

---

## 7. 商店系统 (15 城市)

| 城市 | 文件名 |
|------|--------|
| 北京 | beijing_shop.c |
| 长安 | changan_shop.c |
| 成都 | chengdu_shop.c |
| 大理 | dali_shop.c |
| 佛山 | foshan_shop.c |
| 福州 | fuzhou_shop.c |
| 杭州 | hangzhou_shop.c |
| 衡阳 | hengyang_shop.c |
| 荆州 | jingzhou_shop.c |
| 开封 | kaifeng_shop.c |
| 洛阳 | luoyang_shop.c |
| 苏州 | suzhou_shop.c |
| 襄阳 | xiangyang_shop.c |
| 扬州 | yangzhou_shop.c |
| 中州 | zhongzhou_shop.c |

继承 `inherit/room/shop.c`，有伙计(huoji) NPC，可开关店铺。

---

## 8. 任务系统 (questd.c)

### 任务类型
1. **送信 (letter)**: 新手任务，经验 <10万时分配
2. **杀人 (kill)**: 经验 ≥10万时分配，需击杀指定NPC
3. **寻物 (find)**: 找到指定物品

### 任务流程
```
ask quest NPC → questd 分配任务 → quest 查看 → complete/quest NPC 交任务 → 奖励
```

### 奖励体系
| 次数 | 奖励等级 |
|------|----------|
| 基础 | exp + pot + 威望 + 积分 |
| 30次 | 二级丹药奖励 |
| 50次 | 三级丹药 |
| 100次 | 四级稀有丹药 |
| 200-800次 | 逐级提升至顶级逆天丹药 |

### 转世玩家特权
- 转世次数 = 奖励加成
- 概率遇到超级 NPC 任务
- 特殊任务难度

---

## 9. 转世系统 (Reborn)

转世(turn)是原版核心高级系统，需要：
- `clone/ultra/xuanhuang.c` 玄黄丹
- 多次转世叠加属性和奖励加成
- 转世后的 super NPC 挑战

---

## 10. 属性系统

| 属性 | 英文 | 用途 |
|------|------|------|
| 臂力 | str | 攻击力, HP上限, 负重 |
| 悟性 | int | 学习效率, MP上限 |
| 根骨 | con | HP上限, 防御, 内力护体 |
| 身法 | dex | 闪避, 战斗速度, 招架 |
| 容貌 | per | NPC对话, 某些武功要求 |
| 福缘 | kar | 随机事件运气 |
| 内力 | neili | 特殊内功值（与 MP 独立） |
| 精力 | jingli | 精力值 |

---

## 11. 其他系统

| 系统 | 位置 | 说明 |
|------|------|------|
| 拍卖 | auctiond.c | 玩家间拍卖物品 |
| 音乐 | music | BGM/环境音 |
| 婚姻 | engage/divorce | 结为夫妻/离婚/生育 |
| 帮会 | league | 玩家自建门派/帮会 |
| 钓鱼 | fish/ | 休闲玩法 |
| 赌博 | game/ | 掷骰子/猜拳 |
| 棋类 | game/ | 围棋/中国象棋 |
| 纹身 | tattoo/ | 永久属性加成 |
| 坐骑 | horse/ | 马匹加速 |
| 毒虫 | worm/ | 蛊虫培养 |
| 挖矿 | quarry/ | 采集材料 |
| 建筑 | buildingd.c | 玩家建造房屋 |
| 书籍 | book/ | 可读书籍涨经验 |

---

## 12. 与 mud_game 实现对比

| 维度 | oiuv_mud (原版) | mud_game (我们的) | 状态 |
|------|----------------|-------------------|------|
| 引擎 | LPC/C | TypeScript/Node.js | 不同技术栈 |
| 门派 | 39 | 39 | ✅ |
| 武功 | 719 | 44 | 🔶 框架已齐 |
| 状态效果 | 70 种 | 架构就绪，已实现中毒/解毒 | 🔶 框架已齐 |
| 属性 | 8项(str/int/con/dex/per/kar/neili/jingli) | 4项(str/int/con/dex) | ✅ |
| 商店 | 15城市实体店 | shop/buy 命令 | 🔶 |
| 任务 | 3类型+10级奖励 | 1类型(送信) | 🔶 |
| 等级系统 | 复杂经验曲线 | cube-root 等级 + 属性点 | ✅ |
| 时间系统 | heart_beat | SystemClock + Scheduler | ✅ |
| 转世 | ✅ | ❌ | 待定 |
| 拍卖 | ✅ | ❌ | 待定 |
| 战斗 | 4层判定+PvP | 4层判定+PvP+条件触发 | ✅ |
| NPC | 1864个 | 18个 | 🔶 |
| 物品 | 200+种 | 15+种 | 🔶 |
