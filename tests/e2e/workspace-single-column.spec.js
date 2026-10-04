const { test, expect } = require('@playwright/test');

async function assertWorkspaceStacks(page,step,expectedCount){
  await page.click('[data-step="'+step+'"]');
  const selector='#pg-'+step+' .nw-workspace-stack';
  const result=await page.locator(selector).evaluateAll(stacks=>stacks.map(el=>{
    const children=[...el.children].map(x=>x.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0);
    return{
      childCount:children.length,
      vertical:children.length<2||children.slice(1).every((r,i)=>r.top>=children[i].bottom-1),
      aligned:children.length<2||children.every(r=>Math.abs(r.left-children[0].left)<1),
      fullWidth:children.length<2||children.every(r=>Math.abs(r.width-children[0].width)<1)
    };
  }));
  expect(result.length).toBe(expectedCount);
  expect(result.every(x=>x.childCount>0)).toBe(true);
  expect(result.every(x=>x.vertical)).toBe(true);
  expect(result.every(x=>x.aligned)).toBe(true);
  expect(result.every(x=>x.fullWidth)).toBe(true);
}

test('áreas de trabajo principales se apilan en una columna sin romper grids internos', async ({page})=>{
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/index.html');

  expect(await page.locator('.nw-workspace-stack').count()).toBe(11);
  expect(await page.locator('#pg-dash > .nw-workspace-stack').count()).toBe(0);
  expect(await page.locator('#pg-wiz .nw-workspace-stack').count()).toBe(0);

  for(const [step,count] of [
    ['loc',1],
    ['dev',1],
    ['ports',1],
    ['vlan',2],
    ['hosts',1],
    ['iot',1],
    ['links',1],
    ['fw',2],
    ['cfg',1]
  ]){
    await assertWorkspaceStacks(page,step,count);
  }

  await page.click('[data-step="vlan"]');
  const layout=page.locator('#pg-vlan > .nw-workspace-stack').first();
  await expect(layout).toBeVisible();

  const before=await layout.evaluate(el=>{
    const [a,b]=[...el.children].map(x=>x.getBoundingClientRect());
    return{aBottom:a.bottom,bTop:b.top,aLeft:a.left,bLeft:b.left,aWidth:a.width,bWidth:b.width};
  });
  expect(before.bTop).toBeGreaterThanOrEqual(before.aBottom-1);
  expect(Math.abs(before.aLeft-before.bLeft)).toBeLessThan(1);
  expect(Math.abs(before.aWidth-before.bWidth)).toBeLessThan(1);

  await page.locator('#vlanListPanel summary').click();
  await page.locator('#vlanListPanel summary').click();

  const after=await layout.evaluate(el=>{
    const [a,b]=[...el.children].map(x=>x.getBoundingClientRect());
    return{aBottom:a.bottom,bTop:b.top,aLeft:a.left,bLeft:b.left,aWidth:a.width,bWidth:b.width};
  });
  expect(after.bTop).toBeGreaterThanOrEqual(after.aBottom-1);
  expect(Math.abs(after.aLeft-after.bLeft)).toBeLessThan(1);
  expect(Math.abs(after.aWidth-after.bWidth)).toBeLessThan(1);

  await page.click('[data-step="cfg"]');
  const comparison=await page.locator('#cfgOut').evaluate(el=>{
    const grid=el.closest('.g2');
    const children=[...grid.children].map(x=>x.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0);
    return{
      count:children.length,
      distinctLefts:new Set(children.map(r=>Math.round(r.left))).size
    };
  });
  expect(comparison.count).toBeGreaterThanOrEqual(2);
  expect(comparison.distinctLefts).toBeGreaterThanOrEqual(2);
});
