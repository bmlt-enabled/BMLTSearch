import { Component }  from '@angular/core';
import { Config }     from '../../../app/app.config';
import { Storage }    from '@ionic/storage';


@Component({
  selector: 'page-address-search',
  templateUrl: 'address-search.html',
})
export class AddressSearchComponent {

  autoRadius;

  constructor(	private storage     : Storage ,
                private config      : Config  ) {

    this.storage.get('searchRange')
    .then(searchValue => {
        if(searchValue) {
          console.log("Setting radius to ", searchValue);
          this.autoRadius = searchValue;
        } else {
          this.autoRadius = 25;
        }
    });
  }

public getMeetings(){
  console.log("Address Search : getMeetings");
}

}
