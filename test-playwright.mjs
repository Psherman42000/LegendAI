import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000';

async function testPage(url, name) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
    const status = response?.status() || 'no response';
    
    // Coleta todos os botões e links
    const buttons = await page.$$eval('button', btns => btns.map(b => ({
      text: b.innerText.trim(),
      disabled: b.disabled,
      onclick: b.hasAttribute('onclick'),
      type: b.type
    })));
    
    const links = await page.$$eval('a', links => links.map(l => ({
      text: l.innerText.trim(),
      href: l.getAttribute('href'),
      isButton: l.querySelector('button') !== null
    })));
    
    // Verifica erros no console
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    
    await page.waitForTimeout(500);
    
    console.log(`\n=== ${name} (${url}) ===`);
    console.log(`Status: ${status}`);
    console.log(`Title: ${await page.title()}`);
    console.log(`Buttons (${buttons.length}):`);
    buttons.forEach((b, i) => {
      const action = b.onclick ? '⚡ has onclick' : (b.disabled ? '❌ disabled' : '⚠️ no action');
      console.log(`  ${i+1}. "${b.text}" - ${action}`);
    });
    console.log(`Links (${links.length}):`);
    links.forEach((l, i) => {
      const valid = l.href && l.href !== '#' ? '✅' : '❌ no route';
      console.log(`  ${i+1}. "${l.text}" -> ${l.href} ${valid}`);
    });
    if (errors.length) {
      console.log(`Console errors: ${errors.length}`);
      errors.forEach(e => console.log(`  ❌ ${e}`));
    }
    
    return { status, buttons, links, errors };
  } catch (e) {
    console.log(`\n=== ${name} (${url}) ===`);
    console.log(`❌ ERROR: ${e.message}`);
    return { status: 'error', error: e.message };
  } finally {
    await browser.close();
  }
}

async function main() {
  const pages = [
    { url: '/', name: 'Home' },
    { url: '/login', name: 'Login' },
    { url: '/register', name: 'Register' },
    { url: '/dashboard', name: 'Dashboard' },
    { url: '/upload', name: 'Upload' },
    { url: '/videos', name: 'Videos' },
    { url: '/billing', name: 'Billing' },
    { url: '/settings', name: 'Settings' },
  ];
  
  for (const p of pages) {
    await testPage(`${BASE_URL}${p.url}`, p.name);
  }
}

main().catch(console.error);
