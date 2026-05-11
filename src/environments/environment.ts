// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  firebase: {
    apiKey: 'AIzaSyCeGdHsXsVIdv9FtfpeN2mGxQynXZh8sCU',
    authDomain: 'bolao-copa-2026-5cc1b.firebaseapp.com',
    projectId: 'bolao-copa-2026-5cc1b',
    storageBucket: 'bolao-copa-2026-5cc1b.firebasestorage.app',
    messagingSenderId: '435365064037',
    appId: '1:435365064037:web:439579ba081c8e8b9b858c'
  },
  espn: {
    scoreboard: 'http://localhost:3001/api/scoreboard',
    teams: 'http://localhost:3001/api/teams',
    groups: 'http://localhost:3001/api/groups'
  }
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
