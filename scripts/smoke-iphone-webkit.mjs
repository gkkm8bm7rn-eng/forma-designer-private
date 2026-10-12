import assert from 'node:assert/strict';
import { webkit, devices } from 'playwright';

const browser=await webkit.launch({headless:true});
const errors=[];
try {
  const context=await browser.newContext({...devices['iPhone 13'], serviceWorkers:'allow'});
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  const url='http://127.0.0.1:8765/';
  for (let visit=1;visit<=2;visit++){
    if(visit===1) await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
    else await page.reload({waitUntil:'domcontentloaded',timeout:45000});
    await page.locator('#productGrid .product-card').first().waitFor({timeout:45000});
    await page.waitForFunction(()=>document.querySelectorAll('#productGrid .product-card').length===24,null,{timeout:30000});
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('#productGrid .product-image-stage img')).slice(0,2).every(img=>img.complete&&img.naturalWidth>0),null,{timeout:30000});
    const check=await page.evaluate(()=>({
      count:document.querySelectorAll('#productGrid .product-card').length,
      firstImages:Array.from(document.querySelectorAll('#productGrid .product-image-stage img')).slice(0,2).map(img=>({url:img.currentSrc,loaded:img.naturalWidth>0})),
      viewport:innerWidth,
      scrollWidth:document.documentElement.scrollWidth,
      gridHeight:document.getElementById('productGrid').getBoundingClientRect().height
    }));
    assert.equal(check.count,24);
    assert.ok(check.firstImages.every(img=>img.loaded&&img.url.startsWith(locationOrigin(url))), 'First photo must load from local site');
    assert.ok(check.gridHeight>400,'Catalog layout height is unexpectedly small');
    assert.ok(check.scrollWidth<=check.viewport+2,'Mobile layout overflows horizontally');
    console.log('PASS: iPhone WebKit visit '+visit+'; '+JSON.stringify(check));
  }
  await page.locator('#productGrid .product-image-stage').first().click();
  await page.locator('.product-dialog[open]').waitFor({timeout:30000});
  assert.ok(await page.locator('#productDetail').textContent(),'Product details are empty');
  assert.deepEqual(errors,[],'JavaScript page errors');
  console.log('PASS: product dialog, no uncaught JavaScript exceptions');
  await context.close();
} finally {
  await browser.close();
}
function locationOrigin(value){return new URL(value).origin;}
