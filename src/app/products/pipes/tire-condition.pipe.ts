import { Pipe, type PipeTransform } from '@angular/core';
import { TIRE_CONDITION } from '../interfaces/product.interface';

@Pipe({
  name: 'TireCondition',
})
export class TireConditionPipe implements PipeTransform {

  transform(value: TIRE_CONDITION | undefined | null): string {

    if(!value) return 'No determinado'


    const condition = {
      NEW: 'Nuevo',
      USED: 'Usado',
      EMERGENCY: 'Emergencia'
    }

    const status = condition[value]

    return status;
  }

}
