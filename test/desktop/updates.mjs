import assert from 'node:assert/strict';
export async function verifyUpdateNotice(application, page) {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await application.evaluate(({ shell }) => {
    const https=process.getBuiltinModule('node:https');
    const { EventEmitter }=process.getBuiltinModule('node:events');
    const { Readable }=process.getBuiltinModule('node:stream');
    globalThis.updateFixture={requests:0,opened:[]};
    https.get=(url,options,callback)=>{
      if(url!=='https://api.github.com/repos/rafelolv/Wipeditt/releases?per_page=20')throw new Error('Unexpected update host');
      if(Object.keys(options.headers).some(key=>/cookie|authorization/i.test(key)))throw new Error('Credential sent by update checker');
      globalThis.updateFixture.requests++;
      const request=new EventEmitter(); request.destroy=error=>{if(error)request.emit('error',error);request.emit('close');};
      globalThis.updateFixture.respond=()=>{
        const response=Readable.from([Buffer.from(JSON.stringify([{tag_name:'v9.0.0',draft:false,prerelease:false,html_url:'https://evil.test/',assets:[{name:`Wipeditt-9.0.0-${process.platform==='linux'?'linux-x86_64.AppImage':'win-x64.exe'}`,state:'uploaded',size:100},{name:'SHA256SUMS',state:'uploaded',size:100}]}]))]);
        response.statusCode=200;response.on('end',()=>request.emit('close'));callback(response);
      };
      return request;
    };
    shell.openExternal=async url=>{globalThis.updateFixture.opened.push(url);};
  });
  await page.locator('.tools').evaluate(node=>{node.open=true;});
  await page.locator('#automatic-updates').uncheck();
  await page.locator('.tools').evaluate(node=>{node.open=false;});
  assert.equal(await page.locator('#check-updates').isVisible(),true);
  await page.locator('#check-updates').click();
  await page.waitForFunction(()=>document.getElementById('check-updates').getAttribute('aria-busy')==='true');
  assert.equal(await page.locator('#check-updates').isDisabled(),true);
  assert.equal(await page.locator('#check-updates').textContent(),'Checking…');
  const spinner=()=>page.locator('#check-updates').evaluate(node=>getComputedStyle(node,'::before').animationName);
  assert.equal(await spinner(),'update-spin');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await spinner(),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  assert.equal(await spinner(),'update-spin');
  await application.evaluate(()=>globalThis.updateFixture.respond());
  await page.locator('#update-title').filter({hasText:'9.0.0'}).waitFor();
  assert.equal(await page.locator('#check-updates').getAttribute('aria-busy'),'false');
  assert.equal(await page.locator('#check-updates').getAttribute('data-state'),'available');
  assert.equal(await page.locator('#check-updates').isEnabled(),true);
  assert.equal(await page.locator('#update-notice').isVisible(),true);
  await page.locator('#open-update').click();
  assert.deepEqual(await application.evaluate(()=>globalThis.updateFixture.opened),['https://github.com/rafelolv/Wipeditt/releases/tag/v9.0.0']);
  await page.locator('#check-updates').click();
  assert.equal(await application.evaluate(()=>globalThis.updateFixture.requests),1);
  await page.locator('.tools').evaluate(node=>{node.open=false;});
  await page.emulateMedia({reducedMotion:null});
  console.log('Update notice passed: fixed GitHub metadata, no credentials, published version label, manual check with automatic checks disabled, throttling and official release link.');
}
