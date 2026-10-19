function createBookingRequestId(){
 const source=globalThis.crypto;
 if(typeof source?.randomUUID==='function')return source.randomUUID();
 if(typeof source?.getRandomValues!=='function')throw Error('Öppna hemsidan via HTTPS och försök igen. Du kan också ringa 076-240 77 63.');
 const bytes=source.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
const form=document.querySelector('#booking-form');
if(form){
 form.noValidate=true;
 const names={bilservice:'Bilservice',felsokning:'Felsökning',bromsservice:'Bromsservice',dack:'Däck & hjul',ac:'AC-service',batteri:'Batteri & start',annat:'Annat / osäker'};
 const dateInput=form.elements.date;
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 dateInput.min=today;const limit=new Date(today+'T12:00:00Z');limit.setUTCDate(limit.getUTCDate()+90);dateInput.max=limit.toISOString().slice(0,10);
 const selected=new URLSearchParams(location.search).get('tjanst');if(names[selected])form.querySelector(`input[name="service"][value="${selected}"]`).checked=true;
 let step=1,requestId;
 const prettyDate=value=>value?new Intl.DateTimeFormat('sv-SE',{weekday:'long',day:'numeric',month:'long',timeZone:'Europe/Stockholm'}).format(new Date(value+'T12:00:00Z')):'';
 function summary(){const data=new FormData(form),target=document.querySelector('#booking-selection');target.replaceChildren();const strong=document.createElement('strong');strong.textContent=names[data.get('service')]||'Välj en tjänst';target.append(strong,document.createTextNode([prettyDate(data.get('date')),data.get('time')].filter(Boolean).join(' · ')||'Välj en dag och önskad tid.'));}
 function showStep(next){step=next;form.querySelectorAll('.form-step').forEach(el=>el.hidden=Number(el.dataset.step)!==next);document.querySelectorAll('[data-step-label]').forEach(el=>{el.classList.toggle('current',Number(el.dataset.stepLabel)===next);if(Number(el.dataset.stepLabel)===next)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});const heading=form.querySelector(`[data-step="${next}"] h2`);heading.tabIndex=-1;heading.focus({preventScroll:true});document.querySelector('.booking-progress').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
 function review(){const data=new FormData(form),pairs=[['Tjänst',names[data.get('service')]],['Önskad tid',prettyDate(data.get('date'))+' kl. '+data.get('time')],['Namn',data.get('name')],['Telefon',data.get('phone')],['E-post',data.get('email')||'Ej angiven'],['Registrering',data.get('registration').toUpperCase()],['Beskrivning',data.get('message')||'Ingen beskrivning']],target=document.querySelector('#booking-review');target.replaceChildren();for(const[key,value]of pairs){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;row.append(dt,dd);target.append(row);}}
 const timeOptions=document.querySelector('#time-options'),timeStatus=document.querySelector('#time-status'),retryTimes=document.querySelector('#retry-times'),dateControl=document.querySelector('.date-control');
 let lastDate=null,loadVersion=0;
 async function loadTimes(force=false){
  const requested=dateInput.value;
  dateControl.classList.toggle('is-empty',!requested);
  if(requested===lastDate&&!force)return;
  lastDate=requested;const version=++loadVersion;
  timeOptions.replaceChildren();retryTimes.hidden=true;timeStatus.classList.remove('form-error');timeOptions.setAttribute('aria-busy','false');document.querySelector('#step-error').textContent='';summary();
  if(!requested){timeStatus.textContent='Välj ett datum för att se tidsalternativen.';return;}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(requested)||!dateInput.validity.valid){timeStatus.textContent='Välj ett giltigt datum inom de kommande 90 dagarna.';return;}
  timeStatus.textContent='Hämtar tidsalternativ…';timeOptions.setAttribute('aria-busy','true');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
  try{
   const res=await fetch('/api/availability?date='+encodeURIComponent(requested),{signal:controller.signal,cache:'no-store'});
   let data;try{data=await res.json();}catch{throw Error('Tiderna kunde inte hämtas. Försök igen eller ring 076-240 77 63.');}
   if(!res.ok)throw Error(typeof data?.error==='string'?data.error:'Tiderna kunde inte hämtas. Försök igen eller ring 076-240 77 63.');
   if(!Array.isArray(data.times)||!data.times.every(time=>typeof time==='string'&&/^\d{2}:\d{2}$/.test(time)))throw Error('Tiderna kunde inte hämtas. Försök igen eller ring 076-240 77 63.');
   if(version!==loadVersion||dateInput.value!==requested)return;
   timeStatus.textContent=data.times.length?'Välj en önskad tid nedan. Verkstaden bekräftar tiden.':'Inga tidsalternativ den här dagen. Välj ett annat datum.';
   for(const time of data.times){const label=document.createElement('label'),input=document.createElement('input'),span=document.createElement('span');input.type='radio';input.name='time';input.value=time;input.required=true;span.textContent=time;label.append(input,span);timeOptions.append(label);}
  }catch(error){
   if(version!==loadVersion||dateInput.value!==requested)return;
   timeStatus.textContent=error.name==='AbortError'?'Det tog för lång tid att hämta tiderna. Försök igen eller ring 076-240 77 63.':error.message;
   timeStatus.classList.add('form-error');retryTimes.hidden=false;
  }finally{clearTimeout(timeout);if(version===loadVersion)timeOptions.setAttribute('aria-busy','false');}
 }
 for(const event of ['input','change','blur'])dateInput.addEventListener(event,()=>loadTimes());
 retryTimes.addEventListener('click',()=>loadTimes(true));
 window.addEventListener('pageshow',()=>loadTimes());form.addEventListener('change',summary);
 form.querySelectorAll('[data-next]').forEach(button=>button.addEventListener('click',()=>{document.querySelector('#step-error').textContent='';const current=form.querySelector(`[data-step="${step}"]`);for(const input of current.querySelectorAll('input,select,textarea'))if(!input.reportValidity())return;if(step===1&&!form.querySelector('input[name="time"]:checked')){document.querySelector('#step-error').textContent='Välj ett datum och en önskad tid för att fortsätta.';return;}if(Number(button.dataset.next)===3)review();showStep(Number(button.dataset.next));}));
 form.querySelectorAll('[data-back]').forEach(button=>button.addEventListener('click',()=>showStep(Number(button.dataset.back))));
 form.addEventListener('submit',async event=>{event.preventDefault();if(step!==3){form.querySelector(`[data-step="${step}"] [data-next]`).click();return;}const error=document.querySelector('#submit-error');error.textContent='';if(!form.elements.privacy.reportValidity())return;const button=document.querySelector('#submit-booking');button.disabled=true;button.textContent='Sparar din förfrågan…';const data=Object.fromEntries(new FormData(form));data.privacy=form.elements.privacy.checked;try{requestId=requestId||createBookingRequestId();data.requestId=requestId;const res=await fetch('/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}),saved=await res.json();if(!res.ok)throw Error(saved.error||'Förfrågan kunde inte sparas.');form.hidden=true;document.querySelector('#booking-reference').textContent=saved.reference;const success=document.querySelector('#booking-success');success.hidden=false;success.scrollIntoView({block:'center',behavior:'smooth'});}catch(err){error.textContent=err.message==='Failed to fetch'?'Anslutningen avbröts. Försök igen. Om du skickar på nytt används samma bokningsnummer.':err.message;button.disabled=false;button.innerHTML='Skicka tidsförfrågan <span aria-hidden="true">↗</span>';}});
 loadTimes();
}
