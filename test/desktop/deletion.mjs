import { _electron as electron } from 'playwright-core';
import executablePath from 'electron';
import { resolve, join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { verifyAnonymousDeletion } from './deleted-placeholder.mjs';
import { installFixture } from './fixture.mjs';
import { DEFAULT_REPLACEMENT } from '../../src/filters.js';
process.on('uncaughtExceptionMonitor', error => { if(process.env.GITHUB_ACTIONS==='true')console.error(`::error title=Native deletion::${String(error.stack).replaceAll('%','%25').replaceAll('\n','%0A').replaceAll('\r','%0D')}`); });
const profile=await mkdtemp(join(tmpdir(),'wipeditt-delete-fixture-'));
const env={...process.env,WIPEDITT_TEST_USER_DATA:profile,WIPEDITT_ENABLE_DELETION:'1'};delete env.ELECTRON_RUN_AS_NODE;
const args=[resolve('.')];if(process.env.CI==='true')args.push('--no-sandbox');
let application;const deadline=setTimeout(()=>{console.error('Native deletion fixture suite exceeded its 10-minute deadline.');application?.process().kill('SIGTERM');process.exitCode=1;},600000);deadline.unref();
try{
  application=await electron.launch({executablePath,args,env,timeout:30000});const page=await application.firstWindow();
  await page.locator('#connect').waitFor();await installFixture(application);await page.locator('#connect').click();
  await application.evaluate(async({webContents,session})=>{const remote=webContents.getAllWebContents().find(view=>view.session===session.fromPartition('wipeditt-reddit'));await remote.executeJavaScript('document.querySelector("#fixture-login").click()');});
  await page.locator('#account').filter({hasText:'fixture_user'}).waitFor({timeout:20000});
  const configure=async({mode='delete',type='comment',failEdit=false,failDelete=false,outcome='placeholder',delay=0,editPersists=true}={})=>{
    // Start every case from fresh synthetic content, never a real Reddit account.
    await application.evaluate((_electron,settings)=>{const f=globalThis.fixture;f.items.t1_abc.deleted=false;f.items.t1_abc.text='Disposable deletion fixture';f.items.t1_next.deleted=false;f.items.t3_post.deleted=false;f.items.t3_post.text='Disposable text post';f.items.t3_link={id:'t3_link',type:'post',author:'fixture_user',text:'',title:'Disposable link post',linkPost:true};f.writes=[];f.deletions=[];f.failWrite=settings.failEdit;f.failDelete=settings.failDelete;f.deletionOutcome=settings.outcome;f.editPersists=settings.editPersists;}, {failEdit,failDelete,outcome,editPersists});
    if(await page.locator('#change-search').isVisible())await page.locator('#change-search').click();
    await page.locator('#mode').selectOption(mode);await page.locator('#type').selectOption(type);
    await page.locator('#filters').evaluate(node=>{node.open=true;});await page.locator('#contains').fill(type==='comment'?'Disposable deletion fixture':'');
    await page.locator('#scan').click();await page.locator('#review-section').waitFor({timeout:15000});
    await page.locator('#select-none').click();
    await page.waitForFunction(() => document.getElementById('selected-count').textContent === '0');
    await page.locator(`.item[data-id="${type==='comment'?'t1_abc':'t3_post'}"] input`).check();
    if(mode!=='delete')await page.locator('#replacement').fill(DEFAULT_REPLACEMENT);
    if(mode==='combined'){
      await page.locator('#deleteDelay').evaluate(node=>{node.closest('details').open=true;});await page.locator('#deleteDelay').fill(String(delay));
    }
  };
  const confirm=async()=>{await page.locator('#review').click();await page.locator('#accept').click();};
  const finished=()=>page.locator('#finished').waitFor({timeout:45000});
  await configure();assert.equal(await page.locator('#replacement-content').isVisible(),false);
  await page.locator('#review').click();assert.equal(await page.locator('#confirmation-replacement').isVisible(),false);
  assert.match(await page.locator('#confirmation-warning').textContent(),/irreversible/);await page.keyboard.press('Escape');
  assert.equal(await application.evaluate(()=>globalThis.fixture.deletions.length),0);
  await confirm();await finished();assert.equal(await application.evaluate(()=>globalThis.fixture.items.t1_abc.deleted),true);assert.match(await page.locator('#finished-summary').textContent(),/1 deleted/);
  await verifyAnonymousDeletion(application);
  await configure({type:'post'});await confirm();await finished();assert.equal(await application.evaluate(()=>globalThis.fixture.items.t3_post.deleted),true);
  await configure({type:'post'});await page.locator('#select-none').click();await page.waitForFunction(() => document.getElementById('selected-count').textContent === '0');await page.locator('.item[data-id="t3_link"] input').check();await confirm();await finished();assert.equal(await application.evaluate(()=>globalThis.fixture.items.t3_link.deleted),true);
  await configure({mode:'combined'});await confirm();await finished();
  assert.deepEqual(await application.evaluate(()=>({edits:globalThis.fixture.writes.length,deletes:globalThis.fixture.deletions.length})),{edits:1,deletes:1});
  assert.equal(await application.evaluate(()=>globalThis.fixture.writes[0].text),DEFAULT_REPLACEMENT);
  await configure({mode:'combined',type:'post'});
  assert.equal(await page.locator('.item[data-id="t3_link"] input').isDisabled(),true);
  await confirm();await finished();assert.equal(await application.evaluate(()=>globalThis.fixture.items.t3_post.deleted),true);
  console.log('Direct comment, text/link post deletion and combined comment/text post verification passed.');
  for(const mode of ['delete','combined']){
    await configure({mode,outcome:'empty'});await confirm();await finished();
    assert.match(await page.locator('#finished-summary').textContent(),/1 deleted/);
    assert.equal(await application.evaluate(()=>globalThis.fixture.deletions.length),1);
  }
  console.log('Leaf comment deletion verified from completed native action and repeated focused empty originals.');
  await configure({mode:'combined',failEdit:true});await confirm();await finished();assert.equal(await application.evaluate(()=>globalThis.fixture.deletions.length),0);
  await configure({mode:'combined',failDelete:true});await confirm();await finished();assert.match(await page.locator('#finished-summary').textContent(),/1 partial/);
  assert.equal(await application.evaluate(()=>globalThis.fixture.writes.length),1);assert.equal(await application.evaluate(()=>globalThis.fixture.deletions.length),0);
  await configure({mode:'combined',delay:60000});await confirm();await page.locator('#progress-counts').filter({hasText:'waiting'}).waitFor({timeout:30000});await page.locator('#stop').click();await finished();assert.match(await page.locator('#finished-summary').textContent(),/partial/);assert.equal(await application.evaluate(()=>globalThis.fixture.deletions.length),0);
  await configure({outcome:'missing'});await confirm();await finished();assert.match(await page.locator('#finished-summary').textContent(),/uncertain/);assert.equal(await application.evaluate(()=>globalThis.fixture.deletions.length),1);
  assert.match(await page.locator('#finished-title').textContent(),/Some items need review/);assert.equal(await page.locator('#finished-help').isVisible(),true);assert.equal(await page.locator('#finished-mark').textContent(),'!');
  await configure({mode:'combined',editPersists:false});await confirm();await finished();
  assert.match(await page.locator('#finished-summary').textContent(),/uncertain/);
  assert.equal(await application.evaluate(()=>globalThis.fixture.writes.length),1);
  assert.equal(await application.evaluate(()=>globalThis.fixture.deletions.length),0);
  assert.equal(await page.locator('#inspect-original').isVisible(),true);
  await page.locator('#refresh-results').click();await page.locator('#review-section').waitFor({timeout:15000});
  assert.equal(await application.evaluate(()=>globalThis.fixture.writes.length),1);
  assert.equal(await page.locator('#finished').isVisible(),false);
  await page.locator('.tools').evaluate(node=>{node.open=true;});assert.equal(await page.locator('#report').isEnabled(),true);
  console.log('Native deletion passed: comment/text/link posts, native confirmation/cancel, verified original placeholders, combined order, edit rejection, partial failure, stop after edit and missing-page uncertainty without replay. All content was synthetic.');
}finally{await application?.close();clearTimeout(deadline);await rm(profile,{recursive:true,force:true});}
