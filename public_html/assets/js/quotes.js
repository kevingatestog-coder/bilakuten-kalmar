(function () {
  'use strict';
  const form=document.querySelector('#quote-form'),rows=document.querySelector('#quote-lines'),preview=document.querySelector('#quote-preview'),message=document.querySelector('#quote-feedback');
  const model=window.BilakutenQuote;
  const fields=['kind','reference','issued','validUntil','paidOn','paymentMethod','paymentReference','paymentConfirmed','customerReference','customerName','customerAddress','customerPhone','customerEmail','registration','vehicle','notes'];
  let dirty=false,serial=0,busy=false;
  const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  function view(id){for(const button of document.querySelectorAll('[data-admin-view]')){const active=button.dataset.adminView===id;button.setAttribute('aria-pressed',String(active));document.getElementById(button.dataset.adminView).hidden=!active;}}
  for(const button of document.querySelectorAll('[data-admin-view]'))button.addEventListener('click',()=>view(button.dataset.adminView));
  function read(){const q=Object.fromEntries(fields.map(key=>[key,key==='paymentConfirmed'?form.elements.namedItem(key).checked:form.elements.namedItem(key).value]));q.items=[...rows.children].map(row=>Object.fromEntries([...row.querySelectorAll('[data-field]')].map(input=>[input.dataset.field,input.value])));return q;}
  function syncKind(){
    const receipt=form.elements.kind.value==='receipt';
    document.querySelector('#quote-title').textContent=receipt?'Skapa kvitto':'Skapa offert';
    document.querySelector('#quote-details-title').textContent=receipt?'Kvittouppgifter':'Offertuppgifter';
    document.querySelector('#quote-reference-label').textContent=receipt?'Kvittonummer':'Offertnummer';
    document.querySelector('#quote-date-label').textContent=receipt?'Kvittodatum':'Offertdatum';
    document.querySelector('#quote-new').textContent=receipt?'Nytt kvitto ↗':'Ny offert ↗';
    document.querySelector('#quote-valid-field').hidden=receipt;form.elements.validUntil.disabled=receipt;
    const payment=document.querySelector('#quote-payment');payment.hidden=!receipt;payment.disabled=!receipt;form.elements.paidOn.max=form.elements.issued.value;
  }
  function addLine(item={description:'',quantity:'1',price:'0',vat:'25'}){
    if(rows.children.length>=100){message.textContent='Du kan ha högst 100 offertrader.';return;}
    const row=node('div',undefined,'quote-line'),title=node('div',undefined,'quote-line-title'),heading=node('strong'),remove=node('button','Ta bort rad');remove.type='button';title.append(heading,remove);row.append(title);
    const group=node('div',undefined,'quote-line-fields');
    for(const [key,label] of [['description','Beskrivning'],['quantity','Antal'],['price','À-pris exkl. moms'],['vat','Moms']]){
      const field=node('label',label,'field'),input=node(key==='vat'?'select':'input');input.dataset.field=key;input.name='quote-'+key+'-'+serial;input.required=true;
      if(key==='vat'){for(const rate of [25,12,6,0]){const option=node('option',rate+' %');option.value=String(rate);input.append(option);}}
      else if(key==='description')input.maxLength=300;
      else{input.inputMode='decimal';input.maxLength=16;input.autocomplete='off';}
      input.value=String(item[key]);field.append(input);if(key==='description')row.append(field);else group.append(field);
    }
    serial++;row.append(group,node('p','', 'quote-line-sum'));remove.addEventListener('click',()=>{row.remove();dirty=true;update();});rows.append(row);renumber();
  }
  function renumber(){[...rows.children].forEach((row,i)=>{row.querySelector('strong').textContent='Rad '+(i+1);const remove=row.querySelector('button');remove.disabled=rows.children.length===1;remove.setAttribute('aria-label','Ta bort rad '+(i+1));for(const input of row.querySelectorAll('[data-field]'))input.setAttribute('aria-label',({description:'Beskrivning',quantity:'Antal',price:'À-pris exkl. moms',vat:'Moms'}[input.dataset.field])+' rad '+(i+1));});document.querySelector('#quote-add-line').disabled=rows.children.length>=100;}
  function update(){
    syncKind();const q=read(),info=model.describe(q);form.elements.validUntil.min=q.issued;renumber();message.textContent='';message.classList.remove('is-success');let totals;
    try{totals=model.calculate(q.items);[...rows.children].forEach((row,i)=>row.querySelector('.quote-line-sum').textContent='Summa exkl. moms: '+model.money(totals.lines[i].net));}
    catch(error){message.textContent=error.message;for(const row of rows.children)row.querySelector('.quote-line-sum').textContent='Kontrollera antal och pris.';}
    preview.replaceChildren();
    const header=node('div',undefined,'quote-doc-header'),brand=node('div','BILAKUTEN','quote-doc-brand'),id=node('div',undefined,'quote-doc-id');brand.append(node('small','I KALMAR'));id.append(node('h2',info.heading),node('p',q.reference));header.append(brand,id);preview.append(header);
    const details=node('div',undefined,'quote-doc-info'),customer=node('div'),meta=node('div');customer.append(node('h3','KUND'));
    for(const value of [q.customerName||'Kundens namn',q.customerAddress,q.customerPhone,q.customerEmail].filter(Boolean))customer.append(node('p',value));meta.append(node('h3',info.receipt?'KVITTOUPPGIFTER':'OFFERTUPPGIFTER'));
    for(const value of info.metadata)meta.append(node('p',value));details.append(customer,meta);preview.append(details);
    const table=node('table',undefined,'quote-doc-table'),thead=node('thead'),heading=node('tr');for(const label of ['Beskrivning','Antal','À-pris exkl.','Moms','Summa exkl.']){const th=node('th',label);th.scope='col';heading.append(th);}thead.append(heading);table.append(thead);const tbody=node('tbody');
    q.items.forEach((item,i)=>{const tr=node('tr'),line=totals?.lines[i];for(const value of [item.description||'Beskrivning',item.quantity,line?model.money(line.price):'–',item.vat+' %',line?model.money(line.net):'–'])tr.append(node('td',value));tbody.append(tr);});table.append(tbody);preview.append(table);
    const summary=node('div',undefined,'quote-doc-totals');const totalRow=(label,value,cls)=>{const div=node('div',undefined,cls);div.append(node('span',label),node('span',value));summary.append(div);};totalRow('Summa exkl. moms',totals?model.money(totals.net):'–');for(const tax of totals?.taxes||[])totalRow('Moms '+tax.vat+' %',model.money(tax.amount));totalRow(info.totalLabel,totals?model.money(totals.total):'–','quote-doc-total');preview.append(summary);
    if(q.notes){preview.append(node('h3','VILLKOR & MEDDELANDE'),node('div',q.notes,'quote-doc-note'));}preview.append(node('p',info.notice,'quote-doc-notice'));const footer=node('div',undefined,'quote-doc-footer');footer.append(node('p','Bilakuten i Kalmar AB · Org.nr 559214-6178'),node('p','Franska vägen 20, 393 56 Kalmar · 076-240 77 63'));preview.append(footer);
  }
  function reset(q=model.fresh()){form.reset();for(const key of fields){const input=form.elements.namedItem(key);if(key==='paymentConfirmed')input.checked=q[key]===true;else input.value=q[key]||'';}rows.replaceChildren();for(const item of q.items)addLine(item);dirty=false;update();}
  form.elements.kind.addEventListener('change',()=>{const q=model.withKind(read(),form.elements.kind.value);form.elements.reference.value=q.reference;form.elements.paidOn.value=q.paidOn;form.elements.paymentConfirmed.checked=false;});
  form.addEventListener('input',()=>{dirty=true;update();});form.addEventListener('change',()=>{dirty=true;update();});
  document.querySelector('#quote-add-line').addEventListener('click',()=>{addLine();dirty=true;update();rows.lastElementChild.querySelector('input').focus();});
  document.querySelector('#quote-new').addEventListener('click',()=>{if(dirty&&!confirm('Börja på ett nytt dokument? Spara det nuvarande som PDF först om du vill behålla det.'))return;reset(model.fresh(new Date(),form.elements.kind.value));form.elements.customerName.focus();});
  async function output(print){
    if(busy||!form.reportValidity())return;
    try{
      model.validate(read());busy=true;document.querySelector('#quote-pdf').disabled=true;document.querySelector('#quote-print').disabled=true;message.textContent='';
      await api('/api/admin/session');const q=read();model.validate(q);update();
      if(print){document.body.classList.add('printing-quote');try{window.print();}finally{document.body.classList.remove('printing-quote');}}
      else{const pdf=window.BilakutenQuotePDF.create(q),filename=model.describe(q).title+'-'+q.reference.replace(/[^a-zA-Z0-9ÅÄÖåäö_-]/g,'-')+'.pdf';await pdf.save(filename,{returnPromise:true});dirty=false;message.classList.add('is-success');message.textContent='PDF-filen har skapats. Du hittar den i webbläsarens hämtade filer.';}
    }catch(error){message.textContent=error.message;}
    finally{busy=false;document.querySelector('#quote-pdf').disabled=false;document.querySelector('#quote-print').disabled=false;}
  }
  form.addEventListener('submit',event=>{event.preventDefault();output(false);});document.querySelector('#quote-print').addEventListener('click',()=>output(true));
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  window.addEventListener('admin-auth-change',event=>{if(!event.detail){reset();view('booking-workspace');document.body.classList.remove('printing-quote');}});
  window.BilakutenQuotes={fromBooking(booking){if(dirty&&!confirm('Ersätta den nuvarande offerten? Spara den som PDF först om du vill behålla den.'))return;const q=model.fresh();Object.assign(q,{customerName:booking.name,customerPhone:booking.phone,customerEmail:booking.email,registration:booking.registration,customerReference:booking.reference});q.items[0].description=booking.serviceName;reset(q);dirty=true;view('quotes-workspace');form.scrollIntoView({behavior:'smooth',block:'start'});}};
  reset();
})();
