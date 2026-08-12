const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  
  await page.goto('http://127.0.0.1:5500/Frontend/', { waitUntil: 'networkidle0' });
  
  // Login first if needed
  try {
    const rollInput = await page.$('input[placeholder*="Roll Number"]');
    if (rollInput) {
      await rollInput.type('2501641520076');
      const passInput = await page.$('input[type="password"]');
      await passInput.type('password');
      await page.keyboard.press('Enter');
      await page.waitForNavigation({ waitUntil: 'networkidle0' });
      console.log('Logged in successfully.');
    }
  } catch(e) {
    console.log('Login skip or error:', e.message);
  }

  try {
    // Select Exam: AKTU B.Tech
    await page.select('select:has(option[value="AKTU B.Tech"])', 'AKTU B.Tech');
    await new Promise(r => setTimeout(r, 500));
    
    // Select Branch: CSE
    await page.select('select:has(option[value="CSE"])', 'CSE');
    await new Promise(r => setTimeout(r, 500));
    
    // Select Semester: 3
    await page.select('select:has(option[value="3"])', '3');
    await new Promise(r => setTimeout(r, 500));
    
    // Select Subject: Data Structures
    await page.select('select:has(option[value="Data Structures"])', 'Data Structures');
    await new Promise(r => setTimeout(r, 1000));
    
    console.log('Filters selected.');

    // Click 'Tell Me What to Study First'
    const [button] = await page.$x("//button[contains(., 'What to Study First')]");
    if (button) {
      console.log('Clicking button...');
      await button.click();
      await new Promise(r => setTimeout(r, 3000));
    } else {
      console.log('Button not found');
    }

  } catch(e) {
    console.error('Test error:', e.message);
  }
  
  await browser.close();
})();
