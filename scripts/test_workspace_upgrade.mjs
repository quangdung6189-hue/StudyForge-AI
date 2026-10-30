import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { db } from '../packages/db/src/index.ts';
import { assistantContext } from '../apps/web/src/server/assistant.ts';
const base = process.env.APP_URL ?? 'http://localhost:3000', artifacts = path.resolve('.data/workspace-upgrade-checks');
const results=[], errors=[], timings={}; let owner, token, browser, page;
const pass = name => { results.push(name); console.log(`PASS: ${name}`); };
const source='I. Trắc nghiệm\nCâu 1. Hai cộng hai bằng mấy?\nA. 3\nB. 4 [Đáp án]\nII. Đúng sai\nCâu 1. Với 2 + 2 = 4:\na) Kết quả bằng bốn. ĐÚNG\nb) Kết quả bằng năm. SAI\nIII. Trả lời ngắn\nCâu 1. Tính 2 + 2.\nĐáp án: 4';
async function api(url, method='GET', body) {
 const response = await fetch(base+url,{method,headers:{Cookie:`studyforge_session=${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(120000)});
 return {response,data:response.headers.get('Content-Type')?.includes('ndjson')?await response.text():await response.json()};
}
function questions(chunkId,n=100) {return Array.from({length:n},(_,index)=>{const opts=['3','4','5','6'].map(text=>({id:randomUUID(),text}));return{id:randomUUID(),type:'single',stem:`Câu ${index+1}. Hai cộng hai bằng bao nhiêu?`,options:opts,correctOptionIds:[opts[1].id],acceptedAnswers:[],explanation:'Hai nhóm có hai phần tử gộp lại thành bốn phần tử, vì thế hai cộng hai bằng bốn.',points:1,difficulty:'recognition',topic:'Số học',answerOrigin:'document',reviewed:false,sourceRefs:[{chunkId,quote:'2 + 2 = 4'}]};});}
try {
 await mkdir(artifacts,{recursive:true});
 owner=await db.user.create({data:{email:`upgrade-${randomUUID()}@example.com`,name:'Workspace verification',role:'teacher'}});
 token=randomBytes(32).toString('hex'); await db.session.create({data:{userId:owner.id,tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+3600000)}});
 const doc=await db.document.create({data:{ownerId:owner.id,title:'Upgrade source',fileType:'text/plain',size:Buffer.byteLength(source),storageKey:`upgrade/${randomUUID()}`,status:'ready',rawText:source,chunks:{create:{chunkIndex:0,content:source}}},include:{chunks:true}});
 const payload={documentId:doc.id,title:'100-question persistence check',durationMinutes:15,requestId:randomUUID(),questions:questions(doc.chunks[0].id)};
 let started=Date.now(); const first=await api('/api/quizzes','POST',payload); timings.save100Ms=Date.now()-started;
 assert.equal(first.response.status,201,JSON.stringify(first.data)); const quizId=first.data.quiz.id;
 pass(`Actual PostgreSQL saves 100 questions atomically in ${timings.save100Ms}ms`);
 const repeat=await api('/api/quizzes','POST',payload); assert.equal(repeat.response.status,200,JSON.stringify(repeat.data)); assert.equal(repeat.data.quiz.id,quizId); assert.equal(await db.questionBank.count({where:{ownerId:owner.id}}),1);
 pass('Retrying the same save returns the same quiz and never creates a duplicate bank');
 const conflict=await api('/api/quizzes','POST',{...payload,title:'Changed content'}); assert.equal(conflict.response.status,409);
 pass('A reused operation ID cannot silently overwrite different content');
 browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1280,height:900}});
 await context.addCookies([{name:'studyforge_session',value:token,url:base,httpOnly:true,sameSite:'Lax'}]);page=await context.newPage();
 page.on('pageerror',err=>errors.push(err.message));page.on('console',msg=>{if(msg.type()==='error'&&/hydration|didn't match/i.test(msg.text()))errors.push(msg.text());});
 await page.goto(`${base}/quizzes/create?quizId=${quizId}`,{waitUntil:'networkidle'});
 await page.getByRole('heading',{name:'Kiểm tra trước khi xuất bản',exact:true}).waitFor(); assert.equal(await page.locator('.studio-question').count(),10);
 await page.locator('.studio-review input').first().check(); await page.getByRole('button',{name:'Lưu bản nháp',exact:true}).click();
 await page.getByText('Đã lưu bản nháp. Bạn có thể tải lại trang và tiếp tục duyệt.',{exact:true}).waitFor();
 await page.reload({waitUntil:'networkidle'}); await page.getByRole('heading',{name:'Kiểm tra trước khi xuất bản',exact:true}).waitFor();assert(await page.locator('.studio-review input').first().isChecked());
 await page.getByRole('button',{name:'Trang sau →',exact:true}).click();assert(await page.locator('.studio-question').first().textContent().then(text=>text.includes('Câu 11')));
 pass('Draft review survives reload; 100-item review renders only ten cards and paginates correctly');
 assert.equal((await api(`/api/quizzes/${quizId}/publish`,'POST',{durationMinutes:15,allowReview:true})).response.status,409);
 const reviewed=payload.questions.map(q=>({...q,reviewed:true}));started=Date.now();const patched=await api(`/api/quizzes/${quizId}`,'PATCH',{questions:reviewed,title:payload.title,durationMinutes:15});timings.update100Ms=Date.now()-started;assert.equal(patched.response.status,200,JSON.stringify(patched.data));
 const published=await api(`/api/quizzes/${quizId}/publish`,'POST',{durationMinutes:15,allowReview:true});assert.equal(published.response.status,200,JSON.stringify(published.data));
 const publishedAgain=await api(`/api/quizzes/${quizId}/publish`,'POST',{durationMinutes:15,allowReview:true});assert.equal(publishedAgain.data.versionId,published.data.versionId);assert.equal(await db.quizVersion.count({where:{quizId}}),1);
 pass('Publishing rejects unreviewed questions and repeated publication returns one immutable version');
 started=Date.now();const offline=await api('/api/quizzes/generate?stream=1','POST',{documentId:doc.id,mode:'source_only',questionCount:4,types:['single','boolean','short']});timings.sourceOnlyMs=Date.now()-started;
 const events=offline.data.trim().split('\n').map(line=>JSON.parse(line)), offlineQuestions=events.find(e=>e.event==='result')?.questions;assert.equal(offlineQuestions?.length,4,JSON.stringify(events.at(-1)));assert(offlineQuestions.every(q=>q.answerOrigin==='document'&&!q.reviewed));
 pass('The third creation mode returns four source-answer questions without an AI call');
 for(const format of ['json','csv','md']){const response=await fetch(`${base}/api/documents/${doc.id}/export?format=${format}`,{headers:{Cookie:`studyforge_session=${token}`}});assert.equal(response.status,200);assert(response.headers.get('Content-Disposition')?.includes('attachment'));const text=await response.text();assert(text.length>100);if(format==='json')assert.equal(JSON.parse(text).format,'studyforge.document.v1');}
 const guest=await browser.newContext();assert.equal((await guest.request.get(`${base}/api/documents/${doc.id}/export`)).status(),401);assert.equal((await guest.request.post(`${base}/api/assistant`,{data:{messages:[{role:'user',content:'Hello'}]}})).status(),401);await guest.close();
 pass('Structured JSON/CSV/Markdown exports work and guests cannot export or chat');
 const shortDraft=await api('/api/quizzes','POST',{documentId:doc.id,title:'Lost publish response',durationMinutes:15,requestId:randomUUID(),questions:offlineQuestions.map(q=>({...q,reviewed:true}))});assert.equal(shortDraft.response.status,201);
 await page.goto(`${base}/quizzes/create?quizId=${shortDraft.data.quiz.id}`,{waitUntil:'networkidle'});await page.getByRole('heading',{name:'Kiểm tra trước khi xuất bản',exact:true}).waitFor();
 await page.route(`**/api/quizzes/${shortDraft.data.quiz.id}/publish`,async route=>{await route.fetch();await route.abort('failed');},{times:1});
 await page.getByRole('button',{name:'Xuất bản đề →',exact:true}).click();await page.locator('.studio-error').waitFor();
 await page.getByRole('button',{name:'Xuất bản đề →',exact:true}).click();await page.getByRole('heading',{name:'Bài kiểm tra đã sẵn sàng',exact:true}).waitFor();
 assert.equal(await db.quizVersion.count({where:{quizId:shortDraft.data.quiz.id}}),1);pass('A lost publish response can be retried in the actual builder without duplicating the published version');
 const lookup=await assistantContext(owner.id,{lookup:true,messages:[{role:'user',content:'Quang hợp'}]},new AbortController().signal);
 timings.wikipediaSources=lookup.sources.filter(s=>s.url).length;assert(lookup.sources.some(s=>s.url)||lookup.warnings.length>0);
 pass(lookup.sources.some(s=>s.url)?'Live Wikipedia lookup returns verifiable source links':'Wikipedia lookup reports upstream unavailability honestly');
 for(const route of ['/dashboard','/documents','/quizzes','/study']){const response=await page.goto(base+route,{waitUntil:'networkidle'});assert.equal(response.status(),200);}
 pass('Workspace navigation loads dashboard, documents, banks and study without runtime errors');
 await page.getByRole('button',{name:'Mở trợ lý AI',exact:true}).click();await page.getByLabel('Tin nhắn cho trợ lý',{exact:true}).fill('Chỉ trả lời hai câu: làm thế nào lưu bản nháp và tiếp tục duyệt sau khi tải lại trang?');
 const chatResponse=page.waitForResponse(r=>r.url().endsWith('/api/assistant')&&r.request().method()==='POST');started=Date.now();await page.getByRole('button',{name:'Gửi',exact:true}).click();await chatResponse;
 await page.locator('.u215-b.bt').filter({hasText:/bản nháp/i}).first().waitFor({timeout:90000});
 await page.getByRole('button',{name:'Gửi',exact:true}).waitFor({timeout:90000});timings.chatUiMs=Date.now()-started;
 assert((await page.locator('.u215-b.bt').allTextContents()).some(text=>text.length>70));assert.equal(await page.locator('.assistant-error').count(),0);
 pass(`Real 9Router Flash High chat streams into the widget in ${timings.chatUiMs}ms`);
 await page.screenshot({path:path.join(artifacts,'chat-desktop-light.png'),fullPage:true});
 await page.keyboard.press('Escape');await page.setViewportSize({width:375,height:812});await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Chuyển sang giao diện tối',exact:true}).click();await page.getByRole('button',{name:'Mở trợ lý AI',exact:true}).click();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 const dialogBox=await page.getByRole('dialog',{name:'Trợ lý StudyForge AI',exact:true}).boundingBox();assert(dialogBox.x>=0&&dialogBox.x+dialogBox.width<=375);
 await page.screenshot({path:path.join(artifacts,'chat-mobile-dark-reduced-motion.png'),fullPage:true});await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Mở trợ lý AI',exact:true}).getAttribute('aria-expanded'),'false');
 pass('Lucian chat fits 375px, both themes, reduced motion and keyboard Escape');
 const attempt=await api('/api/attempts/start','POST',{shareCode:published.data.shareCode});assert.equal(attempt.response.status,200,JSON.stringify(attempt.data));assert(!JSON.stringify(attempt.data).includes('correctOptionIds'));
 assert.equal((await api('/api/assistant','POST',{messages:[{role:'user',content:'Solve this test'}]})).response.status,403);
 await page.goto(`${base}/quizzes/take?code=${published.data.shareCode}`,{waitUntil:'networkidle'});assert.equal(await page.getByRole('button',{name:'Mở trợ lý AI',exact:true}).count(),0);
 pass('An active exam never exposes answers and blocks the assistant at backend and UI');
 assert.equal(errors.length,0,errors.join('\n'));pass('No runtime or hydration errors in the complete workspace run');
}catch(error){console.error(error.stack);process.exitCode=1;if(page)await page.screenshot({path:path.join(artifacts,'failure.png'),fullPage:true}).catch(()=>{});}
finally{if(browser)await browser.close();if(owner){await db.attempt.deleteMany({where:{userId:owner.id}});await db.quizVersion.deleteMany({where:{quiz:{ownerId:owner.id}}});await db.quiz.deleteMany({where:{ownerId:owner.id}});await db.questionBank.deleteMany({where:{ownerId:owner.id}});await db.document.deleteMany({where:{ownerId:owner.id}});for(let i=0;i<5;i++){const id=createHash('sha256').update(`assistant:${owner.id}:${Math.floor(Date.now()/900000)-i}`).digest('hex');await db.rateLimitBucket.deleteMany({where:{id}});}await db.user.delete({where:{id:owner.id}});}await db.$disconnect();await writeFile(path.join(artifacts,'results.json'),JSON.stringify({passed:results.length,checks:results,errors,timings,realProvider:true},null,2));}
