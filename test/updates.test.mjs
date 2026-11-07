import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { availableRelease, compareVersions, parseVersion, UpdateChecker } from '../src/desktop/updates.js';

const release = (version, changes = {}) => ({ tag_name: `v${version}`, draft: false, prerelease: true, html_url: 'https://evil.test/', assets: [{ name: `Wipeditt-${version}-linux-x86_64.AppImage`, state: 'uploaded', size: 100 }, { name: 'SHA256SUMS', state: 'uploaded', size: 100 }], ...changes });
test('updates compare semantic versions including prereleases and reject malformed versions', () => {
  for (const [a,b] of [['0.10.0','0.9.9'],['1.0.0','1.0.0-rc.2'],['1.0.0-rc.10','1.0.0-rc.2'],['1.0.0-beta','1.0.0-alpha.1']]) assert.equal(compareVersions(a,b), 1);
  assert.equal(compareVersions('v1.0.0+build','1.0.0'),0);
  for (const value of ['v01.0.0','1.2','1.0.0-01','javascript:alert(1)','1.2.9999999999999999999999']) assert.equal(parseVersion(value),null);
});
test('updates include published desktop previews and use only the official release URL', () => {
  const result=availableRelease([release('0.6.0'),release('0.10.0'),release('0.9.0')], '0.5.0','linux','x64');
  assert.deepEqual(result,{version:'0.10.0',preview:true,url:'https://github.com/rafelolv/Wipeditt/releases/tag/v0.10.0'});
  assert.equal(availableRelease([release('0.5.0'),release('0.4.0')],'0.5.0','linux','x64'),null);
});
test('updates reject drafts, missing checksums, incomplete uploads and wrong platform packages', () => {
  for (const changes of [{draft:true},{tag_name:'v9.9.9/../../evil'},{assets:[]},{assets:[{name:'SHA256SUMS',state:'uploaded',size:100}]},{assets:[{name:'Wipeditt-0.6.0-linux-x86_64.AppImage',state:'new',size:0},{name:'SHA256SUMS',state:'uploaded',size:100}]}]) assert.equal(availableRelease([release('0.6.0',changes)],'0.5.0','linux','x64'),null);
  assert.equal(availableRelease([release('0.6.0')],'0.5.0','win32','x64'),null);
  assert.equal(availableRelease([release('0.6.0')],'0.5.0','linux','arm64'),null);
  assert.equal(availableRelease([release('0.6.0')],'0.5.0','darwin','x64'),null);
});
test('stable installations do not advertise preview builds', () => {
  assert.equal(availableRelease([release('2.0.0')],'1.0.0','linux','x64'),null);
  assert.equal(availableRelease([release('2.0.0',{prerelease:false})],'1.0.0','linux','x64')?.version,'2.0.0');
});
test('update checks deduplicate, throttle repeated requests and keep last good result on failure', async () => {
  let clock=0,calls=0,reject=false;
  const checker=new UpdateChecker({version:'0.5.0',platform:'linux',arch:'x64',now:()=>clock,request:async()=>{calls++;if(reject)throw new Error('offline');return [release('0.6.0')];}});
  await Promise.all([checker.check(),checker.check({manual:true})]); assert.equal(calls,1);
  await checker.check({manual:true});assert.equal(calls,1);
  clock=60001;reject=true;await checker.check({manual:true});
  assert.equal(calls,2);assert.equal(checker.snapshot().status,'error');assert.equal(checker.snapshot().available.version,'0.6.0');
  clock+=3600000;await checker.check();assert.equal(calls,2);
});
test('disabled automatic checks make no request and persist independently of Reddit checkpoints', async () => {
  const folder=mkdtempSync(join(tmpdir(),'wipeditt-updates-'));
  try {
    const settingsPath=join(folder,'updates.json');let calls=0;
    const options={version:'0.5.0',settingsPath,request:async()=>{calls++;return [];}};
    const checker=new UpdateChecker(options);checker.setEnabled(false);await checker.check();assert.equal(calls,0);
    assert.equal(new UpdateChecker(options).snapshot().enabled,false);
    await checker.check({manual:true});assert.equal(calls,1);assert.equal(checker.snapshot().status,'current');
  } finally {rmSync(folder,{recursive:true,force:true});}
});
test('malformed or synchronous failed release checks remain retryable', async () => {
  let clock=1;
  const checker=new UpdateChecker({version:'0.5.0',now:()=>clock,request:()=>{throw new Error('offline');}});
  await checker.check();assert.equal(checker.snapshot().status,'error');
  checker.request=async()=>({invalid:true});clock+=60001;await checker.check({manual:true});assert.equal(checker.snapshot().status,'error');
  checker.request=async()=>[];clock+=60001;await checker.check({manual:true});assert.equal(checker.snapshot().status,'current');
});
