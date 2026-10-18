
import { Pipe, type PipeTransform } from '@angular/core';

@Pipe({
  name: 'EmptyNumberField',
})
export class EmptyNumberFieldPipe implements PipeTransform {

  transform(value: unknown, ): unknown {
    return value ?? '$0';
  }

}
