(function (root) {
  'use strict';
  const paymentMethods={swish:'Swish',card:'Kort',cash:'Kontant',bank:'Banköverföring',other:'Annat'};
  const money = cents => new Intl.NumberFormat('sv-SE', {style:'currency',currency:'SEK'}).format(cents / 100);
  function decimal(value, label, max) {
    const text = String(value).trim().replace(/\s/g, '').replace(',', '.');
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw Error('Kontrollera '+label+'. Använd högst två decimaler.');
    const [whole, fraction = ''] = text.split('.');
    const scaled = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    if (!Number.isSafeInteger(scaled) || scaled > max * 100) throw Error('Kontrollera '+label+'. Beloppet är för stort.');
    return scaled;
  }
  function calculate(items) {
    if (!Array.isArray(items) || !items.length || items.length > 100) throw Error('Ange mellan 1 och 100 offertrader.');
    const lines = items.map((item, index) => {
      const quantity = decimal(item.quantity, 'antal på rad '+(index+1), 10000);
      const price = decimal(item.price, 'à-pris på rad '+(index+1), 1000000);
      if (quantity <= 0) throw Error('Antalet måste vara större än noll på rad '+(index+1)+'.');
      const vat = Number(item.vat);
      if (![0,6,12,25].includes(vat)) throw Error('Välj en giltig momssats.');
      const net = Math.round(quantity * price / 100);
      return {...item, quantity, price, vat, net, tax:Math.round(net * vat / 100)};
    });
    const net = lines.reduce((sum, item) => sum + item.net, 0), tax = lines.reduce((sum, item) => sum + item.tax, 0);
    if (net + tax > 100000000000) throw Error('Offertens belopp är för stort.');
    const taxes = [...new Set(lines.map(item => item.vat))].sort((a,b)=>a-b).map(vat=>({vat,amount:lines.filter(item=>item.vat===vat).reduce((sum,item)=>sum+item.tax,0)}));
    return {lines,net,tax,total:net+tax,taxes};
  }
  function date(value) {
    const parsed = new Date(value+'T12:00:00Z');
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10)===value;
  }
  function validate(quote) {
    const kind=quote.kind??'quote';
    if(!['quote','receipt'].includes(kind))throw Error('Välj offert eller kvitto.');
    const limits = {reference:50,customerReference:100,customerName:120,customerAddress:400,customerPhone:40,customerEmail:160,registration:20,vehicle:100,notes:2000,paymentReference:100}, clean = {...quote,kind};
    for (const [key,limit] of Object.entries(limits)) {
      const value = typeof quote[key] === 'string' ? quote[key].trim() : '';
      if (value.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw Error('Kontrollera offertens textfält.');
      clean[key] = ['customerAddress','notes'].includes(key) ? value : value.replace(/[\r\n]+/g,' ');
    }
    if (!clean.reference || !clean.customerName) throw Error('Fyll i dokumentnummer och kundens namn.');
    if (clean.customerAddress.split(/\r?\n/).length > 6) throw Error('Ange kundadressen på högst sex rader.');
    if (!date(quote.issued)) throw Error('Ange ett giltigt dokumentdatum.');
    if(kind==='quote'&&(!date(quote.validUntil)||quote.validUntil<quote.issued))throw Error('Giltighetstiden får inte vara före offertdatumet.');
    if(kind==='receipt'){
      if(!date(quote.paidOn)||quote.paidOn>quote.issued)throw Error('Ange ett giltigt betalningsdatum, senast kvittodatumet.');
      if(!Object.hasOwn(paymentMethods,quote.paymentMethod))throw Error('Välj betalsätt för kvittot.');
      if(quote.paymentConfirmed!==true)throw Error('Bekräfta att hela betalningen är mottagen innan du skapar kvittot.');
    }
    if (clean.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.customerEmail)) throw Error('Kontrollera kundens e-postadress.');
    const totals = calculate(quote.items);
    for (const line of totals.lines) {
      if (typeof line.description !== 'string' || !line.description.trim() || line.description.length > 300 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(line.description)) throw Error('Fyll i en beskrivning på varje offertrad (högst 300 tecken).');
      line.description=line.description.replace(/[\r\n]+/g,' ');
    }
    clean.registration = clean.registration.toUpperCase();
    return {...clean, totals};
  }
  function fresh(now = new Date(),kind='quote') {
    const issued = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
    const expiry = new Date(issued+'T12:00:00Z'); expiry.setUTCDate(expiry.getUTCDate()+30);
    const stamp = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(now).replaceAll(':','');
    return {kind,reference:(kind==='receipt'?'KVT':'OFF')+'-'+issued.replaceAll('-','')+'-'+stamp+'-'+Math.floor(Math.random()*65536).toString(16).padStart(4,'0').toUpperCase(),issued,validUntil:expiry.toISOString().slice(0,10),paidOn:issued,paymentMethod:'',paymentReference:'',paymentConfirmed:false,customerReference:'',customerName:'',customerAddress:'',customerPhone:'',customerEmail:'',registration:'',vehicle:'',notes:'',items:[{description:'',quantity:'1',price:'0',vat:'25'}]};
  }
  function withKind(q,kind){
    if(!['quote','receipt'].includes(kind))throw Error('Välj offert eller kvitto.');
    const reference=/^(?:OFF|KVT)-\d{8}-\d{6}-[A-F0-9]{4}$/.test(q.reference)?(kind==='receipt'?'KVT':'OFF')+q.reference.slice(3):q.reference;
    return {...q,kind,reference,paidOn:q.paidOn||q.issued,paymentConfirmed:false};
  }
  function describe(q){
    const receipt=q.kind==='receipt',title=receipt?'Kvitto':'Offert';
    const metadata=[(receipt?'Kvittodatum: ':'Offertdatum: ')+q.issued];
    if(receipt){metadata.push('Betalningsdatum: '+q.paidOn,'Betalsätt: '+(paymentMethods[q.paymentMethod]||'Ej valt'));if(q.paymentReference)metadata.push('Betalningsreferens: '+q.paymentReference);}
    else metadata.push('Giltig till: '+q.validUntil);
    for(const [label,value]of [['Er referens',q.customerReference],['Reg.nr',q.registration?.toUpperCase()],['Fordon',q.vehicle]])if(value)metadata.push(label+': '+value);
    return {receipt,title,heading:title.toUpperCase(),metadata,totalLabel:receipt&&q.paymentConfirmed?'Betalt inkl. moms':'Totalt inkl. moms',notice:receipt?(q.paymentConfirmed?'Betalning mottagen. Tack för ditt besök!':'Utkast - bekräfta mottagen betalning före utskrift.'):'Detta är en offert, inte en faktura.'};
  }
  root.BilakutenQuote = {money,decimal,calculate,validate,fresh,withKind,describe,paymentMethods};
})(globalThis);
