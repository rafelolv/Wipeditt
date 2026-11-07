import assert from 'node:assert/strict';
import {redditPage} from '../../src/desktop/page.js';
export async function verifyAnonymousDeletion(application){
  const results=await application.evaluate(async({webContents,session},driver)=>{
    const remote=webContents.getAllWebContents().find(view=>view.session===session.fromPartition('wipeditt-reddit'));
    const execute=(id,nativeDeleteReceipt=false)=>remote.executeJavaScriptInIsolatedWorld(1001,[{code:`(${driver})('get',{id:${JSON.stringify(id)},nativeDeleteReceipt:${nativeDeleteReceipt},expected:{id:'reddit:fixture_user',name:'fixture_user'}})`}]);
    const positive=await execute('t1_abc'),wrongTarget=await execute('t1_other');
    await remote.executeJavaScript('globalThis.proofCopy=document.querySelector(".commentarea .thing.deleted").cloneNode(true);document.querySelector(".commentarea .sitetable").append(globalThis.proofCopy);');
    const ambiguous=await execute('t1_abc');
    await remote.executeJavaScript('globalThis.proofCopy.remove();delete globalThis.proofCopy;document.querySelector(".commentarea .thing.deleted").classList.remove("deleted");');
    const noMarker=await execute('t1_abc');
    await remote.executeJavaScript('document.querySelector(".commentarea .thing").classList.add("deleted");history.replaceState(null,"",location.pathname+"?context=3");');
    const wrongContext=await execute('t1_abc');
    await remote.executeJavaScript('history.replaceState(null,"",location.pathname+"?context=0");');
    await remote.executeJavaScript('globalThis.proofPath=location.pathname;history.replaceState(null,"","/user/fixture_user/comments/post/fixture/abc/?context=0");');
    const profile=await execute('t1_abc');
    await remote.executeJavaScript('history.replaceState(null,"",globalThis.proofPath+"?context=0");delete globalThis.proofPath;document.querySelector(".commentarea .thing.deleted").id="thing_t1_abc";document.querySelector(".commentarea .thing.deleted").dataset.fullname="t1_other";');
    const idConflict=await execute('t1_abc');
    await remote.executeJavaScript('const root=document.querySelector(".commentarea .thing.deleted");root.removeAttribute("id");delete root.dataset.fullname;');
    await remote.executeJavaScript('globalThis.deletedRoot=document.querySelector(".commentarea .thing.deleted");globalThis.deletedRoot.remove();globalThis.emptyMarker=document.createElement("p");globalThis.emptyMarker.id="noresults";globalThis.emptyMarker.className="error";globalThis.emptyMarker.textContent="there does not seem to be anything here";document.querySelector(".commentarea .sitetable").append(globalThis.emptyMarker);');
    const emptyWithoutReceipt=await execute('t1_abc'),emptyWithReceipt=await execute('t1_abc',true),emptyWrongTarget=await execute('t1_other',true);
    await remote.executeJavaScript('globalThis.emptyMarker.remove();');
    const emptyNoMarker=await execute('t1_abc',true);
    await remote.executeJavaScript('document.querySelector(".commentarea .sitetable").append(globalThis.emptyMarker);document.querySelector(".content > .linklisting .thing").dataset.fullname="t3_other";');
    const emptyWrongParent=await execute('t1_abc',true);
    await remote.executeJavaScript('document.querySelector(".content > .linklisting .thing").dataset.fullname="t3_post";globalThis.emptyMarker.remove();document.querySelector(".commentarea .sitetable").append(globalThis.deletedRoot);delete globalThis.deletedRoot;delete globalThis.emptyMarker;');
    return {positive,profile,idConflict,wrongTarget,ambiguous,noMarker,wrongContext,emptyWithoutReceipt,emptyWithReceipt,emptyWrongTarget,emptyNoMarker,emptyWrongParent};
  },redditPage.toString());
  assert.equal(results.positive.data.deleted,true);assert.equal(results.profile.data.deleted,true);assert.equal(results.positive.data.evidence,'focused-deleted-placeholder');
  for(const name of ['wrongTarget','ambiguous','noMarker','wrongContext','idConflict'])assert.equal(results[name].error.code,'CONTENT_UNAVAILABLE',name);
  assert.equal(results.emptyWithReceipt.data.evidence,'native-delete-focused-empty-thread');
  for(const name of ['emptyWithoutReceipt','emptyWrongTarget','emptyNoMarker','emptyWrongParent'])assert.equal(results[name].error.code,'CONTENT_UNAVAILABLE',name);
}
