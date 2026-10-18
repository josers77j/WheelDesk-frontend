import { Pipe, type PipeTransform } from '@angular/core';
import { CUSTOMER_TYPE } from '../interfaces/customer.interface';

@Pipe({
  name: 'CustomerType',
})



export class CustomerTypePipe implements PipeTransform {

  transform(value: CUSTOMER_TYPE): string {

    const customerType = {
      NATURAL: 'Persona Natural',
      LEGAL:'Persona juridica'
    }

    const customerTypeResponse=  customerType[value];
    return customerTypeResponse
  }

}
