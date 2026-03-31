const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log("Navigating to dashboard...");
    await page.goto('http://localhost:3000');
    // We are presumably logged in or do not need to for dev
    await page.waitForTimeout(1000);

    console.log("Navigating to purchasing...");
    await page.goto('http://localhost:3000/purchasing/receipts');
    await page.waitForTimeout(2000);

    const button = await page.$('button:has-text("Receive Goods")');
    if (button) {
        console.log("Clicking Receive Goods...");
        await button.click();
        await page.waitForTimeout(1000);

        console.log("Selecting a PO...");
        const selects = await page.$$('select');
        // Let's guess the first select is the PO select
        if (selects.length > 0) {
            const options = await selects[0].$$eval('option', opts => opts.map(o => o.value));
            const validOption = options.find(o => o !== '');
            if (validOption) {
                await selects[0].selectOption(validOption);
                await page.waitForTimeout(2000); // wait for fetch
            }
        }

        const screenshotPath = path.join(process.cwd(), 'grn_modal_debug.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log("Screenshot saved to", screenshotPath);
    } else {
        console.log("Receive Goods button not found");
    }

    await browser.close();
})();
