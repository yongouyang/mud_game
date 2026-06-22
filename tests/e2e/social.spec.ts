import { test, expect } from '@playwright/test';

// Globally unique: Math.random() ensures no collision across parallel CI workers
let uidSeq = 0;
function nextUid(): string {
  return 'pw' + Date.now() + '_' + Math.random().toString(36).slice(2, 7) + '_' + (uidSeq++);
}
// Pool of Chinese characters for generating unique names (valid: 2-6 chars, pure Chinese)
const NAME_CHARS = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥天地玄黄宇宙洪荒日月盈昃';
let nameSeq = 0;
function uniqueName(): string {
  let name = '';
  for (let i = 0; i < 5; i++) {
    name += NAME_CHARS[Math.floor(Math.random() * NAME_CHARS.length)];
  }
  return name;
}
// Guild names: 2-8 Chinese characters, unique per call
function uniqueGuild(): string {
  const prefix = ['日月神教','天下会','丐帮总舵','桃花岛派'][nameSeq++ % 4];
  let suffix = '';
  for (let i = 0; i < 2; i++) {
    suffix += NAME_CHARS[Math.floor(Math.random() * NAME_CHARS.length)];
  }
  return prefix + suffix;
}

interface PlayerSession {
  page: any;
  uid: string;
  name: string;
  input: any;
  sendBtn: any;
  output: any;
  cmd: (text: string) => Promise<void>;
}

async function createSession(
  page: any, uid: string, name: string,
  extra?: (cmd: (t: string) => Promise<void>) => Promise<void>,
): Promise<PlayerSession> {
  await page.goto('/');
  const input = page.locator('input[placeholder="输入命令..."]');
  const sendBtn = page.getByRole('button', { name: '发送' });
  const output = page.locator('#root');

  async function cmd(text: string) {
    await input.fill(text);
    await sendBtn.click();
    await page.waitForTimeout(400);
  }

  // Register with retry — the player may already exist from a previous run
  await cmd('register ' + uid + ' pw123');
  // Wait for the registration to be acknowledged
  await page.waitForTimeout(600);
  await cmd(name);
  await page.waitForTimeout(600);
  await cmd('done');
  // Wait for character creation to complete
  await expect(output).toContainText('角色创建成功', { timeout: 10000 });

  if (extra) await extra(cmd);

  return { page, uid, name, input, sendBtn, output, cmd };
}

test.describe('Social: Chat', () => {
  test('say broadcasts to other player in same room', async ({ browser }) => {
    test.setTimeout(60000);
    const ctx = await browser.newContext();
    const page1 = await ctx.newPage();
    const page2 = await ctx.newPage();

    const nameA = uniqueName()
    const nameB = uniqueName()
    const p1 = await createSession(page1, nextUid(), nameA);
    const p2 = await createSession(page2, nextUid(), nameB);

    await p1.cmd('say 大家好！');
    await expect(p1.output).toContainText('你说道：「大家好！」');
    await page2.waitForTimeout(500);
    await expect(p2.output).toContainText(nameA + ' 说道：「大家好！」');

    await p2.cmd('say 你好');
    await expect(p2.output).toContainText('你说道：「你好」');
    await page1.waitForTimeout(500);
    await expect(p1.output).toContainText(nameB + ' 说道：「你好」');

    await ctx.close();
  });

  test('tell sends private message', async ({ browser }) => {
    test.setTimeout(60000);
    const ctx = await browser.newContext();
    const page1 = await ctx.newPage();
    const page2 = await ctx.newPage();

    const nameA = uniqueName()
    const nameB = uniqueName()
    const p1 = await createSession(page1, nextUid(), nameA);
    const p2 = await createSession(page2, nextUid(), nameB);

    await p1.cmd('tell ' + nameB + ' 你在哪里');
    await expect(p1.output).toContainText('你对 ' + nameB + ' 悄悄说道：「你在哪里」');
    await page2.waitForTimeout(500);
    await expect(p2.output).toContainText(nameA + ' 对你悄悄说道：「你在哪里」');

    await ctx.close();
  });

  test('shout broadcasts to all online players', async ({ browser }) => {
    test.setTimeout(60000);
    const ctx = await browser.newContext();
    const page1 = await ctx.newPage();
    const page2 = await ctx.newPage();

    const nameA = uniqueName()
    const nameB = uniqueName()
    const p1 = await createSession(page1, nextUid(), nameA);
    const p2 = await createSession(page2, nextUid(), nameB, async (cmd) => {
      await cmd('n');
    });

    await p1.cmd('shout 天下英雄，齐聚少林！');
    await expect(p1.output).toContainText('你大声喊道：「天下英雄，齐聚少林！」');
    await page2.waitForTimeout(500);
    const p2text = (await p2.output.textContent()) || '';
    expect(p2text).toContain(nameA + ' 大声说道：「天下英雄，齐聚少林！」');

    await ctx.close();
  });
});

test.describe('Social: Trade & Mail', () => {
  test('give transfers item to another player', async ({ browser }) => {
    test.setTimeout(60000);
    const ctx = await browser.newContext();
    const page1 = await ctx.newPage();
    const page2 = await ctx.newPage();

    const nameA = uniqueName()
    const nameB = uniqueName()
    const p1 = await createSession(page1, nextUid(), nameA);
    const p2 = await createSession(page2, nextUid(), nameB);

    await p1.cmd('get 银子');
    await p1.cmd('give ' + nameB + ' 银子');
    await expect(p1.output).toContainText('你把银子交给了' + nameB);
    await page2.waitForTimeout(500);
    await expect(p2.output).toContainText(nameA + ' 把银子交给了你');

    await ctx.close();
  });

  test('mail sends offline message and can be read', async ({ browser }) => {
    test.setTimeout(60000);
    const ctx = await browser.newContext();
    const page1 = await ctx.newPage();
    const page2 = await ctx.newPage();

    const nameA = uniqueName()
    const nameB = uniqueName()
    const p1 = await createSession(page1, nextUid(), nameA);
    const p2 = await createSession(page2, nextUid(), nameB);

    await p1.cmd('mail ' + nameB + ' 微臣有事启奏');
    await expect(p1.output).toContainText('你给 ' + nameB + ' 发了一封邮件');
    await page2.waitForTimeout(500);
    await expect(p2.output).toContainText('新邮件');

    await p2.cmd('checkmail');
    await expect(p2.output).toContainText(nameA);

    await p2.cmd('readmail 1');
    const text = (await p2.output.textContent()) || '';
    expect(text).toContain('微臣有事启奏');

    await p2.cmd('checkmail');
    const text2 = (await p2.output.textContent()) || '';
    expect(text2).toContain('✓');

    await ctx.close();
  });
});

test.describe('Social: Friends', () => {
  test('friend add, list, and remove', async ({ browser }) => {
    test.setTimeout(60000);
    const ctx = await browser.newContext();
    const page1 = await ctx.newPage();
    const page2 = await ctx.newPage();

    const nameA = uniqueName()
    const nameB = uniqueName()
    const p1 = await createSession(page1, nextUid(), nameA);
    const p2 = await createSession(page2, nextUid(), nameB);

    await p1.cmd('friend add ' + nameB);
    await expect(p1.output).toContainText('你将 ' + nameB + ' 添加为好友');

    await p1.cmd('friend list');
    const text = (await p1.output.textContent()) || '';
    expect(text).toContain(nameB);
    expect(text).toContain('【在线】');

    await p1.cmd('friend remove ' + nameB);
    await expect(p1.output).toContainText('从好友列表中移除');

    await p1.cmd('friend list');
    await expect(p1.output).toContainText('还没有好友');

    await ctx.close();
  });
});

test.describe('Social: Guild', () => {
  test('guild create, join, info, chat, and leave', async ({ browser }) => {
    test.setTimeout(90000);
    const ctx = await browser.newContext();
    const page1 = await ctx.newPage();
    const page2 = await ctx.newPage();

    const gName = uniqueGuild()
    const nameA = uniqueName()
    const nameB = uniqueName()
    const p1 = await createSession(page1, nextUid(), nameA);
    const p2 = await createSession(page2, nextUid(), nameB);

    await p1.cmd('guild create ' + gName);
    await expect(p1.output).toContainText('你创建了帮会「' + gName + '」');

    await p2.cmd('guild join ' + gName);
    await expect(p2.output).toContainText('你加入了帮会「' + gName + '」');

    await p1.cmd('guild info');
    const infoText = (await p1.output.textContent()) || '';
    expect(infoText).toContain(gName);
    expect(infoText).toContain(nameA);
    expect(infoText).toContain(nameB);
    expect(infoText).toContain('2 人');

    await p1.cmd('guild chat 千秋万载，一统江湖！');
    await expect(p1.output).toContainText('【' + gName + '帮会】你说道：「千秋万载，一统江湖！」');
    await page2.waitForTimeout(500);
    const chat2 = (await p2.output.textContent()) || '';
    expect(chat2).toContain('【' + gName + '帮会】' + nameA + '：「千秋万载，一统江湖！」');

    await p1.cmd('guild promote ' + nameB);
    await expect(p1.output).toContainText('任命 ' + nameB + ' 为长老');

    await p1.cmd('guild info');
    const info2 = (await p1.output.textContent()) || '';
    expect(info2).toContain('长老');

    await p2.cmd('guild leave');
    await expect(p2.output).toContainText('离开了帮会');

    await p1.cmd('guild list');
    const listText = (await p1.output.textContent()) || '';
    expect(listText).toContain(gName);

    await p1.cmd('guild leave');
    await expect(p1.output).toContainText('无法直接离开');

    // Clean up
    await p1.cmd('guild disband');
    await expect(p1.output).toContainText('解散了帮会');

    await ctx.close();
  });

  test('guild list returns valid output', async ({ browser }) => {
    test.setTimeout(30000);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    const p = await createSession(page, nextUid(), uniqueName())

    await p.cmd('guild list');
    const text = (await p.output.textContent()) || '';
    // Should return either the empty message or a list of guilds (may have guilds from parallel workers)
    expect(text).toMatch(/还没有任何帮会|江湖帮会/);

    await ctx.close();
  });

  test('who command shows guild affiliation', async ({ browser }) => {
    test.setTimeout(40000);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    const gName = uniqueGuild()
    const p = await createSession(page, nextUid(), uniqueName())

    await p.cmd('guild create ' + gName);
    await p.cmd('who');
    const text = (await p.output.textContent()) || '';
    expect(text).toContain(gName);

    // Clean up
    await p.cmd('guild disband');

    await ctx.close();
  });
});
