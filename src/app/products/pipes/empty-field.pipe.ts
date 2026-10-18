import { Pipe, type PipeTransform } from '@angular/core';

@Pipe({
  name: 'EmptyField',
})
export class EmptyFieldPipe implements PipeTransform {

  transform(value: unknown, ): unknown {
    return value ?? 'No determinado';
  }

}
