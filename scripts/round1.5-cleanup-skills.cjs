#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'server', 'src', 'data');
const skillsPath = path.join(dataDir, 'skills.json');
const npcsPath = path.join(dataDir, 'npcs.json');
const schoolsPath = path.join(dataDir, 'schools.json');

let skills = JSON.parse(fs.readFileSync(skillsPath, 'utf8'));
const npcs = JSON.parse(fs.readFileSync(npcsPath, 'utf8'));
const schools = JSON.parse(fs.readFileSync(schoolsPath, 'utf8'));

function skillScore(s) {
  return (s.damageBase || 0) + (s.damageScale || 0) * 10 + (s.performs?.length || 0) * 5;
}

function cleanText(t) {
  if (typeof t !== 'string') return t;
  return t
    .replace(/\s+based on\s+\S+/gi, '')
    .replace(/\s*\([^)]*\d{2,4}[^)]*\)/g, '')
    .replace(/\s*\([^)]*jacki[^)]*\)/gi, '')
    .replace(/\s*\(Simba[^)]*\)/gi, '')
    .trim();
}

// 1. Clean weird names, descriptions, and perform names.
for (const s of skills) {
  s.name = cleanText(s.name);
  s.description = cleanText(s.description);
  if (s.performs) {
    for (const p of s.performs) {
      p.name = cleanText(p.name);
      p.desc = cleanText(p.desc);
    }
  }
}

// Drop skills that no longer have a name.
const droppedIds = new Set();
skills = skills.filter((s) => {
  if (!s.name) {
    droppedIds.add(s.id);
    return false;
  }
  return true;
});

// 2. Merge duplicate names.
const byName = {};
for (const s of skills) {
  byName[s.name] = byName[s.name] || [];
  byName[s.name].push(s);
}

const idRemap = {};
const mergedSkills = [];

for (const [name, list] of Object.entries(byName)) {
  if (list.length === 1) {
    mergedSkills.push(list[0]);
    continue;
  }
  // Pick canonical: prefer school-specific, then higher score, then shorter id.
  const canonical = list.sort((a, b) => {
    const aSch = a.schoolId && a.schoolId !== 'neutral' ? 1 : 0;
    const bSch = b.schoolId && b.schoolId !== 'neutral' ? 1 : 0;
    if (bSch !== aSch) return bSch - aSch;
    const aScore = skillScore(a);
    const bScore = skillScore(b);
    if (bScore !== aScore) return bScore - aScore;
    return a.id.length - b.id.length;
  })[0];
  mergedSkills.push(canonical);
  for (const s of list) {
    if (s.id !== canonical.id) idRemap[s.id] = canonical.id;
  }
}

skills = mergedSkills;

// 3. Assign schoolId based on id/name matching.
for (const s of skills) {
  if (s.schoolId && s.schoolId !== 'neutral') continue;
  for (const school of schools) {
    const idHit = s.id.toLowerCase().includes(school.id.toLowerCase());
    const nameHit = school.name && s.name.includes(school.name);
    if (idHit || nameHit) {
      s.schoolId = school.id;
      break;
    }
  }
  // Keep truly neutral skills with schoolId null rather than 'neutral' for consistency.
  if (s.schoolId === 'neutral') s.schoolId = null;
}

// 4. Ensure every school has a force, dodge, and at least one attack signature skill.
const attackTypes = ['strike', 'unarmed', 'cuff', 'finger', 'hand', 'claw', 'sword', 'blade', 'staff', 'whip', 'throwing', 'bow'];
const existingIds = new Set(skills.map((s) => s.id));
let nextGeneric = 1;

for (const school of schools) {
  const schoolSkills = skills.filter((s) => s.schoolId === school.id);
  const hasForce = schoolSkills.some((s) => s.type === 'force');
  const hasDodge = schoolSkills.some((s) => s.type === 'dodge');
  const hasAttack = schoolSkills.some((s) => attackTypes.includes(s.type));
  const hasParry = schoolSkills.some((s) => s.type === 'parry');

  function makeGeneric(type, name, desc) {
    const id = `${school.id}-generic-${type}-${nextGeneric++}`;
    if (existingIds.has(id)) return id;
    skills.push({
      id,
      name,
      type,
      description: desc,
      damageBase: type === 'force' || type === 'dodge' ? 0 : 5,
      damageScale: type === 'force' || type === 'dodge' ? 0 : 0.8,
      schoolId: school.id,
      requireSkill: type === 'force' ? undefined : 'force',
      requireLevel: type === 'force' ? undefined : 1,
      performs: type === 'force' || type === 'dodge'
        ? undefined
        : [{ name: `${name}·式`, desc, multiplier: 1.5, targetType: 'single', mpCost: 15 }],
    });
    existingIds.add(id);
    return id;
  }

  if (!hasForce) makeGeneric('force', `${school.name}心法`, `${school.name}入门心法，修习内力。`);
  if (!hasDodge) makeGeneric('dodge', `${school.name}身法`, `${school.name}入门身法，闪转腾挪。`);
  if (!hasAttack) makeGeneric('strike', `${school.name}拳法`, `${school.name}入门拳法。`);
  if (!hasParry) makeGeneric('parry', `${school.name}招架`, `${school.name}入门招架。`);
}

// 5. Ensure every attack/force/dodge skill has a perform (force/dodge optional).
for (const s of skills) {
  if (attackTypes.includes(s.type)) {
    if (!s.performs || s.performs.length === 0) {
      s.performs = [{ name: `${s.name}·式`, desc: s.description, multiplier: 1.6, targetType: 'single', mpCost: 15 }];
    } else {
      for (const p of s.performs) {
        if (!p.name) p.name = `${s.name}·式`;
        if (!p.desc) p.desc = s.description;
        if (typeof p.multiplier !== 'number') p.multiplier = 1.6;
        if (!p.targetType) p.targetType = 'single';
        if (typeof p.mpCost !== 'number') p.mpCost = Math.max(5, Math.round(p.multiplier * 10));
      }
    }
  }
}

// 6. Remap skill ids in NPCs and skill prerequisites.
function remapSkillId(id) {
  if (droppedIds.has(id)) return null;
  return idRemap[id] || id;
}

for (const n of npcs) {
  if (n.skills) {
    n.skills = n.skills
      .map((sk) => ({ ...sk, skillId: remapSkillId(sk.skillId) }))
      .filter((sk) => sk.skillId);
  }
}

for (const s of skills) {
  if (s.requireSkill) s.requireSkill = remapSkillId(s.requireSkill);
  if (s.requirements) {
    for (const req of s.requirements) {
      req.skillId = remapSkillId(req.skillId);
    }
  }
}

// 7. Recompute skill ids set and drop invalid requireSkill references.
const finalSkillIds = new Set(skills.map((s) => s.id));
for (const s of skills) {
  if (s.requireSkill && !finalSkillIds.has(s.requireSkill)) {
    delete s.requireSkill;
    delete s.requireLevel;
  }
  if (s.requirements) {
    s.requirements = s.requirements.filter((r) => finalSkillIds.has(r.skillId));
    if (s.requirements.length === 0) delete s.requirements;
  }
}

fs.writeFileSync(skillsPath, JSON.stringify(skills, null, 2), 'utf8');
fs.writeFileSync(npcsPath, JSON.stringify(npcs, null, 2), 'utf8');

console.log(`Skills cleaned: ${Object.keys(byName).reduce((a, k) => a + byName[k].length, 0)} -> ${skills.length}`);
console.log('Remapped skill ids:', Object.keys(idRemap).length);
console.log('School skill counts sample:');
for (const school of schools.slice(0, 5)) {
  const count = skills.filter((s) => s.schoolId === school.id).length;
  console.log(`  ${school.id}: ${count}`);
}
