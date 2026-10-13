export const customLabels={kind:{window:'Вікно',door:'Двері'},color:{white:'Білий',anthracite:'Антрацит','golden-oak':'Золотий дуб',walnut:'Горіх'},material:{pvc:'ПВХ',aluminium:'Алюміній',metal:'Метал',wood:'Дерево'},opening:{fixed:'Глухе',turn:'Поворотне','tilt-turn':'Поворотно-відкидне',left:'Ліве',right:'Праве'}};
export function validateCustomDesign(value){
 const invalid=()=>{throw Object.assign(new Error('Перевірте параметри індивідуального виробу'),{status:400});};
 if(!value||typeof value!=='object'||Array.isArray(value))invalid();
 const {kind,width,height,color,material,opening,sections}=value;
 if(!['window','door'].includes(kind)||!Number.isInteger(width)||!Number.isInteger(height)||width<100||width>6000||height<100||height>6000||!Object.hasOwn(customLabels.color,color))invalid();
 if(!(kind==='window'?['pvc','aluminium']:['metal','wood']).includes(material)||!(kind==='window'?['fixed','turn','tilt-turn']:['left','right']).includes(opening)||!Number.isInteger(sections)||sections<1||sections>(kind==='window'?3:1))invalid();
 return {kind,width,height,color,material,opening,sections};
}
export function customProductDescription(design){return `${design.width} × ${design.height} мм · ${customLabels.color[design.color]} · ${customLabels.material[design.material]} · ${customLabels.opening[design.opening]}${design.kind==='window'?` · секцій: ${design.sections}`:''}`;}
