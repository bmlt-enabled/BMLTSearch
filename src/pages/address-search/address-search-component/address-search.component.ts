import { Component } from '@angular/core';
import { Config } from '../../../app/app.config';


@Component({
  selector: 'page-address-search',
  templateUrl: 'address-search.html',
})
export class AddressSearchComponent {

autoRadius = 25;
  constructor(
    private config: Config
  ) {

  }

public getMeetings(){
  console.log("Address Search : getMeetings");
}

}
