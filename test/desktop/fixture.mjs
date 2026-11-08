// Entirely local HTTPS fixture: production still uses Reddit's own DOM controls.
export async function installFixture(application) {
  await application.evaluate(({ session }) => {
    globalThis.fixture = {
      signedIn:false, username:'fixture_user', writes:[], deletions:[], navigations:[], historyPages:[], failWrite:false, failDelete:false, deletionOutcome:'placeholder', deletionLag:250, editLag:250, editPersists:true,
      items:{
        t1_abc:{id:'t1_abc',author:'fixture_user',text:'A synthetic comment. Wipeditt should change only selected own content.',type:'comment',dataAuthor:false},
        t1_other:{id:'t1_other',author:'another_user',text:'Someone else wrote this fixture. Never edit it.',type:'comment'},
        t1_next:{id:'t1_next',author:'fixture_user',text:'An older synthetic comment on the next page.',type:'comment',authorLink:false},
        t3_post:{id:'t3_post',author:'fixture_user',text:'A synthetic editable text-post body.',type:'post'}
      }
    };
    const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
    const markdown=value=>escape(value).replace(/\[([^\]\n]+)\]\((https:\/\/[^)\s]+)\)/g,'<a href="$2">$1</a>').replaceAll('\n','<br>');
    const permalink=item=>item.type==='post'?`/r/privacy/comments/${item.id.slice(3)}/fixture/`:`/r/privacy/comments/post/fixture/${item.id.slice(3)}/`;
    const itemHTML=(item,listing=false)=>{
      const author=escape(item.deleted?'[deleted]':item.author);
      const missing=listing&&item.id==='t1_next';
      const declared=missing||item.dataAuthor===false||item.deleted?'':` data-author="${author}"`;
      const profile=missing?'':item.deleted?`<em>${author}</em>`:item.authorLink===false?`<span class="author">${author}</span>`:`<a class="author" href="https://old.reddit.com/user/${author}/">${author}</a>`;
      const owner=!missing&&!item.deleted&&item.author===globalThis.fixture.username;
      const editable=owner&&!item.linkPost;
      const body=item.deleted?'[deleted]':item.text;
      return `<div class="thing ${item.type==='post'?`link ${item.linkPost?'':'self'}`:'comment'} ${item.deleted?'deleted':''}" ${item.deleted?'':`data-fullname="${item.id}"`}${declared} data-subreddit="privacy" data-score="8"><div class="entry"><p class="tagline">${profile} · <time datetime="2024-06-01T12:00:00Z">a while ago</time><span class="score" title="8">8 points</span><a class="subreddit" href="/r/privacy/">r/privacy</a></p>${item.type==='post'?`<a class="title">${item.deleted?'[deleted]':escape(item.title||'Synthetic post')}</a>`:''}<form class="usertext"><div class="usertext-body"><div class="md">${markdown(body)}</div></div>${editable?`<div class="usertext-edit" style="display:none"><textarea name="text">${escape(item.text)}</textarea><button type="submit" class="save">save</button><p class="error" style="display:none"></p></div>`:''}</form><ul class="flat-list buttons"><li><a class="bylink" href="${permalink(item)}">permalink</a></li>${editable?'<li><a class="edit-usertext" href="#">edit</a></li>':''}${owner?'<li><form class="toggle del-button" action="#"><span class="option main active"><a class="togglebutton" data-event-action="delete" href="#">delete</a></span><span class="option error" style="display:none">are you sure? <a class="yes" href="#">yes</a> / <a class="no" href="#">no</a></span><p class="error deletion-error" style="display:none"></p></form></li>':''}</ul></div></div>`;
    };
    const page=body=>`<!doctype html><html><head><meta charset="utf-8"><title>Reddit native fixture</title><style>body{font:14px system-ui;background:white;color:#202020;padding:18px}.thing{padding:15px;border-bottom:1px solid #ccc}.buttons{display:flex;gap:20px}.usertext-edit textarea{display:block;width:500px;height:100px}#header-bottom-right{text-align:right}.error{color:#a00}</style></head><body><div id="header-bottom-right"><span class="user">${globalThis.fixture.signedIn?`<a href="https://old.reddit.com/user/${globalThis.fixture.username}/">${globalThis.fixture.username}</a>`:'<a href="https://www.reddit.com/login/">log in</a>'}</span></div>${body}<script>
    document.querySelectorAll('.edit-usertext').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();const node=button.closest('.thing');node.querySelector('.usertext-edit').style.display='block';node.querySelector('.usertext-body').style.display='none';}));
    document.querySelectorAll('form.usertext').forEach(form=>form.addEventListener('submit',async event=>{event.preventDefault();const node=form.closest('.thing');const text=form.querySelector('textarea').value;const response=await fetch('/fixture-save',{method:'POST',body:new URLSearchParams({id:node.dataset.fullname,text})});if(!response.ok){const error=form.querySelector('.error');error.style.display='block';error.textContent='This edit was rejected.';return;}form.querySelector('.md').textContent=text.replace(/\\[([^\\]\\n]+)\\]\\(https:\\/\\/[^)\\s]+\\)/g,'$1');form.querySelector('.usertext-edit').style.display='none';form.querySelector('.usertext-body').style.display='block';}));
    document.querySelectorAll('form.del-button').forEach(form=>{form.querySelector('.togglebutton').addEventListener('click',event=>{event.preventDefault();form.querySelector('.main').style.display='none';form.querySelector('.option.error').style.display='inline';});form.querySelector('.yes').addEventListener('click',async event=>{event.preventDefault();const node=form.closest('.thing');node.remove();const response=await fetch('/fixture-delete',{method:'POST',body:new URLSearchParams({id:node.dataset.fullname})});if(!response.ok){const error=form.querySelector('.deletion-error');error.style.display='block';error.textContent='This deletion was rejected.';return;}node.remove();});});
    document.querySelector('#fixture-login')?.addEventListener('click',async()=>{await fetch('/fixture-login',{method:'POST'});location.href='https://www.reddit.com/';});</script></body></html>`;
    session.fromPartition('wipeditt-reddit').protocol.handle('https',async request=>{
      const url=new URL(request.url);globalThis.fixture.navigations.push(url.pathname);if(url.pathname.startsWith('/user/'))globalThis.fixture.historyPages.push(url.href);
      if(!['www.reddit.com','old.reddit.com'].includes(url.hostname))return new Response('Unexpected host',{status:403});
      if(url.pathname==='/fixture-login'){globalThis.fixture.signedIn=true;return new Response('ok');}
      if(url.pathname==='/fixture-save'||url.pathname==='/fixture-delete'){
        const body=new URLSearchParams(await request.text()),item=globalThis.fixture.items[body.get('id')];
        const deleting=url.pathname==='/fixture-delete';
        if(!item||item.author!==globalThis.fixture.username||item.deleted||(deleting?globalThis.fixture.failDelete:globalThis.fixture.failWrite))return new Response('Rejected',{status:400});
        if(deleting){await new Promise(resolve=>setTimeout(resolve,globalThis.fixture.deletionLag));globalThis.fixture.deletions.push({id:item.id});if(globalThis.fixture.deletionOutcome!=='unconfirmed')item.deleted=true;}
        else{await new Promise(resolve=>setTimeout(resolve,globalThis.fixture.editLag));if(globalThis.fixture.editPersists)item.text=body.get('text');globalThis.fixture.writes.push({id:item.id,text:body.get('text')});}
        return new Response('ok');
      }
      if(url.pathname.startsWith('/login')||!globalThis.fixture.signedIn)return new Response(page('<h1>Reddit login fixture</h1><p>No real credentials.</p><button id="fixture-login">Sign in to fixture account</button>'),{headers:{'content-type':'text/html'}});
      const path=url.pathname.split('/').filter(Boolean);
      const content=path[0]==='r'&&path[2]==='comments';
      const id=content?(path[3]==='post'&&path[5]?`t1_${path[5]}`:`t3_${path[3]}`):null;
      const original=id&&globalThis.fixture.items[id];
      let items=content?(original?[original]:[]):url.pathname.includes('/submitted')?Object.values(globalThis.fixture.items).filter(item=>item.type==='post'&&!item.deleted):url.searchParams.has('after')?[globalThis.fixture.items.t1_abc,globalThis.fixture.items.t1_next]:[globalThis.fixture.items.t1_abc,globalThis.fixture.items.t1_other];
      if(!content)items=items.filter(item=>!item.deleted);
      if(original?.deleted&&['missing','empty'].includes(globalThis.fixture.deletionOutcome))items=[];
      const next=!content&&!url.searchParams.has('after')&&!url.pathname.includes('/submitted')?'<span class="nextprev"><a rel="next" href="https://old.reddit.com/user/fixture_user/comments/?after=t1_other">next</a></span>':'';
      const commentPage=content&&id?.startsWith('t1_');
      const parent=commentPage?`<div class="sitetable linklisting">${itemHTML(globalThis.fixture.items.t3_post)}</div>`:'';
      const empty=commentPage&&!items.length&&globalThis.fixture.deletionOutcome==='empty'?'<p id="noresults" class="error">there does not seem to be anything here</p>':'';
      return new Response(page(`<div class="content">${parent}${commentPage?'<div class="commentarea">':''}<div id="siteTable" class="sitetable ${commentPage?'nestedlisting':'linklisting'}">${items.map(item=>itemHTML(item,!content)).join('')}${empty}</div>${commentPage?'</div>':''}${next}</div>`),{headers:{'content-type':'text/html'}});
    });
  });
}
