import { Component } from '@angular/core';
import { Config } from '../../../app/app.config';


@Component({
  selector: 'page-address-search',
  templateUrl: 'address-search.html',
})
export class AddressSearchComponent {

  constructor(
    private config: Config
  ) {

  }


}
