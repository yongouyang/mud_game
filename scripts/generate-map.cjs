#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'server', 'src', 'data');
const outPath = path.join(__dirname, '..', 'docs', 'map.html');

const maps = JSON.parse(fs.readFileSync(path.join(dataDir, 'maps.json'), 'utf8'));
const npcs = JSON.parse(fs.readFileSync(path.join(dataDir, 'npcs.json'), 'utf8'));
const skills = JSON.parse(fs.readFileSync(path.join(dataDir, 'skills.json'), 'utf8'));
const schools = JSON.parse(fs.readFileSync(path.join(dataDir, 'schools.json'), 'utf8'));

const rooms = maps.rooms;
const roomById = new Map(rooms.map(r => [r.id, r]));

// BFS shortest paths from town/square.
const startId = 'town/square';
const paths = new Map([[startId, []]]);
const queue = [startId];
while (queue.length) {
  const id = queue.shift();
  const room = roomById.get(id);
  if (!room || !room.exits) continue;
  for (const exit of room.exits) {
    if (!paths.has(exit.roomId)) {
      paths.set(exit.roomId, [...paths.get(id), exit.direction]);
      queue.push(exit.roomId);
    }
  }
}

const dirAlias = {
  north: 'n', south: 's', east: 'e', west: 'w', up: 'u', down: 'd',
};

function formatPath(steps) {
  if (!steps || steps.length === 0) return '<span>起点</span>';
  return steps.map(s => `<span>${dirAlias[s] || s}</span>`).join('');
}

const dirShort = { north: 'n', south: 's', east: 'e', west: 'w', up: 'u', down: 'd',
  northeast: 'ne', northwest: 'nw', southeast: 'se', southwest: 'sw' };

function formatExits(room) {
  if (!room.exits || room.exits.length === 0) return '无';
  return room.exits
    .map(e => {
      const target = roomById.get(e.roomId);
      const name = target ? target.name : e.roomId;
      const short = dirShort[e.direction] || e.direction;
      return `<a href="#${e.roomId}" class="exit-link" title="去 ${name}">${short}→${name}</a>`;
    })
    .join(' │ ');
}

const npcsByRoom = new Map();
for (const npc of npcs) {
  if (!npcsByRoom.has(npc.roomId)) npcsByRoom.set(npc.roomId, []);
  npcsByRoom.get(npc.roomId).push(npc);
}

const masterNames = new Set();
for (const school of schools) {
  if (school.masterName) masterNames.add(school.masterName);
}

function npcLabel(npc) {
  if (npc.boss) return 'boss';
  if (masterNames.has(npc.name)) return 'master';
  if (npc.aggressive) return 'aggressive';
  return 'npc';
}

const areaNames = {
  town: '无名小镇',
  wilderness: '荒野山林',
  shaolin: '少林寺',
  wudang: '武当山',
  gaibang: '丐帮',
  huashan: '华山派',
  emei: '峨眉派',
  gumu: '古墓派',
  kunlun: '昆仑派',
  mingjiao: '明教',
  quanzhen: '全真教',
  xingxiu: '星宿派',
  xiaoyao: '逍遥派',
  taohua: '桃花岛',
  lingjiu: '灵鹫宫',
  shenlong: '神龙教',
  riyue: '日月神教',
  xueshan: '雪山派',
  tiezhang: '铁掌帮',
  tangmen: '唐门',
  murong: '慕容世家',
  duan: '大理段氏',
  henshan: '衡山派',
  honghua: '红花会',
  hu: '胡家',
  jueqing: '绝情谷',
  lingxiao: '凌霄城',
  meizhuang: '梅庄',
  miao: '苗家',
  ouyang: '欧阳世家',
  shang: '商家堡',
  songshan: '嵩山派',
  tianlongsi: '天龙寺',
  ultra: '绝世境界',
  wudu: '五毒教',
  xiakedao: '侠客岛',
  xuanming: '玄冥谷',
  xuedao: '血刀门',
  yunlong: '云龙门',
  zhenyuan: '震远镖局',
  hell: '修罗地狱',
};

function areaKey(roomId) {
  return roomId.split('/')[0];
}

function areaName(roomId) {
  const key = areaKey(roomId);
  return areaNames[key] || key;
}

// Group rooms by area key, preserving a sensible order.
const order = [
  'town', 'wilderness',
  'shaolin', 'wudang', 'gaibang', 'huashan', 'emei', 'gumu',
  'kunlun', 'mingjiao', 'quanzhen', 'xingxiu', 'xiaoyao', 'taohua',
  'lingjiu', 'shenlong', 'riyue', 'xueshan', 'tiezhang', 'tangmen',
  'murong', 'duan', 'henshan', 'honghua', 'hu', 'jueqing', 'lingxiao',
  'meizhuang', 'miao', 'ouyang', 'shang', 'songshan', 'tianlongsi',
  'ultra', 'wudu', 'xiakedao', 'xuanming', 'xuedao', 'yunlong',
  'zhenyuan', 'hell',
];

const grouped = new Map();
for (const room of rooms) {
  const key = areaKey(room.id);
  if (!grouped.has(key)) grouped.set(key, []);
  grouped.get(key).push(room);
}

const sections = [];
for (const key of order) {
  const list = grouped.get(key);
  if (!list) continue;
  sections.push({ key, name: areaNames[key] || key, rooms: list });
}

const roomRows = sections.map(sec => {
  const cards = sec.rooms.map(room => {
    const reachable = paths.has(room.id);
    const steps = paths.get(room.id);
    const roomNpcs = npcsByRoom.get(room.id) || [];
    const npcHtml = roomNpcs.length
      ? roomNpcs.map(n => `<span class="npc ${npcLabel(n)}" data-npc="${n.name}">${n.name}${n.boss ? ' 👹' : n.aggressive ? ' ⚔' : ''}</span>`).join(' ')
      : '<span class="npc-none">(无人)</span>';
    return `  <div class="room" id="${room.id}" data-search="${room.name} ${roomNpcs.map(n=>n.name).join(' ')} ${areaName(room.id)}">
    <div class="room-name">${room.name} <span class="room-id">${room.id}</span></div>
    <div class="path">🟦 ${reachable ? formatPath(steps) : '<span class="unreachable">无法从广场到达</span>'}</div>
    <div class="exits">出口: ${formatExits(room)}</div>
    <div class="npcs">${npcHtml}</div>
  </div>`;
  }).join('\n');
  return `<h2 id="area-${sec.key}">${sec.name}</h2>\n<div class="grid">\n${cards}\n</div>`;
}).join('\n\n');

const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<title>炎黄群侠传 · 世界地图</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:monospace;background:#1a1a2e;color:#e0c060;padding:24px}
h1{color:#ffd700;margin-bottom:4px;font-size:20px}
.stats{color:#888;font-size:11px;margin-bottom:8px}
/* ── Search ── */
.search-bar{display:flex;gap:8px;margin-bottom:16px;position:sticky;top:0;z-index:10;background:#1a1a2e;padding:8px 0}
.search-bar input{flex:1;background:#16213e;border:1px solid #444;color:#e0c060;padding:6px 10px;font-size:13px;border-radius:4px;outline:none}
.search-bar input:focus{border-color:#ffd700}
.search-bar .btn{background:#333;color:#e0c060;border:1px solid #555;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px}
.search-bar .btn:hover{background:#444}
.search-bar .clear{background:#3a1a1a;border-color:#633}
.search-result{color:#888;font-size:11px;margin-bottom:4px}
/* ── Areas & Rooms ── */
h2{color:#ffd700;font-size:14px;margin:24px 0 6px;padding-bottom:2px;border-bottom:1px solid #333}
h2.collapsed + .grid{display:none}
.grid{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.room{border:1px solid #333;padding:8px 10px;border-radius:4px;background:#16213e;min-width:260px;font-size:13px;max-width:340px;scroll-margin-top:60px;transition:border-color .3s,box-shadow .3s}
.room:target{border-color:#ffd700;box-shadow:0 0 12px rgba(255,215,0,.3)}
.room.highlight{border-color:#ff4444;box-shadow:0 0 16px rgba(255,68,68,.4)}
.room.hidden{display:none}
.room-name{color:#ffd700;font-weight:bold;margin-bottom:4px}
.room-id{color:#555;font-size:10px;margin-left:6px}
.path{color:#6699cc;margin-bottom:4px}
.path span{background:#223;padding:2px 4px;border-radius:2px;margin:0 1px;display:inline-block}
.path .unreachable{color:#888;background:#2a1a1a}
.exits{color:#88cc88;font-size:11px;margin-bottom:4px}
.exit-link{color:#88cc88;text-decoration:none;border-bottom:1px dotted #446644}
.exit-link:hover{color:#aaffaa;border-bottom-color:#88cc88}
.npcs{font-size:11px}
.npc{display:inline-block;margin-right:6px}
.npc-npc{color:#ffaa44}
.npc-master{color:#66ccff;font-weight:bold}
.npc-aggressive{color:#ff4444;font-weight:bold}
.npc-boss{color:#ff00ff;font-weight:bold}
.npc-none{color:#555}
.legend{font-size:11px;color:#888;margin-bottom:10px}
.generated{color:#555;font-size:11px;margin-top:24px}
</style>
</head>
<body>
<h1>炎黄群侠传 世界地图</h1>
<div class="stats">${rooms.length} 房间 · ${npcs.length} NPC · ${schools.length} 门派 · ${skills.length} 武功 · 起点: 小镇广场</div>

<div class="search-bar">
  <input id="search" type="text" placeholder="搜索房间 / NPC / 区域...（输入后回车或自动过滤）" autofocus>
  <button class="btn clear" id="clearBtn">清除</button>
</div>
<div class="search-result" id="result"></div>

<div class="legend">
  <span style="color:#6699cc">🟦 到达路径</span>
  <span style="color:#ffd700;margin-left:10px">🟡 房间</span>
  <span style="color:#88cc88;margin-left:10px">🟢 出口</span>
  <span style="color:#66ccff;margin-left:10px">🔵 师父</span>
  <span style="color:#ffaa44;margin-left:10px">🟠 NPC</span>
  <span style="color:#ff4444;margin-left:10px">⛔ 主动攻击</span>
  <span style="color:#ff00ff;margin-left:10px">👹 Boss</span>
  <span style="margin-left:16px;color:#888">提示：点击出口链接可跳转目标房间</span>
</div>

${roomRows}

<p class="generated">本页面由 scripts/generate-map.cjs 根据 server/src/data/maps.json / npcs.json 自动生成。</p>

<script>
(function(){
  const search = document.getElementById('search');
  const result = document.getElementById('result');
  const clearBtn = document.getElementById('clearBtn');
  const rooms = document.querySelectorAll('.room');
  const areas = document.querySelectorAll('h2');

  function filter(q) {
    q = q.trim().toLowerCase();
    let visible = 0;
    const areaVis = new Map();

    rooms.forEach(r => {
      const data = (r.getAttribute('data-search') || '').toLowerCase();
      const match = !q || data.includes(q);
      r.classList.toggle('hidden', !match);
      if (match) {
        visible++;
        const areaH2 = r.closest('.grid')?.previousElementSibling;
        if (areaH2 && areaH2.tagName === 'H2') areaVis.set(areaH2, true);
      }
      r.classList.remove('highlight');
    });

    // Show/hide area headers
    areas.forEach(h2 => {
      if (!q) { h2.classList.remove('collapsed'); return; }
      h2.classList.toggle('collapsed', !areaVis.has(h2));
    });

    result.textContent = q
      ? '找到 ' + visible + ' / ' + rooms.length + ' 个匹配房间' + (visible === 1 ? '（已自动滚动到该房间）' : '')
      : '';

    // If exactly one match, scroll to it
    if (visible === 1 && q) {
      const match = document.querySelector('.room:not(.hidden)');
      if (match) {
        match.classList.add('highlight');
        match.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  // Live filtering as user types
  search.addEventListener('input', () => filter(search.value));

  // Also filter on Enter
  search.addEventListener('keydown', e => {
    if (e.key === 'Escape') { search.value = ''; filter(''); search.blur(); }
  });

  clearBtn.addEventListener('click', () => {
    search.value = '';
    filter('');
    search.focus();
  });

  // Highlight target room when navigated via hash
  function highlightTarget() {
    rooms.forEach(r => r.classList.remove('highlight'));
    const hash = window.location.hash.slice(1);
    if (hash) {
      const target = document.getElementById(hash);
      if (target) {
        target.classList.add('highlight');
        setTimeout(() => target.classList.remove('highlight'), 2000);
      }
    }
  }
  window.addEventListener('hashchange', highlightTarget);
  highlightTarget();
})();
</script>
</body>
</html>
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html, 'utf8');
console.log(`Generated ${outPath} (${rooms.length} rooms, ${npcs.length} NPCs)`);
