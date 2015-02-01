
'use strict';

// Load native UI library
var gui = require('nw.gui'); //or global.window.nwDispatcher.requireNwGui() (see https://github.com/rogerwang/node-webkit/issues/707)

// Get the current window
var win = gui.Window.get();

win.resizeTo(850, 480);
win.setResizable(false);

var jf = require('jsonfile'),
  utf8 = require('utf8'),
  path = require('path'),
  SettingDB = require('./db');

var crpt = require('crypto')
  , key = 'salt_for_uws_pw';

   
var tsapp = angular.module('tsapp', []);

tsapp.controller('TsCtrl', ['$scope', function($scope){
  $scope.setting = {};

  SettingDB.retrieve().then(function(setting){
      // var setting = jf.readFileSync('./setting.json');

    $scope.setting.startTime = setting.startTime;
    $scope.setting.finishTime = setting.finishTime;
    $scope.setting.lunchMinutes = setting.lunchMinutes;
    $scope.setting.staffNumber = setting.staffNumber;
    $scope.setting.rememberPassword = setting.rememberPassword;
    $scope.setting.password = setting.password;

    if ($scope.setting.rememberPassword && setting.password != undefined && setting.password != ""){
      var decipher = crpt.createDecipher('aes-256-cbc', key);
      decipher.update(setting.password, 'base64', 'utf8');
     // $scope.setting.password = decipher.final('utf8');
    } else {
      $scope.setting.password = "";
    }

    $scope.$digest();

    console.log('loaded', setting);
  });

///////////////////

  function savePw(){
    var newSettings = {};//jf.readFileSync('./setting.json');
    newSettings.startTime = $scope.setting.startTime;
    newSettings.finishTime = $scope.setting.finishTime;
    newSettings.lunchMinutes = $scope.setting.lunchMinutes;
    newSettings.staffNumber = $scope.setting.staffNumber;
    newSettings.rememberPassword = $scope.setting.rememberPassword;

    if ($scope.setting.rememberPassword){
      var cipher = crpt.createCipher('aes-256-cbc', key)
      var codedPW = utf8.encode($scope.setting.password);
      cipher.update(codedPW, 'utf8', 'base64');
      newSettings.password = cipher.final('base64'); //final will delete cipher obj, so must create another one before use again
    } else {
      newSettings.password = "";
    }
    //jf.writeFileSync('./setting.json', newSettings);
    jf.writeFile("./setting.json", newSettings, function(err) {
      if (err){
        console.log("writing file err: ", err);
      } else {
        console.log("setting saved successfully.");
      }
    });
  }

  $scope.$watchCollection('setting', function(){
    //savePw();
    if( !angular.equals({},$scope.setting)){
      SettingDB.save($scope.setting);
      console.log("--!-",$scope.setting);
    }
  });

////////////////////////////////////////

  $scope.go = function(){
    if (!/^\d{8}$/.test($scope.setting.staffNumber)){
      alert("Wrong staff number. It should be 8 digits.");
      return;
    }; 
    if (!/^\d{4}$/.test($scope.setting.startTime) || 
      !/^\d{4}$/.test($scope.setting.finishTime) || 
      !/^\d{2,3}$/.test($scope.setting.lunchMinutes)){
      alert('wrong format');
      return;
    };
    if (parseInt($scope.setting.lunchMinutes) < 30){
      alert('The lunch break time must be greater than 30 minutes!');
      return;
    };
    console.log("Going to the site!");

    var exec = require('child_process').exec;

    var child = exec('node_modules/webdriver-manager/bin/webdriver-manager start',
      function (error, stdout, stderr) {
        console.log('stdout: ' + stdout);
        console.log('stderr: ' + stderr);
        if (error !== null) {
          console.log('exec error: ' + error);
        }
    });

    var wd = require('wd'),
      moment = require('moment');
    var browser = wd.promiseChainRemote();
    var asserters = wd.asserters; // commonly used asserters
    var loginLink = 'https://staffonline.uws.edu.au/alesco-wss-v13/faces/WJ0000?_afrWindowMode=0&_afrLoop=14955864744711028&_adf.ctrl-state=kljysmgc8_4';

    browser
      .init({browserName:'chrome'})
      .get(loginLink)
      .elementById('pt1:pt_s2:wssUsernameField::content')
      .sendKeys($scope.setting.staffNumber)
      .elementById('pt1:pt_s2:wssPasswordField::content')
      .sendKeys($scope.setting.password)
      .elementById('pt1:pt_s2:wssLoginButton')
      .sleep(2000)
      .click()
      .waitForElementByLinkText("My FlexiTime")
      .click()
      .sleep(2000)
      .waitForElementByLinkText("My FlexiTime")
      .click()
      .waitForElementById("pt1:MNAVTIMEK_NAVW01")
      .sleep(2000)
      .click()
      .sleep(4000)
      .waitForElementById("pt1:r1:0:pt1:Main::f")
      .getAttribute("src")
      .then(function(v){
        console.log("------", v);
        return browser.get(v);
      })
      .then(function(){
        //there is a problem when it at the last day of a period. there would be two edit if the previous one hasnt submitted.
        return browser.waitForElementByLinkText("Edit").click();
        //return browser.waitForElementByLinkText("18/12/2014").click();
      })
      .sleep(1500)
      .then(function(){
          return browser.waitForElementByXPath("/html/body/p[2]/table/tbody/tr[2]/td[1]").text().then(function(v){

        var firstDay =  moment(v, "DD/MM/YYYY");
        var diffDays = moment().diff(firstDay, "days");
        console.log("diff", diffDays);

        for(var i=0; i<=diffDays; i++)(function(n){
          var startId, endId, breakId;
          if (n<10){
            startId = "START_TIME0" + n;
            endId = "END_TIME0" + n;
            breakId = "BREAK0" + n;
          } else {
            startId = "START_TIME" + n;
            endId = "END_TIME" + n;
            breakId = "BREAK" + n;
          }

          browser.waitForElementById(startId).getValue().then(function(val){
            //console.log("@@@@@@@@@@", n, val);
            if(val == ""){
              browser.waitForElementById(startId).clear().sendKeys($scope.setting.startTime);
            }
          });
          browser.waitForElementById(endId).getValue().then(function(val){
            if(val == ""){
              browser.waitForElementById(endId).clear().sendKeys($scope.setting.finishTime);
            }
          });
          browser.waitForElementById(breakId).getValue().then(function(val){
            if(val == ""){
              browser.waitForElementById(breakId).clear().sendKeys($scope.setting.lunchMinutes);
            }
          });
        })(i);
        return browser.waitForElementById("BREAK00"); //return a random elemment for api chain
          });
      })
      .done();    
  };
}]);

