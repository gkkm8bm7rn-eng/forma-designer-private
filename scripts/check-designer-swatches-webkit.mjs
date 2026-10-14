import assert from 'node:assert/strict';
import {webkit,devices} from 'playwright';

/* Regression check for the approved iPhone Pearl Linen storefront.
 * Runs on the REAL catalog-index.json in the existing local WebKit server.
 * No remote orders or outside writes; only ephemeral browser state.
 */
const browser=await webkit.launch({headless:true});
try{
  for(const width of [320,375,390,430]){
    const context=await browser.newContext({
      ...devices['iPhone 13'],viewport:{width,height:844},serviceWorkers:'allow'
    });
    const page=await context.newPage();
    const pageErrors=[];
    page.on('pageerror',error=>pageErrors.push(error.message));
    await page.goto('http://127.0.0.1:8765/?tetopt_internal=on',{
      waitUntil:'domcontentloaded',timeout:45000
    });
    await page.locator('#productGrid .product-card').first().waitFor({timeout:45000});
    await page.waitForFunction(()=>document.querySelectorAll('#productGrid .product-card').length===24,
      null,{timeout:45000});
    const initial=await page.evaluate(()=>{
      const slots=innerWidth<=359?6:8;
      const product=state.products.find(p=>{
        if(!p.variants||p.variants.length<9||axisModel(p))return false;
        const colors=choiceOptions(p,currentVariant(p,p._selected));
        return colors.length>slots&&colors.every(o=>o.presentation.colors.length>0);
      });
      if(!product)return{error:'No multi-color non-axis product exists in real catalog'};
      product._selected=product.variants.at(-1).sourceId;
      const html=cardTemplate(product);
      const fixture=document.createElement('div');
      fixture.innerHTML=html;
      const card=fixture.firstElementChild;
      document.getElementById('productGrid').prepend(card);
      const colors=card.querySelector('.card-variants--two-rows');
      const buttons=[...colors.querySelectorAll('button')];
      const bounds=buttons.map(e=>{
        const r=e.getBoundingClientRect();
        return{x:r.x,y:r.y,width:r.width,height:r.height};
      });
      const computed=getComputedStyle(colors);
      const swatch=colors.querySelector('.card-swatch');
      const swatchStyle=getComputedStyle(swatch);
      const more=colors.querySelector('.card-variants-more');
      const photo=getComputedStyle(card.querySelector('.product-image-stage')).backgroundColor;
      const buttonBackground=getComputedStyle(card.querySelector('.quick-add')).backgroundColor;
      const container=card.querySelector('.product-info').getBoundingClientRect();
      const price=card.querySelector('.product-bottom').getBoundingClientRect();
      const swatchArea=colors.getBoundingClientRect();
      return{
        productId:product.id,productName:product.name,totalOptions:choiceOptions(product,currentVariant(product,product._selected)).length,
        slots,viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
        buttonCount:buttons.length,swatchCount:colors.querySelectorAll('.card-swatch').length,
        moreText:more?.textContent||'',moreId:more?.dataset.open,
        activeCount:colors.querySelectorAll('.card-swatch.active').length,
        gridColumns:computed.gridTemplateColumns,
        rows:[...new Set(bounds.map(b=>Math.round(b.y)))].length,
        allThirty:bounds.every(b=>b.width>=29.5&&b.height>=29.5),
        innerColorDiameter:parseFloat(swatchStyle.width)-2*parseFloat(swatchStyle.borderLeftWidth),
        noOverflow:bounds.every(b=>b.x>=container.x-1&&b.x+b.width<=container.right+1),
        footerBelowPalette:price.top>=swatchArea.bottom-1,
        photo,buttonBackground,
        selectedSourceId:String(product._selected)
      };
    });
    assert.ok(!initial.error,JSON.stringify(initial));
    assert.equal(initial.slots,width<=359?6:8);
    assert.equal(initial.buttonCount,initial.slots);
    assert.equal(initial.swatchCount,initial.slots-1);
    assert.equal(initial.rows,2,'Palette must have at most two rows');
    assert.equal(initial.gridColumns.trim().split(/\s+/).length,width<=359?3:4);
    assert.ok(initial.allThirty,'Tap areas smaller than 30px: '+JSON.stringify(initial));
    assert.ok(Math.abs(initial.innerColorDiameter-22)<.6,'Color circle should be ~22px');
    assert.equal(initial.moreId,initial.productId);
    assert.equal(initial.activeCount,1);
    assert.ok(initial.noOverflow,'Color palette overflows the card');
    assert.ok(initial.footerBelowPalette,'Price overlaps color palette');
    assert.equal(initial.photo,'rgb(255, 255, 255)');
    assert.equal(initial.buttonBackground,'rgb(61, 66, 70)');
    assert.ok(initial.scrollWidth<=initial.viewport+2,'Full page overflows the viewport');

    const selected=await page.evaluate(()=>{
      const card=document.querySelector('#productGrid .product-card');
      const btn=card.querySelector('.card-swatch:not(.active)');
      const chosen=String(btn.dataset.cardVariant);
      btn.click();
      const product=state.products.find(p=>p.id===btn.dataset.product);
      return{chosen,actual:String(product?._selected),active:document.querySelector('#productGrid .product-card .card-swatch.active')?.dataset.cardVariant};
    });
    assert.equal(selected.chosen,selected.actual,'Selecting swatch did not update variant');
    assert.equal(selected.active,selected.actual,'Selected swatch not visible after rerender');

    await page.locator('#productGrid .product-card').first().locator('.card-variants-more').click();
    await page.locator('.product-dialog[open]').waitFor({timeout:30000});
    await page.waitForFunction(()=>document.querySelectorAll('.product-dialog[open] .variant-swatch-option').length>8,
      null,{timeout:30000});
    const count=await page.locator('.product-dialog[open] .variant-swatch-option').count();
    assert.equal(count,initial.totalOptions,'+N did not show all real color variants');
    assert.deepEqual(pageErrors,[],'Unexpected browser JS errors');
    console.log('PASS: Pearl Linen designer swatches / WebKit '+width+'px '+JSON.stringify({
      product:initial.productName,colors:initial.totalOptions,
      columns:initial.gridColumns,rows:initial.rows,
      tapSize:30,colorSize:initial.innerColorDiameter,detailOptions:count
    }));
    await context.close();
  }
}finally{
  await browser.close();
}
