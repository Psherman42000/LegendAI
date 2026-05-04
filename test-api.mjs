import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000';

const apiEndpoints = [
  { url: '/api/health', name: 'Health Check' },
  { url: '/api/user/me', name: 'User Me' },
  { url: '/api/user/usage', name: 'User Usage' },
  { url: '/api/videos', name: 'Videos List' },
  { url: '/api/billing/plans', name: 'Billing Plans' },
  { url: '/api/uploadthing', name: 'Uploadthing' },
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

for (const ep of apiEndpoints) {
  try {
    const res = await page.goto(`${BASE_URL}${ep.url}`, { waitUntil: 'networkidle', timeout: 8000 });
    const body = await page.textContent('body');
    console.log(`=== ${ep.name} (${ep.url}) ===`);
    console.log(`Status: ${res?.status()}`);
    console.log(`Body: ${body.substring(0, 200)}${body.length > 200 ? '...' : ''}`);
    console.log('');
  } catch (e) {
    console.log(`=== ${ep.name} (${ep.url}) ===`);
    console.log(`ERROR: ${e.message}`);
    console.log('');
  }
}

await browser.close();
