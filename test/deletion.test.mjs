import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,item,run} from './helpers.mjs';
import {AppError} from '../src/errors.js';
import {normalizeOptions,eligibility} from '../src/filters.js';
import {RedditBrowser} from '../src/desktop/reddit-browser.js';
import {deletionCapability} from '../src/desktop/capabilities.js';
import {makeReport} from '../src/report.js';

test('production deletion stays gated; only explicit development testing enables it',()=>{
  assert.equal(deletionCapability({packaged:true,developmentFlag:'1'}),false);
  assert.equal(deletionCapability({packaged:false,developmentFlag:'1'}),true);
  assert.equal(deletionCapability({packaged:false,developmentFlag:'0'}),false);
});
test('delete needs no replacement; combined requires editable and deletable content',()=>{
  assert.equal(normalizeOptions({mode:'delete',replacement:''}).replacement,'');
  assert.throws(()=>normalizeOptions({mode:'combined',replacement:''}));
  const account={id:item().authorId,name:item().author};
  assert.equal(eligibility(item({editable:false,deletable:true}),account,'delete'),'');
  assert.ok(eligibility(item({editable:false,deletable:true}),account,'combined'));
  assert.ok(eligibility(item({editable:true,deletable:false}),account,'combined'));
});
test('combined reports verified anonymization separately from explicit failed deletion',async()=>{
  const {engine,adapter,scheduler}=setup();
  adapter.delete=async()=>{throw new AppError('REDDIT_REJECTED','Rejected',{status:400});};
  const result=await run(engine,{mode:'combined'});
  assert.equal(result.records[0].state,'partial');
  assert.deepEqual(result.records[0].steps,{anonymize:'verified',delete:'failed'});
  const report=makeReport(result,'1.0.0',scheduler.stats);
  assert.equal(report.counts.partial,1);assert.equal(report.stages[0].steps.anonymize,'verified');
});
test('combined uncertain deletion preserves the verified edit and is not replayed',async()=>{
  const {engine,adapter}=setup();let attempts=0;
  adapter.delete=async()=>{attempts++;throw new AppError('UNCERTAIN','Unknown',{fatal:true});};
  const result=await run(engine,{mode:'combined'});
  assert.equal(attempts,1);assert.equal(result.records[0].state,'uncertain');
  assert.deepEqual(result.records[0].steps,{anonymize:'verified',delete:'uncertain'});
});
function native(outcome='deleted'){
  const {scheduler}=setup();let writes=0,reads=0;const operations=[];
  const browser=new RedditBrowser({contents:{},scheduler,deletionEnabled:true,now:scheduler.now,sleeper:scheduler.sleeper});
  browser.getRaw=async()=>{reads++;if(reads>1&&outcome==='missing')throw new AppError('CONTENT_UNAVAILABLE','Missing');return item({deleted:reads>1&&outcome==='deleted'});};
  browser.dom=async operation=>{operations.push(operation);if(operation==='submit-delete')writes++;return {settled:true};};
  return {browser,operations,writes:()=>writes,reads:()=>reads};
}
test('native deletion requires fresh original verification, not a disappearing UI',async()=>{
  for(const outcome of ['deleted','missing','unchanged']){
    const {browser,writes,reads,operations}=native(outcome);
    const task=browser.delete(item().id,{id:item().authorId,name:item().author},undefined,{beforeDispatch:()=>{}});
    if(outcome==='deleted')await task;else await assert.rejects(task,{code:'UNCERTAIN'});
    assert.equal(writes(),1);assert.equal(reads(),2);assert.deepEqual(operations,['prepare-delete','submit-delete','delete-status']);
  }
});
test('native combined refuses deletion when verified replacement changed',async()=>{
  const {browser,writes}=native();
  await assert.rejects(browser.delete(item().id,{id:item().authorId,name:item().author},'Changed text'),{code:'EDIT_CHANGED'});
  assert.equal(writes(),0);
});
test('native delete gate refuses a write before any browser interaction',async()=>{
  const {browser,operations}=native();browser.deletionEnabled=false;
  await assert.rejects(browser.delete(item().id,{}),{code:'DELETION_UNVERIFIED'});assert.deepEqual(operations,[]);
});

test('explicit native throttling retries from fresh preflight and verifies once',async()=>{
  const {scheduler}=setup();let attempts=0,confirmed=false,reads=0;
  const browser=new RedditBrowser({contents:{},scheduler,deletionEnabled:true,now:scheduler.now,sleeper:scheduler.sleeper});
  browser.getRaw=async()=>{reads++;return item({deleted:confirmed});};
  browser.dom=async operation=>{
    if(operation==='submit-delete')attempts++;
    if(operation==='delete-status'){
      if(attempts===1)throw new AppError('RATELIMIT','Wait',{status:429,retryAfterMs:1000});
      confirmed=true;return {settled:true};
    }
    return {};
  };
  await browser.delete(item().id,{id:item().authorId,name:item().author});
  assert.equal(attempts,2);assert.equal(reads,3);assert.equal(scheduler.stats.retries,1);
});
test('combined edit failures skip deletion explicitly in stage reports',async()=>{
  const {engine,adapter}=setup();adapter.edit=async()=>{throw new AppError('REDDIT_REJECTED','Rejected',{status:400});};
  const result=await run(engine,{mode:'combined'});
  assert.deepEqual(result.records[0].steps,{anonymize:'failed',delete:'skipped'});
});

test('an uncertain edit halts the combined batch before any later item or deletion',async()=>{
  const {engine,adapter}=setup([item(),item({id:'t1_later'})]);let deletions=0;
  adapter.edit=async()=>{};adapter.delete=async()=>{deletions++;};
  const result=await run(engine,{mode:'combined'});
  assert.equal(result.stopped,true);assert.equal(result.records.length,1);assert.equal(result.records[0].state,'uncertain');assert.equal(deletions,0);
  assert.deepEqual(result.records[0].steps,{anonymize:'uncertain',delete:'skipped'});
});
