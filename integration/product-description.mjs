export function productDescription(value) {
  if (typeof value !== 'string') return '';
  let text = value;
  try {
    const parsed = JSON.parse(value);
    text = Array.isArray(parsed.blocks) ? parsed.blocks.map(block => typeof block.data?.text === 'string' ? block.data.text : '').filter(Boolean).join('\n\n') : '';
  } catch {}
  return text.replace(/<[^>]*>/g, '').replace(/&(amp|lt|gt|quot|#39);/g,(_,key)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[key])).trim().slice(0, 5000);
}
