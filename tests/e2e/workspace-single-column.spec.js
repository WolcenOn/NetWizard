const { test, expect } = require('@playwright/test');

test('áreas de trabajo principales se apilan en una columna sin romper grids internos', async ({page})=>{
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/index.html');

  const report=await page.evaluate(()=>{
    const stacks=[...document.querySelectorAll('.nw-workspace-stack')].map(el=>{
      const style=getComputedStyle(el);
      const children=[...el.children].map(x=>x.getBoundingClientRect());
      return{
        id:el.closest('.pg')?.id||'',
        tracks:style.gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length,
        vertical:children.length<2||children.slice(1).every((r,i)=>r.top>=children[i].bottom-1),
        aligned:children.length<2||children.every(r=>Math.abs(r.left-children[0].left)<1)
      };
    });
    const nested=document.querySelector('#portModal .g2');
    return{
      stacks,
      nestedTracks:nested?getComputedStyle(nested).gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length:0,
      dashboardStacked:!!document.querySelector('#pg-dash > .nw-workspace-stack'),
      wizardStacked:!!document.querySelector('#pg-wiz .nw-workspace-stack')
    };
  });

  expect(report.stacks.length).toBe(11);
  expect(report.stacks.every(x=>x.tracks===1)).toBe(true);
  expect(report.stacks.every(x=>x.vertical)).toBe(true);
  expect(report.stacks.every(x=>x.aligned)).toBe(true);
  expect(report.nestedTracks).toBeGreaterThanOrEqual(2);
  expect(report.dashboardStacked).toBe(false);
  expect(report.wizardStacked).toBe(false);

  await page.click('[data-step="vlan"]');
  const layout=page.locator('#pg-vlan > .nw-workspace-stack').first();
  await expect(layout).toBeVisible();

  const before=await layout.evaluate(el=>{
    const [a,b]=[...el.children].map(x=>x.getBoundingClientRect());
    return{aBottom:a.bottom,bTop:b.top,aLeft:a.left,bLeft:b.left};
  });
  expect(before.bTop).toBeGreaterThanOrEqual(before.aBottom-1);
  expect(Math.abs(before.aLeft-before.bLeft)).toBeLessThan(1);

  await page.locator('#vlanListPanel summary').click();
  await page.locator('#vlanListPanel summary').click();

  const after=await layout.evaluate(el=>{
    const [a,b]=[...el.children].map(x=>x.getBoundingClientRect());
    return{aBottom:a.bottom,bTop:b.top,aLeft:a.left,bLeft:b.left};
  });
  expect(after.bTop).toBeGreaterThanOrEqual(after.aBottom-1);
  expect(Math.abs(after.aLeft-after.bLeft)).toBeLessThan(1);

  const configComparison=await page.evaluate(()=>{
    const el=document.querySelector('#cfgOut')?.closest('.g2');
    return el?getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length:0;
  });
  expect(configComparison).toBeGreaterThanOrEqual(2);
});
