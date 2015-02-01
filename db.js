//db setting, collection aslo called setting

//PouchDB.destroy('setting',function(err, info) { console.log(info,"db destroyed.");});
// var defaultSetting = {
//   "startTime": "0930",
//   "finishTime": "1700",
//   "lunchMinutes": "30",
//   "staffNumber": "30030484",
//   "rememberPassword": false,
//   "password": ""
// };

module.exports = (function(){

  var PouchDB = require('pouchdb');
  var db = new PouchDB('uws-ts');

  var retrieve = function (){
    return db.get('setting');
  }

  var update = function(doc){
    db.get('setting').then(function (oldDoc) {
      console.log('doc._rev',oldDoc._rev, doc);
      db.put(doc, 'setting', oldDoc._rev);
    });
  }

  return {
    retrieve: retrieve,
    save: update
  }

})();