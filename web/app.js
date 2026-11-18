import {icon,artwork} from './icons.js';
artwork(document.querySelector('canvas'));
const $=s=>document.querySelector(s);
const view=$('#view'),modal=$('#dialog'),notice=$('#notice');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const platforms=['Android','iOS','Windows','macOS'];
let rows=[],revision=0,pending=false,recipient=null;
const date=t=>t?new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium'}).format(t):'Бессрочно';
const status=a=>a.revoked?'Отозван':a.until && a.until<=Date.now()?'Истёк':'Активен';
async function api(path,body,token){
 const headers=token?{'X-Profile-Token':token}:{};
 if(body)headers['Content-Type']='application/json';
 const r=await fetch('/api/'+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,cache:'no-store'});
 if(!r.headers.get('content-type')?.includes('application/json'))throw Error('Сервис временно недоступен. Попробуйте ещё раз.');
 const data=await r.json();if(!r.ok)throw Error(data.error||'Ошибка запроса.');return data;
}
const rowHtml=a=>'<button class="row" data-account="'+esc(a.id)+'"><span class="avatar">'+esc(a.name.split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase())+'</span><span class="person"><strong>'+esc(a.name)+'</strong><small>'+esc(a.login)+'</small></span><span class="tag '+(status(a)==='Активен'?'':'off')+'">'+status(a)+'</span></button>';
const radios=(selected)=>'<div class="choices">'+platforms.map(p=>'<label class="choice"><input type="radio" name="platform" value="'+p+'" '+(p===selected?'checked':'')+'>'+icon(p)+p+'</label>').join('')+'</div>';
function form(){
 view.innerHTML='<div class="grid"><section class="panel"><h2>Новая учётная запись</h2><form id="issueForm"><div class="fields"><label class="field">Имя пользователя<input name="name" type="text" maxlength="60" placeholder="Анна Смирнова" required></label><label class="field">Логин<input name="login" type="text" pattern="[a-z0-9][a-z0-9_.\\-]{1,39}" maxlength="40" title="От 2 до 40 символов: строчные латинские буквы, цифры, точка, дефис или подчёркивание" placeholder="anna.smirnova" autocapitalize="none" spellcheck="false" required></label></div><fieldset><legend>Устройство для первой настройки</legend>'+radios('Android')+'</fieldset><label class="field">Срок доступа<span class="select"><select name="days"><option value="30">30 дней</option><option value="90">90 дней</option><option value="365">1 год</option><option value="0">Бессрочно</option></select></span></label><p class="error" role="alert"></p><div class="actions"><button class="primary">'+icon('key')+'Выдать доступ</button></div></form></section><aside class="aside"><section class="panel"><div class="panelhead">'+icon('recent')+'<h2>Последние доступы</h2></div><div class="records">'+rows.slice(0,3).map(rowHtml).join('')+'</div><a class="button textlink" href="#users">Все пользователи</a></section><section class="panel note">'+icon('shield')+'<div><h3>Один аккаунт для всех устройств</h3><p>Выберите первое устройство. Остальные платформы будут доступны по той же ссылке.</p></div></section></aside></div>';
}
function list(){
 view.innerHTML='<section class="panel full"><label class="field search">Поиск пользователей<input type="search" id="search" placeholder="Имя или логин"></label><div class="records" id="matches"></div></section>';
 function filter(){const q=$('#search').value.toLocaleLowerCase().trim();$('#matches').innerHTML=rows.filter(a=>(a.name+' '+a.login).toLocaleLowerCase().includes(q)).map(rowHtml).join('')||'<p class="empty">Пользователи не найдены.</p>'}$('#search').addEventListener('input',filter);filter();
}
function setTitle(t,desc){$('#title').textContent=t;$('#lead').textContent=desc;document.title=t+' · man-ka'}
function openDialog(html){$('#dialogBody').innerHTML='<button type="button" class="x" data-close aria-label="Закрыть">×</button>'+html+'<p class="error" role="alert"></p>';if(!modal.open)modal.showModal()}
const link=a=>location.origin+'/p/#profile/'+encodeURIComponent(a.id)+'/'+encodeURIComponent(a.token);
function account(a,issued=false){
 openDialog('<h2>'+esc(issued?'Доступ выдан':a.name)+'</h2>'+(issued?'<p>'+esc(a.name)+'</p>':'')+'<div class="detail-line"><span>Логин</span><b>'+esc(a.login)+'</b></div><div class="detail-line"><span>Срок доступа</span><b>'+date(a.until)+'</b></div><div class="detail-line"><span>Статус</span><b>'+status(a)+'</b></div><div class="actions">'+(status(a)==='Активен'?'<button class="primary" data-action="share">'+icon('link')+'Ссылка на профиль</button>':'')+(!a.revoked&&a.until?'<button data-action="extend">Продлить на 30 дней</button>':'')+(!a.revoked?'<button data-action="confirm" class="warn">Отозвать доступ</button>':'')+'</div>');modal.dataset.id=a.id;
}
function sharing(a){
 const url=link(a);openDialog('<h2>Ссылка на профиль</h2><p>Инструкции для '+esc(a.name)+' доступны до окончания или отзыва доступа.</p><label class="field">Адрес страницы<input type="text" readonly id="shareUrl" value="'+esc(url)+'"></label><div class="actions"><button class="primary" data-copy>Скопировать</button><a class="button" href="'+esc(url)+'" target="_blank" rel="noopener">Открыть профиль</a></div>');
}
const guide={
 Android:['Установите strongSwan VPN Client.','Скачайте файл .sswan и откройте его в приложении.','В рабочем профиле проверьте адрес сервера и сертификат, затем введите пароль своей учётной записи.'],
 iOS:['Откройте ссылку в Safari и скачайте профиль .mobileconfig.','Откройте «Настройки» → «Основные» → «VPN и управление устройством» и выберите загруженный профиль.','Для рабочего подключения подтвердите установку профиля с доверенным сертификатом и введите пароль.'],
 macOS:['Скачайте профиль .mobileconfig и откройте файл.','В системных настройках найдите «Профили» или «Управление устройством» и проверьте параметры.','Для рабочего подключения установите профиль и введите пароль аккаунта.'],
 Windows:['Откройте «Параметры» → «Сеть и Интернет» → «VPN».','Добавьте подключение Windows с типом IKEv2. Адрес сервера и логин указаны в образце параметров.','Для рабочего подключения используйте сертификат администратора и пароль своего аккаунта.']
};
function recipientPage(a,p){
 recipient={a,p};view.innerHTML='<section class="panel full profile"><h2>Настройка устройства</h2><p>Учётная запись <strong>'+esc(a.login)+'</strong> · '+date(a.until)+'</p><fieldset><legend>Платформа</legend>'+radios(p)+'</fieldset><ol class="steps">'+guide[p].map(t=>'<li>'+t+'</li>').join('')+'</ol><p class="small">Демообразец содержит тестовый адрес vpn.example.invalid. Рабочие ключи, пароли и сертификаты выдаст серверный сервис.</p><button class="primary" data-download>Скачать образец '+(p==='Android'?'.sswan':p==='Windows'?'.txt':'.mobileconfig')+'</button></section>';
}
function download(){
 const {a,p}=recipient;let file,ext,type;const host='vpn.example.invalid';
 if(p==='Android'){ext='sswan';type='application/json';file=JSON.stringify({uuid:crypto.randomUUID(),name:'man-ka Demo',type:'ikev2-eap',remote:{addr:host,id:host},local:{'eap_id':a.login}},null,2)}
 else if(p==='Windows'){ext='txt';type='text/plain';file=['man-ka · Демообразец Windows','Тип VPN: IKEv2','Адрес: '+host,'Логин: '+a.login,...guide.Windows].join('\n')}
 else{ext='mobileconfig';type='application/x-apple-aspen-config';const u=crypto.randomUUID(),v=crypto.randomUUID();const dict=o=>'<dict>'+Object.entries(o).map(([k,val])=>'<key>'+k+'</key>'+(typeof val==='object'?Array.isArray(val)?'<array>'+val.map(dict).join('')+'</array>':dict(val):typeof val==='number'?'<integer>'+val+'</integer>':'<string>'+esc(val)+'</string>')).join('')+'</dict>';
 file='<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0">'+dict({PayloadType:'Configuration',PayloadVersion:1,PayloadIdentifier:'invalid.example.'+u,PayloadUUID:u,PayloadDisplayName:'man-ka · Демообразец',PayloadContent:[{PayloadType:'com.apple.vpn.managed',PayloadVersion:1,PayloadIdentifier:'invalid.example.'+v,PayloadUUID:v,PayloadDisplayName:'man-ka',UserDefinedName:'man-ka Demo',VPNType:'IKEv2',IKEv2:{RemoteAddress:host,RemoteIdentifier:host,LocalIdentifier:'',AuthenticationMethod:'None',ExtendedAuthEnabled:1,AuthName:a.login}}]})+'</plist>'}
 const obj=URL.createObjectURL(new Blob([file],{type}));const el=document.createElement('a');el.href=obj;el.download='man-ka-demo.'+ext;el.click();setTimeout(()=>URL.revokeObjectURL(obj),2000);
}
async function route(){
 const seq=++revision,h=location.hash.slice(1)||'issue',profile=location.pathname==='/p/';if(modal.open)modal.close();notice.textContent='';
 $('#navIssue').classList.toggle('active',!profile&&h!=='users');$('#navUsers').classList.toggle('active',h==='users');document.querySelector('nav').hidden=profile;
 setTitle(profile?'Профиль подключения':h==='users'?'Пользователи':'Выдать доступ',profile?'Инструкция и настройки для ваших устройств.':h==='users'?'Поиск, продление и отзыв доступа для всей учётной записи.':'Единая учётная запись для всех устройств пользователя.');
 try{if(profile){const [kind,id,token]=h.split('/');if(kind!=='profile'||!id||!token)throw Error('Ссылка недействительна.');const a=await api('profile/'+encodeURIComponent(id),null,token);if(seq===revision)recipientPage(a,a.platform)}
 else{const result=await api('accounts');if(seq!==revision)return;rows=result;if(h==='users')list();else form()}}
 catch(e){if(seq===revision)view.innerHTML='<section class="panel full"><h2>'+esc(e.message)+'</h2><button data-retry>Попробовать снова</button></section>'}
}
view.addEventListener('change',e=>{if(location.hash.startsWith('#profile/')&&e.target.name==='platform')recipientPage(recipient.a,e.target.value)});
view.addEventListener('click',e=>{const b=e.target.closest('[data-account]');if(b)account(rows.find(a=>a.id===b.dataset.account));if(e.target.closest('[data-download]'))download();if(e.target.closest('[data-retry]'))route()});
view.addEventListener('submit',async e=>{e.preventDefault();if(pending)return;pending=true;const f=e.target,b=f.querySelector('button');b.disabled=true;
 try{const data=Object.fromEntries(new FormData(f));data.login=data.login.trim();data.days=Number(data.days);const a=await api('accounts',data);rows.unshift(a);form();account(a,true)}
 catch(err){f.querySelector('.error').textContent=err.message}finally{pending=false;b.disabled=false}});
modal.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b||pending)return;if(b.hasAttribute('data-close'))return modal.close();
 if(b.hasAttribute('data-copy')){try{await navigator.clipboard.writeText($('#shareUrl').value);b.textContent='Скопировано'}catch{$('#shareUrl').select();modal.querySelector('.error').textContent='Скопируйте выделенную ссылку.'}return}
 const action=b.dataset.action,a=rows.find(r=>r.id===modal.dataset.id);if(!action||!a)return;
 if(action==='confirm'){openDialog('<h2>Отозвать доступ?</h2><p>Профиль '+esc(a.name)+' станет недоступен на всех устройствах.</p><div class="actions"><button data-action="revoke" class="primary">Да, отозвать</button><button data-action="back">Отмена</button></div>');return}
 if(action==='back')return account(a);pending=true;b.disabled=true;
 try{const updated=await api('account/'+encodeURIComponent(a.id),{action});Object.assign(a,updated);if(location.hash==='#users'){const s=$('#search');s?.dispatchEvent(new Event('input'))}else form();if(action==='share')sharing(a);else account(a)}
 catch(err){modal.querySelector('.error').textContent=err.message}finally{pending=false;b.disabled=false}});
addEventListener('hashchange',route);route();
