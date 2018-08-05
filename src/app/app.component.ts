import { Component,
	       ViewChild }               from '@angular/core';
import { Nav,
	       Platform,
				 MenuController }          from 'ionic-angular';
import { StatusBar }               from '@ionic-native/status-bar';
import { SplashScreen }            from '@ionic-native/splash-screen';
import { Storage }                 from '@ionic/storage';
import { TranslateService }        from '@ngx-translate/core';
import { Config }                  from './app.config';
import { HomeComponent }           from '../pages/home/home-component/home.component';
import { SettingsComponent }       from '../pages/settings/settings-component/settings.component';
import { MapSearchComponent }      from '../pages/map-search/map-search-component/map-search.component';
import { FullMapComponent }        from '../pages/fullmap/fullmap-component/fullmap.component';
import { LocationSearchComponent } from '../pages/location-search/location-search-component/location-search.component';
import { ListfullComponent }       from '../pages/listfull/listfull-component/listfull.component';
import { AddressSearchComponent}   from '../pages/address-search/address-search-component/address-search.component';
import { DoIHaveTheBmltComponent } from '../pages/do-i-have-the-bmlt/do-i-have-the-bmlt-component/do-i-have-the-bmlt.component';
import { ContactComponent }        from '../pages/contact/contact-component/contact.component';

@Component({
	templateUrl: './app.html'
})
export class MyApp {
	@ViewChild(Nav) nav: Nav;

	rootPage = HomeComponent;
	pages: Array<{title: string, component: any, icon: string}>;


	constructor(
		private platform        : Platform,
		private translate       : TranslateService,
		private storage         : Storage,
		private statusBar       : StatusBar,
		private splashScreen    : SplashScreen,
		private config          : Config,
		private menuController  : MenuController
		) {
		this.initializeApp();

		this.translate.setDefaultLang('en');
		storage.get('language').then((value) => {
			if (value) {
				this.translate.use(value);
			} else {
				this.translate.use('en');
				storage.set('language', 'en');
			}
		});

		this.pages = [
		  { title: 'HOME',           component: HomeComponent,           icon: 'home' },
			{ title: 'MAP_SEARCH',     component: MapSearchComponent,      icon: 'map'},
			{ title: 'LOCATIONSEARCH', component: LocationSearchComponent, icon: 'pin' },
			{ title: 'ADDRESSSEARCH',  component: AddressSearchComponent,  icon: 'compass' },
			{ title: 'LISTFULL',       component: ListfullComponent,       icon: 'globe' },
			{ title: 'DOIHAVETHEBMLT', component: DoIHaveTheBmltComponent, icon: 'cloud-done' },
	    { title: 'SETTINGS',       component: SettingsComponent,       icon: 'settings'},
			{ title: 'CONTACT',        component: ContactComponent,        icon: 'contact'}
		];
	}

	initializeApp() {
		this.platform.ready().then(() => {
			this.statusBar.styleLightContent()
			this.splashScreen.hide();
		});
	}

	openPage(page) {
		this.menuController.close();
		this.nav.setRoot(page.component);
	}
}
