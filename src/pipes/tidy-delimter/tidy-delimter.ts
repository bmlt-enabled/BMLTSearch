import { Pipe, PipeTransform } from '@angular/core';


@Pipe({
  name: 'tidyDelimter'
})
export class TidyDelimterPipe implements PipeTransform {
  /**
   * Takes a value and makes it lowercase.
   */
  transform(value: string, ...args) {
    return value.replace("#@-@#", " : ");

  }
}
