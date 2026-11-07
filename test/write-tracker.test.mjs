import test from 'node:test';
import assert from 'node:assert/strict';
import { NativeWriteTracker } from '../src/desktop/write-tracker.js';
function tracker(){let clock=0,tick=()=>{};const observer=new NativeWriteTracker({contentsId:42,now:()=>clock,sleeper:async ms=>{clock+=ms;tick(clock);}});return {observer,setTick:callback=>{tick=callback;}};}
const request=(id=1,extra={})=>({id,webContentsId:42,method:'POST',resourceType:'xhr',...extra});
test('native observer waits for actual network completion, not optimistic DOM removal',async()=>{
  const {observer,setTick}=tracker();const token=observer.begin();observer.before(request());let finished=false;
  setTick(clock=>{if(clock>=1500&&!finished){finished=true;observer.complete({id:1,statusCode:200});}});
  await observer.wait(token);assert.equal(finished,true);assert.equal(token.completed,1);observer.end(token);
});
test('unrelated windows/GETs cannot acknowledge a write',async()=>{
  const {observer}=tracker();const token=observer.begin();observer.before(request(1,{webContentsId:99}));observer.before(request(2,{method:'GET'}));
  await assert.rejects(observer.wait(token),{code:'UNCERTAIN'});observer.end(token);
});
test('observer preserves explicit rejection and network uncertainty without reading bodies',async()=>{
  for(const status of [400,403,429,null]){
    const {observer}=tracker();const token=observer.begin();observer.before(request());
    if(status)observer.complete({id:1,statusCode:status});else observer.error({id:1});
    await assert.rejects(observer.wait(token),{code:status===400?'REDDIT_REJECTED':status===403?'PERMISSION':status===429?'RATELIMIT':'UNCERTAIN'});observer.end(token);
  }
});
