import { test, expect } from '@playwright/test';

test.describe('Economy flow', () => {
  async function login(page: any, uid: string) {
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
    await cmd('财主');
    await cmd('set int 15');
    await cmd('done');
    return { input, sendBtn, output, cmd };
  }

  test('bank deposit and withdraw silver', async ({ page }) => {
    test.setTimeout(30000);
    const { output, cmd } = await login(page, 'pwbank' + Date.now());

    // Earn some silver from the ever-present ground
    for (let i = 0; i < 3; i++) await cmd('get 银子');

    await cmd('bank');
    await expect(output).toContainText('钱庄');

    await cmd('deposit silver 10');
    await expect(output).toContainText('存入了 10 两银子');

    await cmd('withdraw silver 5');
    await expect(output).toContainText('取出了 5 两银子');

    await cmd('bank');
    const text = (await output.textContent()) || '';
    expect(text).toMatch(/存银.*5\s*两/);
  });

  test('shop buy and sell', async ({ page }) => {
    test.setTimeout(30000);
    const { output, cmd } = await login(page, 'pwshop' + Date.now());

    await cmd('shop');
    await expect(output).toContainText('商店');

    for (let i = 0; i < 6; i++) await cmd('get 银子');
    await cmd('buy 金疮药');
    await expect(output).toContainText('买了');

    await cmd('sell 金疮药');
    await expect(output).toContainText('卖给了');
  });

  test('auction create and list', async ({ page }) => {
    test.setTimeout(30000);
    const { output, cmd } = await login(page, 'pwauction' + Date.now());

    for (let i = 0; i < 4; i++) await cmd('get 银子');
    await cmd('buy 草药');
    await expect(output).toContainText('买了');

    await cmd('auction sell 草药 5 30');
    await expect(output).toContainText('上架了');

    await cmd('auction');
    const text = (await output.textContent()) || '';
    expect(text).toContain('草药');
    expect(text).toContain('拍卖行');
  });

  test('crafting creates an item', async ({ page }) => {
    test.setTimeout(30000);
    const { output, cmd } = await login(page, 'pwcraft' + Date.now());

    // Iron sword needs 3 iron ore + 1 leather
    for (let i = 0; i < 5; i++) await cmd('get 银子');
    await cmd('buy 铁矿');
    await cmd('buy 铁矿');
    await cmd('buy 铁矿');
    await cmd('buy 皮革');

    await cmd('craft');
    await expect(output).toContainText('铁剑');

    await cmd('craft 铁剑');
    await expect(output).toContainText('成功制作出');
  });
});
