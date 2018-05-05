import { Pipe, PipeTransform } from '@angular/core';


@Pipe({
  name: 'parseFloat'
})
export class ParseFloatPipe implements PipeTransform {
  /**
   * Takes a value and makes it float.
   */
  transform(value: string, ...args) {
    return parseFloat(value);
  }
}
