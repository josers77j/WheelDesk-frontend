import { CONSTRUCTION } from '../../../products/interfaces/product.interface';

export function purchaseDescription(description:string,brands:readonly {id:number;name:string}[]):{width?:number;aspectRatio?:number;rimDiameter?:number;construction:CONSTRUCTION;type:'TIRE'|'';brandName:string} {
  const normalized=description.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  const measure=normalized.match(/\b(\d{2,3})\s*[/-]\s*(\d{2,3})\s*[/R-]\s*(\d{2}(?:\.5)?)\b/);
  const tokens=normalized.match(/[A-Z]+(?:-[A-Z]+)*/g)??[];
  const candidates=brands.filter(brand=>{const escaped=brand.name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().split(/[\s-]+/).map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('[\\s-]*');return !!escaped&&new RegExp(`(^|[^A-Z0-9])${escaped}(?=$|[^A-Z0-9])`).test(normalized);});
  const words=tokens.filter(word=>word.replace(/-/g,'').length>=4&&!['LLANTA','RADIAL','MOTO','TIRE'].includes(word));
  return {width:measure?Number(measure[1]):undefined,aspectRatio:measure?Number(measure[2]):undefined,rimDiameter:measure?Number(measure[3]):undefined,construction:CONSTRUCTION.RADIAL,type:measure&&/\b(LLANTA|TIRE)\b/.test(normalized)?'TIRE':'',brandName:candidates.length===1?candidates[0].name:words.length===1?words[0]:''};
}
