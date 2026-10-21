(function (root) {
  'use strict';
  function create(quote) {
    const q = root.BilakutenQuote.validate(quote), money = root.BilakutenQuote.money;
    if (!root.jspdf?.jsPDF || !root.BilakutenQuoteFont) throw Error('PDF-funktionen kunde inte laddas. Uppdatera sidan och försök igen.');
    const doc = new root.jspdf.jsPDF({unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true});
    doc.addFileToVFS('NotoSans-Regular.ttf',root.BilakutenQuoteFont);doc.addFont('NotoSans-Regular.ttf','NotoSans','normal');doc.setFont('NotoSans','normal');
    doc.setProperties({title:'Offert '+q.reference,author:'Bilakuten i Kalmar AB',subject:'Offert'});
    const left=17,right=193,width=176,bottom=272;let y=20;
    const text=(value,x,at,size=10,options={})=>{doc.setFontSize(size);doc.setTextColor(30,41,59);doc.text(value,x,at,options);};
    const rule=at=>{doc.setDrawColor(218,225,233);doc.setLineWidth(.25);doc.line(left,at,right,at);};
    function header(continued=false) {
      doc.setFillColor(29,111,208);doc.rect(left,15,2,16,'F');text('BILAKUTEN',23,22,19);text('I KALMAR',23,28,9);text('OFFERT',right,22,21,{align:'right'});doc.setFontSize(8);text(doc.splitTextToSize(q.reference,76),right,29,8,{align:'right'});rule(35);y=43;
      if(continued){text('Fortsättning',left,y,9);y+=8;}
    }
    function tableHeader() {
      doc.setFillColor(241,245,249);doc.rect(left,y-5,width,9,'F');text('Beskrivning',left+2,y,8);text('Antal',120,y,8,{align:'right'});text('À-pris exkl.',147,y,8,{align:'right'});text('Moms',163,y,8,{align:'right'});text('Summa exkl.',right-2,y,8,{align:'right'});y+=10;
    }
    function ensure(height,table=false){if(y+height>bottom){doc.addPage();header(true);if(table)tableHeader();}}
    function block(value,x,at,maxWidth,size=9){doc.setFontSize(size);const lines=doc.splitTextToSize(String(value||''),maxWidth);text(lines,x,at,size);return lines.length*4.6;}
    header();text('KUND',left,y,8);text('OFFERTUPPGIFTER',127,y,8);y+=7;let customerY=y;
    for(const value of [q.customerName,q.customerAddress,q.customerPhone,q.customerEmail].filter(Boolean))customerY+=block(value,left,customerY,100)+1;
    let metaY=y;
    for(const value of ['Offertdatum: '+q.issued,'Giltig till: '+q.validUntil,q.customerReference?'Er referens: '+q.customerReference:'',q.registration?'Reg.nr: '+q.registration:'',q.vehicle?'Fordon: '+q.vehicle:''].filter(Boolean))metaY+=block(value,127,metaY,66,8)+1;
    y=Math.max(customerY,metaY)+11;ensure(25);tableHeader();
    for(const item of q.totals.lines){
      doc.setFontSize(9);const lines=doc.splitTextToSize(item.description.trim(),86),height=Math.max(12,lines.length*4.6+6);ensure(height,true);text(lines,left+2,y,9);text(new Intl.NumberFormat('sv-SE',{maximumFractionDigits:2}).format(item.quantity/100),120,y,9,{align:'right'});text(money(item.price).replace(/\s*kr$/,''),147,y,8,{align:'right'});text(item.vat+' %',163,y,8,{align:'right'});text(money(item.net).replace(/\s*kr$/,''),right-2,y,8,{align:'right'});y+=height;rule(y-5);
    }
    y+=6;ensure(32+q.totals.taxes.length*7);
    const summary=(label,value,size=10)=>{text(label,110,y,size);text(money(value),right-2,y,size,{align:'right'});y+=7;};
    summary('Summa exkl. moms',q.totals.net);for(const tax of q.totals.taxes)summary('Moms '+tax.vat+' %',tax.amount,9);doc.setFillColor(235,243,253);doc.rect(106,y-5,87,13,'F');summary('Totalt inkl. moms',q.totals.total,11);y+=12;
    if(q.notes){ensure(18);text('VILLKOR & MEDDELANDE',left,y,8);y+=7;doc.setFontSize(9);for(const line of doc.splitTextToSize(q.notes,width)){ensure(5);text(line,left,y,9);y+=4.8;}y+=6;}
    ensure(12);text('Detta är en offert, inte en faktura.',left,y,9);
    const pages=doc.getNumberOfPages();for(let page=1;page<=pages;page++){doc.setPage(page);rule(280);text('Bilakuten i Kalmar AB · Org.nr 559214-6178',left,286,8);text('Franska vägen 20, 393 56 Kalmar · 076-240 77 63',left,291,8);text(page+' / '+pages,right,291,8,{align:'right'});}
    return doc;
  }
  root.BilakutenQuotePDF = {create};
})(globalThis);
