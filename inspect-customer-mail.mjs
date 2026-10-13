const mailbox=await(await fetch('http://127.0.0.1:8025/api/v1/messages')).json();
const qa=(mailbox.messages || []).filter(message=>message.To?.some(recipient=>recipient.Address.startsWith('qa-customer-') && recipient.Address.endsWith('@vsmarket.invalid')));
console.log('Mailpit total messages:',mailbox.total,'QA messages:',qa.length);
for(const message of qa.slice(0,3)){
 const full=await(await fetch(`http://127.0.0.1:8025/api/v1/message/${message.ID}`)).json();
 console.log('Message structure:',Object.keys(full),'HTML length:',full.HTML?.length || 0,'Text length:',full.Text?.length || 0);
 const text=((full.HTML || '')+'\n'+(full.Text || '')).replaceAll('&amp;','&');
 for(const candidate of text.match(/https?:\/\/[^\s"<>]+/g) || []){
  try{const url=new URL(candidate);console.log('Link:',url.origin,url.pathname,'query keys:',[...url.searchParams.keys()]);}catch{}
 }
}
