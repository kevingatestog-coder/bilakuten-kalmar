const form=document.querySelector('#setup-form'),error=document.querySelector('#setup-error');
form.addEventListener('submit',async event=>{
 event.preventDefault();error.textContent='';if(!form.reportValidity())return;
 const values=Object.fromEntries(new FormData(form));
 if(values.adminPassword!==values.adminPasswordRepeat){error.textContent='Lösenorden är inte lika.';return;}
 const button=form.querySelector('button');button.disabled=true;button.textContent='Ansluter och installerar…';
 try{const response=await fetch('install.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)}),data=await response.json();if(!response.ok)throw Error(data.error||'Installationen kunde inte slutföras.');form.reset();form.hidden=true;document.querySelector('#setup-success').hidden=false;}
 catch(e){error.textContent=e.message==='Failed to fetch'?'Anslutningen avbröts. Ladda om sidan för att kontrollera om installationen blev klar.':e.message;button.disabled=false;button.textContent='Anslut databasen och installera →';}
});
