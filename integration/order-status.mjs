export const ORDER_STATUSES={received:'Нове',confirmed:'Підтверджене',shipped:'Відправлене',completed:'Завершене',cancelled:'Скасоване'};
export function validateStatusChange(body){
 if(!body||typeof body.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id)||!Object.hasOwn(ORDER_STATUSES,body.status)||!Object.hasOwn(ORDER_STATUSES,body.expectedStatus))throw Object.assign(new Error('Перевірте номер і статус замовлення.'),{status:400});
 return body;
}
