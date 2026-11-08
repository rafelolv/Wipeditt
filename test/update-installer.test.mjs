import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UpdateInstaller, installerTarget, verifyInstaller, createNativeUpdater, supportsIntegratedUpdates } from '../src/desktop/update-installer.js';
import { availableRelease } from '../src/desktop/updates.js';

const bytes = Buffer.from('Synthetic update bytes, not an executable.');
const release = { version:'2.0.0', preview:false, install:{name:'Wipeditt-2.0.0-win-x64.exe', size:bytes.length, digest:`sha256:${createHash('sha256').update(bytes).digest('hex')}`} };
function fixture({ allowed = true, supported = true, info, verify = async () => {} } = {}) {
  let can = allowed, downloads = 0, installs = 0, verifications = 0;
  const updater = new EventEmitter();
  updater.checkForUpdates = async () => ({updateInfo: info || {version:'2.0.0',files:[{url:release.install.name,size:bytes.length,sha2:release.install.digest.slice(7)}]}});
  updater.downloadUpdate = async () => { downloads++; updater.emit('download-progress',{percent:42}); return ['/synthetic/update.exe']; };
  updater.quitAndInstall = (...args) => { assert.deepEqual(args,[true,true]); installs++; };
  const installer = new UpdateInstaller({version:'1.0.0',platform:'win32',supported,createUpdater:()=>updater,canInstall:()=>can,verify:async (...args)=>{verifications++;await verify(...args);}});
  return {installer,updater,setAllowed:value=>{can=value;},counts:()=>({downloads,installs,verifications})};
}

test('integrated updates require complete official digest metadata and matching source', () => {
  const asset={...release.install,state:'uploaded'};
  const input={tag_name:'v2.0.0',draft:false,prerelease:false,assets:[asset,{name:'SHA256SUMS',state:'uploaded',size:100},{name:'wipeditt-source-v2.0.0.zip',state:'uploaded',size:100}]};
  assert.deepEqual(availableRelease([input],'1.0.0','win32','x64').install,release.install);
  input.assets[0].digest='bad';
  assert.equal(availableRelease([input],'1.0.0','win32','x64').install,undefined);
  assert.throws(()=>installerTarget({...release,version:'0.1.0'},'1.0.0','win32'));
  assert.throws(()=>installerTarget(release,'1.0.0','linux'));
  assert.throws(()=>installerTarget({...release,preview:true},'1.0.0','win32'));
});

test('download does not install, ordinary quit auto-install stays disabled and explicit install rechecks bytes', async () => {
  const f=fixture();
  await f.installer.download(release);
  assert.equal(f.installer.snapshot().status,'ready');
  assert.equal(f.updater.autoDownload,false);assert.equal(f.updater.autoInstallOnAppQuit,false);assert.equal(f.updater.disableDifferentialDownload,true);
  assert.deepEqual(f.counts(),{downloads:1,installs:0,verifications:1});
  f.setAllowed(false);await assert.rejects(f.installer.install(),{code:'BUSY'});
  assert.equal(f.installer.snapshot().status,'ready');
  f.setAllowed(true);await f.installer.install();
  assert.deepEqual(f.counts(),{downloads:1,installs:1,verifications:2});
});

test('unsupported packages, busy work and substituted update metadata cannot download', async () => {
  for(const options of [{supported:false},{allowed:false},{info:{version:'2.0.0',files:[{url:'https://evil.test/update.exe'}]}}]){
    const f=fixture(options);await assert.rejects(f.installer.download(release));assert.equal(f.counts().downloads,0);
  }
});

test('corrupt or replaced bytes never reach installation and install preparation locks immediately', async () => {
  let checks=0;
  const f=fixture({verify:async()=>{if(++checks===2)throw new Error('Changed bytes');}});
  await f.installer.download(release);
  const pending=f.installer.install();assert.equal(f.installer.snapshot().status,'installing');
  await assert.rejects(pending);assert.equal(f.counts().installs,0);assert.equal(f.installer.snapshot().status,'error');
  const bad=fixture({verify:async()=>{throw new Error('Corrupt');}});
  await assert.rejects(bad.installer.download(release));assert.equal(bad.installer.snapshot().status,'error');assert.equal(bad.counts().installs,0);
});

test('file verification checks actual bytes and sizes, rejecting directories and symbolic links', async () => {
  const folder=await mkdtemp(join(tmpdir(),'wipeditt-update-test-'));
  try{
    const path=join(folder,'fixture.bin');await writeFile(path,bytes);await verifyInstaller(path,release.install);
    await writeFile(path,Buffer.alloc(bytes.length));await assert.rejects(verifyInstaller(path,release.install));
    await assert.rejects(verifyInstaller(folder,release.install));
    if(process.platform!=='win32'){const link=join(folder,'link');await symlink(path,link);await assert.rejects(verifyInstaller(link,release.install));}
  }finally{await rm(folder,{recursive:true,force:true});}
});

test('native provider pins GitHub artifact paths and strips identifiers, credentials and unknown redirects', async () => {
  class Provider {constructor(runtime){this.runtime=runtime;}}
  class Native extends EventEmitter {
    constructor(options){super();this.provider=new options.updateProvider(options,this,{executor:'fixture'});this.requests=[];this.httpExecutor={createRequest:(options)=>{this.requests.push(options);const request=new EventEmitter();request.abort=()=>{request.aborted=true;};return request;}};}
  }
  const updater=createNativeUpdater({Provider,NsisUpdater:Native}, {...release.install,version:release.version},'win32');
  updater.provider.setRequestHeaders({'x-user-staging-id':'private'});
  const info=await updater.provider.getLatestVersion();
  const files=updater.provider.resolveFiles(info);
  assert.equal(files[0].url.href,'https://github.com/rafelolv/Wipeditt/releases/download/v2.0.0/Wipeditt-2.0.0-win-x64.exe');
  const request=updater.httpExecutor.createRequest({protocol:'https:',hostname:'release-assets.githubusercontent.com',headers:{Cookie:'private',Authorization:'private','x-user-staging-id':'private'}},()=>{});
  assert.equal(updater.requests[0].credentials,'omit');
  assert.deepEqual(updater.requests[0].headers,{'User-Agent':'Wipeditt-update-download',Accept:'application/octet-stream'});
  const response=new EventEmitter();request.emit('response',response);response.emit('data',Buffer.alloc(bytes.length+1));assert.equal(request.aborted,true);
  for(const options of [{protocol:'http:',hostname:'github.com'},{protocol:'https:',hostname:'evil.test'},{protocol:'https:',hostname:'github.com',port:444}])assert.throws(()=>updater.httpExecutor.createRequest(options,()=>{}));
});


test('automatic installation is limited to official package types and rejects inherited foreign AppImage environments', () => {
  assert.equal(supportsIntegratedUpdates({packaged:true,platform:'win32',arch:'x64'}),true);
  assert.equal(supportsIntegratedUpdates({packaged:false,platform:'win32',arch:'x64'}),false);
  assert.equal(supportsIntegratedUpdates({packaged:true,platform:'win32',arch:'arm64'}),false);
  const linux={packaged:true,platform:'linux',arch:'x64',appImage:'/home/user/Wipeditt.AppImage',appDir:'/tmp/mount-Wipeditt',executable:'/tmp/mount-Wipeditt/wipeditt'};
  assert.equal(supportsIntegratedUpdates(linux),true);
  assert.equal(supportsIntegratedUpdates({...linux,executable:'/opt/Wipeditt/wipeditt'}),false);
  assert.equal(supportsIntegratedUpdates({...linux,appDir:undefined}),false);
});
