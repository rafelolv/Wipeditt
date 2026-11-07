import assert from 'node:assert/strict';
export async function verifyUpdateNotice(application, page) {
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
      process.nextTick(()=>{
        const response=Readable.from([Buffer.from(JSON.stringify([{tag_name:'v0.99.0',draft:false,prerelease:true,html_url:'https://evil.test/',assets:[{name:`Wipeditt-0.99.0-${process.platform==='linux'?'linux-x86_64.AppImage':process.platform==='win32'?'win-x64.exe':`mac-${process.arch}.dmg`}`,state:'uploaded',size:100},{name:'SHA256SUMS',state:'uploaded',size:100}]}]))]);
        response.statusCode=200;response.on('end',()=>request.emit('close'));callback(response);
      });
      return request;
    };
    shell.openExternal=async url=>{globalThis.updateFixture.opened.push(url);};
  });
  await page.locator('.tools').evaluate(node=>{node.open=true;});
  await page.locator('#automatic-updates').uncheck();
  await page.locator('#check-updates').click();
  await page.locator('#update-title').filter({hasText:'0.99.0'}).waitFor();
  assert.equal(await page.locator('#update-notice').isVisible(),true);
  await page.locator('#open-update').click();
  assert.deepEqual(await application.evaluate(()=>globalThis.updateFixture.opened),['https://github.com/rafelolv/Wipeditt/releases/tag/v0.99.0']);
  await page.locator('#check-updates').click();
  assert.equal(await application.evaluate(()=>globalThis.updateFixture.requests),1);
  await page.locator('.tools').evaluate(node=>{node.open=false;});
  console.log('Update notice passed: fixed GitHub metadata, no credentials, preview label, manual check with automatic checks disabled, throttling and official release link.');
}
