import { test, expect } from '@playwright/test';

let uidSeq = 0;
function nextUid(): string {
  return 'pw' + Date.now() + '_' + (uidSeq++);
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
    await page.waitForTimeout(250);
  }

  await cmd('register ' + uid + ' pw123');
  await cmd(name);
  await cmd('done');
  await expect(output).toContainText('角色创建成功');

  if (extra) await extra(cmd);

  return { page, uid, name, input, sendBtn, output, cmd };
}

test.describe('Social: Chat', () => {
  test('say broadcasts to other player in same room', async ({ browser }) => {
    test.setTimeout(60000);
    const ctx = await browser.newContext();
    const page1 = await ctx.newPage();
    const page2 = await ctx.newPage();

    const p1 = await createSession(page1, nextUid(), '张无忌');
    const p2 = await createSession(page2, nextUid(), '令狐冲');

    await p1.cmd('say 大家好！');
    await expect(p1.output).toContainText('你说道：「大家好！」');
    await page2.waitForTimeout(500);
    await expect(p2.output).toContainText('张无忌 说道：「大家好！」');

    await p2.cmd('say 无忌兄好');
    await expect(p2.output).toContainText('你说道：「无忌兄好」');
    await page1.waitForTimeout(500);
    await expect(p1.output).toContainText('令狐冲 说道：「无忌兄好」');

    await ctx.close();
  });

  test('tell sends private message', async ({ browser }) => {
    test.setTimeout(60000);
    const ctx = await browser.newContext();
    const page1 = await ctx.newPage();
    const page2 = await ctx.newPage();

    const p1 = await createSession(page1, nextUid(), '郭靖');
    const p2 = await createSession(page2, nextUid(), '黄蓉');

    await p1.cmd('tell 黄蓉 蓉儿你在哪里');
    await expect(p1.output).toContainText('你对 黄蓉 悄悄说道：「蓉儿你在哪里」');
    await page2.waitForTimeout(500);
    await expect(p2.output).toContainText('郭靖 对你悄悄说道：「蓉儿你在哪里」');

    await ctx.close();
  });

  test('shout broadcasts to all online players', async ({ browser }) => {
    test.setTimeout(60000);
    const ctx = await browser.newContext();
    const page1 = await ctx.newPage();
    const page2 = await ctx.newPage();

    const uid = nextUid();
    const p1 = await createSession(page1, nextUid(), '乔峰');
    const p2 = await createSession(page2, nextUid(), '段誉', async (cmd) => {
      await cmd('n');
    });

    await p1.cmd('shout 天下英雄，齐聚少林！');
    await expect(p1.output).toContainText('你大声喊道：「天下英雄，齐聚少林！」');
    await page2.waitForTimeout(500);
    const p2text = (await p2.output.textContent()) || '';
    expect(p2text).toContain('【江湖】乔峰 大声说道：「天下英雄，齐聚少林！」');

    await ctx.close();
  });
});

test.describe('Social: Trade & Mail', () => {
  test('give transfers item to another player', async ({ browser }) => {
    test.setTimeout(60000);
    const ctx = await browser.newContext();
    const page1 = await ctx.newPage();
    const page2 = await ctx.newPage();

    const uid = nextUid();
    const p1 = await createSession(page1, nextUid(), '杨过');
    const p2 = await createSession(page2, nextUid(), '小龙女');

    await p1.cmd('get 银子');
    await p1.cmd('give 小龙女 银子');
    await expect(p1.output).toContainText('你把银子交给了小龙女');
    await page2.waitForTimeout(500);
    await expect(p2.output).toContainText('杨过 把银子交给了你');

    await ctx.close();
  });

  test('mail sends offline message and can be read', async ({ browser }) => {
    test.setTimeout(60000);
    const ctx = await browser.newContext();
    const page1 = await ctx.newPage();
    const page2 = await ctx.newPage();

    const uid = nextUid();
    const p1 = await createSession(page1, nextUid(), '韦小宝');
    const p2 = await createSession(page2, nextUid(), '康熙');

    await p1.cmd('mail 康熙 微臣有事启奏');
    await expect(p1.output).toContainText('你给 康熙 发了一封邮件');
    await page2.waitForTimeout(500);
    await expect(p2.output).toContainText('新邮件');

    await p2.cmd('checkmail');
    await expect(p2.output).toContainText('韦小宝');

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

    const uid = nextUid();
    const p1 = await createSession(page1, nextUid(), '狄云');
    const p2 = await createSession(page2, nextUid(), '水笙');

    await p1.cmd('friend add 水笙');
    await expect(p1.output).toContainText('你将 水笙 添加为好友');

    await p1.cmd('friend list');
    const text = (await p1.output.textContent()) || '';
    expect(text).toContain('水笙');
    expect(text).toContain('【在线】');

    await p1.cmd('friend remove 水笙');
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

    const uid = nextUid();
    const p1 = await createSession(page1, nextUid(), '任我行');
    const p2 = await createSession(page2, nextUid(), '向问天');

    await p1.cmd('guild create 日月神教');
    await expect(p1.output).toContainText('你创建了帮会「日月神教」');

    await p2.cmd('guild join 日月神教');
    await expect(p2.output).toContainText('你加入了帮会「日月神教」');

    await p1.cmd('guild info');
    const infoText = (await p1.output.textContent()) || '';
    expect(infoText).toContain('日月神教');
    expect(infoText).toContain('任我行');
    expect(infoText).toContain('向问天');
    expect(infoText).toContain('2 人');

    await p1.cmd('guild chat 千秋万载，一统江湖！');
    await expect(p1.output).toContainText('【日月神教帮会】你说道：「千秋万载，一统江湖！」');
    await page2.waitForTimeout(500);
    const chat2 = (await p2.output.textContent()) || '';
    expect(chat2).toContain('【日月神教帮会】任我行：「千秋万载，一统江湖！」');

    await p1.cmd('guild promote 向问天');
    await expect(p1.output).toContainText('任命 向问天 为长老');

    await p1.cmd('guild info');
    const info2 = (await p1.output.textContent()) || '';
    expect(info2).toContain('长老');

    await p2.cmd('guild leave');
    await expect(p2.output).toContainText('离开了帮会');

    await p1.cmd('guild list');
    const listText = (await p1.output.textContent()) || '';
    expect(listText).toContain('日月神教');

    await p1.cmd('guild leave');
    await expect(p1.output).toContainText('无法直接离开');

    await p1.cmd('guild disband');
    await expect(p1.output).toContainText('解散了帮会');

    await ctx.close();
  });

  test('guild list shows empty when none exist', async ({ browser }) => {
    test.setTimeout(30000);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    const uid = nextUid();
    const p = await createSession(page, uid, '路人甲');

    await p.cmd('guild list');
    await expect(p.output).toContainText('还没有任何帮会');

    await ctx.close();
  });

  test('who command shows guild affiliation', async ({ browser }) => {
    test.setTimeout(40000);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    const uid = nextUid();
    const p = await createSession(page, uid, '帮主甲');

    await p.cmd('guild create 天下会');
    await p.cmd('who');
    const text = (await p.output.textContent()) || '';
    expect(text).toContain('天下会');

    await ctx.close();
  });
});

