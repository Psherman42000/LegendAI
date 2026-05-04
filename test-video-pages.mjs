import { chromium } from 'playwright';

const urls = [
  { url: 'http://localhost:3000/videos/1', name: 'Video Detail' },
  { url: 'http://localhost:3000/videos/1/export', name: 'Video Export' },
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

for (const u of urls) {
  try {
    const res = await page.goto(u.url, { waitUntil: 'domcontentloaded', timeout: 8000 });
    const buttons = await page.$$eval('button', btns => btns.map(b => b.innerText.trim()).filter(Boolean));
    const links = await page.$$eval('a', links => links.map(l => ({ text: l.innerText.trim(), href: l.getAttribute('href') })).filter(l => l.text));
    console.log('=== ' + u.name + ' ===');
    console.log('Status:', res?.status());
    console.log('Buttons:', buttons.length ? buttons : '(none)');
    console.log('Links:', links.length ? links.map(l => l.text + ' -> ' + l.href) : '(none)');
    console.log('');
  } catch (e) {
    console.log('=== ' + u.name + ' ===');
    console.log('ERROR:', e.message);
    console.log('');
  }
}
await browser.close();
