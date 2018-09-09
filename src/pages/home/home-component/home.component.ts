import { Component }           from '@angular/core';
import { NavController,
	       Events,
				 MenuController }      from 'ionic-angular';
import { Geolocation }         from '@ionic-native/geolocation';
import { GeolocateProvider }   from '../../../providers/geolocate/geolocate';
import { Storage }             from '@ionic/storage';
import { TranslateService }    from '@ngx-translate/core';

@Component({
	selector: 'page-home',
	templateUrl: 'home.html'
})
export class HomeComponent {

	pages: Array<{title: string, component: any, icon: string, note: string, params?: any}>;

  savedLat         : any;
	savedLng         : any;
	savedAddress     : any;
	goFish           : boolean = false;

	constructor(
		private navController         : NavController,
		private menuController        : MenuController,
		private events                : Events,
		private GeolocateProvider     : GeolocateProvider,
		private geolocation           : Geolocation,
		private translate             : TranslateService,
		private storage               : Storage            ) {}

	ngOnInit() {
	  	this.pages = [

	    ];

	    this.events.subscribe('navigationEvent',(object) => {
	    	this.menuController.close();
				if (object.component) {
					this.navController.push(object.component, object.params);
				}
		});

		this.storage.get('savedLat').then(value => {
				if(value) {
					this.savedLat = value;
					this.storage.get('savedLng').then(value => {
							if(value) {
								this.savedLng = value;
								this.storage.get('savedAddress').then(value => {
										if(value) {
											this.savedLat = value;
										} else {
											this.locatePhone();
										}
								});
							} else {
								this.locatePhone();
							}
					});
				} else {
					this.locatePhone();
				}
		});
	}

	openPage(page) {
		this.navController.push(page.component, page.params);
	}

	locatePhone() {
    this.geolocation.getCurrentPosition({timeout: 10000}).then((resp) => {

      this.savedLat = resp.coords.latitude;
      this.savedLng = resp.coords.longitude;

			this.storage.set('savedLat', this.savedLat);
			this.storage.set('savedLng', this.savedLng);

      this.GeolocateProvider.convertLatLong(this.savedLat, this.savedLng).subscribe((json)=>{

        this.savedAddress = json;
        if (this.savedAddress.results[0]) {
          this.savedAddress = this.savedAddress.results[0].formatted_address;
					this.storage.set('savedAddress', this.savedAddress);
        } else {
          this.savedAddress = "Location not found";
					this.storage.set('savedAddress', "Location not found");
        }
      });

    }).catch((error) => {
      console.log('Error getting location', error);

    });
  }


}
