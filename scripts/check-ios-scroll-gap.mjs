import { strict as assert } from 'node:assert';
import { webkit, devices } from 'playwright';
import { PNG } from 'pngjs';

const browser=await webkit.launch();
try {
  const context=await browser.newContext({...devices['iPhone 13'], serviceWorkers:'allow'});
  const page=await context.newPage();
  const issues=[];
  page.on('pageerror',e=>issues.push(e.message));
  await page.goto('http://127.0.0.1:8765/?tetopt_internal=on#category=2',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>document.querySelectorAll('#productGrid .product-card').length>=12,{},{timeout:45000});
  await page.waitForTimeout(800);
  const initial=await page.evaluate(()=>({
    title:document.getElementById('catalogTitle').textContent,
    cards:document.querySelectorAll('#productGrid .product-card').length,
    gridTop:document.getElementById('productGrid').getBoundingClientRect().top+scrollY,
    headerHeight:document.querySelector('.site-header').getBoundingClientRect().height,
    scroller:document.scrollingElement?.tagName,
    rootOverflow:getComputedStyle(document.documentElement).overflow,
    bodyOverflow:getComputedStyle(document.body).overflow,
    scrollHeight:document.scrollingElement.scrollHeight,
    cardHeights:Array.from(document.querySelectorAll('#productGrid .product-card')).slice(0,6).map(e=>Math.round(e.getBoundingClientRect().height))
  }));
  assert.match(initial.title,/Барные и полубарные стулья/i);
  console.log('INITIAL '+JSON.stringify(initial));
  const top=initial.gridTop;
  const targets=[0,top-500,top-100,top,top+200,top+450,top+800,top+1350,top+2000,top+2700].map(n=>Math.max(0,Math.round(n)));
  for(const target of targets){
    await page.evaluate(y=>window.scrollTo({top:y,behavior:'instant'}),target);
    await page.waitForTimeout(220);
    const state=await page.evaluate(()=>{
      const r=e=>{const a=e.getBoundingClientRect();return {x:Math.round(a.x),y:Math.round(a.y),w:Math.round(a.width),h:Math.round(a.height)}};
      const cards=Array.from(document.querySelectorAll('#productGrid .product-card'));
      const v=innerHeight;
      return {y:scrollY,vh:v,grid:r(document.querySelector('#productGrid')),header:r(document.querySelector('.site-header')),visible:cards.map((c,i)=>({i,...r(c)})).filter(x=>x.y<v&&x.y+x.h>0).slice(0,5),hit:[100,300,500,700].map(y=>({y,tag:document.elementFromPoint(innerWidth/2,Math.min(y,innerHeight-10))?.className||''})),scrollWidth:document.documentElement.scrollWidth};
    });
    const png=PNG.sync.read(await page.screenshot({type:'png',animations:'disabled'}));
    const scale=png.width/state.vh*0+png.width/390;
    const buckets=new Set();
    // Sample the central screen strip only under the sticky header.
    const yStart=Math.ceil(180*scale), yEnd=Math.min(png.height,Math.ceil(650*scale));
    for(let yy=yStart;yy<yEnd;yy+=Math.max(2,Math.round(14*scale))){
      for(let xx=Math.round(png.width*.12);xx<png.width*.9;xx+=Math.max(2,Math.round(18*scale))){
        const z=(yy*png.width+xx)*4;
        buckets.add([png.data[z]>>4,png.data[z+1]>>4,png.data[z+2]>>4].join(','));
      }
    }
    console.log('SCROLL '+JSON.stringify({target,...state,colors:buckets.size}));
    if(state.visible.some(c=>c.h>8000))throw new Error('Unbounded product card height');
    if(state.grid.h<300)throw new Error('Collapsed product grid');
  }
  console.log('PAGE ERRORS '+JSON.stringify(issues));
  await context.close();
} finally {await browser.close()}
