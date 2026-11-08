export function unitPrice(design){return 199000+(design.faces.front.length?30000:0)+(design.faces.back.length?30000:0)}
export function quantity(value){return Math.max(1,Math.min(99,Math.trunc(Number(value))||1))}
export function totalPrice(rows){return rows.reduce((total,row)=>total+unitPrice(row.design)*quantity(row.design.quantity),0)}
