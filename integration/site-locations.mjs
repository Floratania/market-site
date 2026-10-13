// Public shop locations only. Inventory warehouse identifiers are a separate source.
export function publicLocations(content) {
  const googleUrl=(value,embed=false)=>{
    try {const url=new URL(value);return url.protocol==='https:'&&url.hostname==='www.google.com'&&(embed?url.pathname==='/maps/embed':url.pathname.startsWith('/maps/'));}catch{return false;}
  };
  const valid=(content.locations||[]).filter(item=>item&&/^[a-z0-9-]{1,40}$/.test(item.id)&&typeof item.name==='string'&&item.name.length<=80&&typeof item.address==='string'&&item.address.length<=240&&Number.isFinite(item.latitude)&&Math.abs(item.latitude)<=90&&Number.isFinite(item.longitude)&&Math.abs(item.longitude)<=180&&/^[A-Za-z0-9_-]{10,100}$/.test(item.placeId)&&googleUrl(item.mapsUrl)&&googleUrl(item.embedUrl,true));
  return valid.slice(0,20).map(({id,name,address,latitude,longitude,placeId,mapsUrl,embedUrl,phone})=>({id,name,address,latitude,longitude,placeId,mapsUrl,embedUrl,phone:/^\+\d{10,15}$/.test(phone)?phone:''}));
}
