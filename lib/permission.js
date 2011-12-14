/*
 * Copyright (c) 2011, Code Aurora Forum. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 *       copyright notice, this list of conditions and the following
 *       disclaimer in the documentation and/or other materials provided
 *       with the distribution.
 *     * Neither the name of Code Aurora Forum, Inc. nor the names of its
 *       contributors may be used to endorse or promote products derived
 *       from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED "AS IS" AND ANY EXPRESS OR IMPLIED
 * WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT
 * ARE DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS
 * BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR
 * BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
 * OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN
 * IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

var sqlite = require("sqlite");
var binding = process.binding('permission');

var cameraDesc = {
   "en-US": "camera"
   //spanish: {};
};

var audioDesc = {
   "en-US": "audio"
   //spanish: {};
};

var geolocationDesc = {
   "en-US": "geolocation"
   //spanish: {};
};

var featuresDesc = {
   camera: cameraDesc,
   audio:  audioDesc,
   geolocation:  geolocationDesc
   };

var disabledFeatures = [];

var USER_ALLOWED = 2;
var DEFAULT_ALLOWED = 1;
var DEFAULT_DENIED = -1;
var USER_DENIED = -2;

exports.requestPermission =
    function(features, successCB) {
        var permissionToBeRequestedFor = [];
        var tmpFeatureDesc;
        var tmpPermission;
        var response;
        var tmpReqData;

        for(var i=0; i< features.length; i++) {
            tmpPermission = getPermissionLevel(features[i]);
            if(tmpPermission == DEFAULT_DENIED) {
                tmpFeatureDesc = getFeatureDescription(features[i]);
                permissionToBeRequestedFor.push(tmpFeatureDesc);
            }
            else if(tmpPermission == USER_DENIED) {
                successCB(USER_DENIED);
                return;
            }
        }
        if(permissionToBeRequestedFor.length > 0) {
            binding.requestPermission(permissionToBeRequestedFor,
                function handleUserPermissionResponse(permission) {
                    console.log('Inside JS Callback');
                    var appid = process.url;
                    var newPerm;
                    if(permission)
                        newPerm = USER_ALLOWED;
                    else
                        newPerm = USER_DENIED;
                    storePermission(appid, features,newPerm);
                    console.log('Stored permission = ' + newPerm + 'into database');
                    successCB(newPerm);
                    console.log('Retruned from Actual callback');
                    return;
                });
        } else {
            successCB(USER_ALLOWED);
        }
    }

function storePermission(appid, features, permission) {
    console.log('inside store permission');
    try {
        var db = sqlite.openDatabaseSync(getDatabaseName());
        console.log('opened database');
        for(var i=0; i<features.length; i++) {
            var records = db.query("REPLACE into permissions (appid, feature, permission) VALUES(?,?,?)",[appid, features[i], permission]);
            console.log('Added record');
	}
        db.close();
    } catch(e) {
        console.log('Caught exception' + e);
    }
    return;
}

function isFeatureEnabled(feature) {
    disabledFeatures = getDisabledFeatures();
    for(var value in disabledFeatures) {
        if(value == feature) {
            if(disabledFeatures.hasOwnProperty(value)) {
                return false;
            }
        }
    }
    return true;
}

function getDisabledFeatures() {
    var retArr = [];
    var db = sqlite.openDatabaseSync(getDatabaseName());
    try {
        db.query("CREATE TABLE IF NOT EXISTS features (feature TEXT NOT NULL, isEnable INTEGER NOT NULL , UNIQUE (feature))");
        var records = db.query("SELECT * from features where isEnable = ?", [0]);
        for(var i=0; i < records.length; i++) {
            retArr[i] = records.feature;
	}
    } catch(e) {
        console.log('Caught exception' + e);
    }
    db.close();
    return retArr;
}

function isFeatureValid(feature) {
    for(var key in featuresDesc) {
        if(key == feature) {
            if(featuresDesc.hasOwnProperty(key)) {
                return true;
            }
        }
    }
    return false;
}

function getFeatureDescription(feature) {
    var tmp;
    var currentLanguage = process.window.navigator.language;
    console.log('Language set = ' + currentLanguage);

    for(var i in featuresDesc) {
        if(i == feature) {
            if(featuresDesc.hasOwnProperty(i)) {
                tmp = featuresDesc[i];
                for(var j in tmp) {
                    if(j == currentLanguage) {
                        if(tmp.hasOwnProperty(j)) {
                            return tmp[j];
                        }
                    }
                }
            }
        }
    }
}

function getPrivilegedFeatures() {
    var features = [];
    for(var feature in featuresDesc) {
        if(featuresDesc.hasOwnProperty(feature)) {
            features.push(feature);
        }
    }
    return features;
}

exports.privilegedFeatures =  getPrivilegedFeatures();

function getPermissionLevel(feature) {
    var permission = DEFAULT_DENIED;
    if(!isFeatureValid(feature)) {
        throw "Not a valid feature";
    }
    if(!isFeatureEnabled(feature)) {
        return USER_DENIED;
    }
    try {
        var db = sqlite.openDatabaseSync(getDatabaseName());
        // Create table if does not exists
        db.query("CREATE TABLE IF NOT EXISTS permissions (appid TEXT NOT NULL, feature TEXT NOT NULL, permission INTEGER NOT NULL, CONSTRAINT uc_permissions UNIQUE(appid,feature))");
        var records = db.query("SELECT permission from permissions where appid = ? and feature = ?",[process.url,feature]);
        if(records.length > 0)
            permission = records[0].permission;
        else
           console.log('Records not found');
    } catch(e) {
        console.log('Caught exception' + e);
    }
    db.close();
    return permission;
}
exports.permissionLevel =
    function(feature) {
        return getPermissionLevel(feature);
    }

function getDatabaseName() {
    var appDir = process.downloadPath;
    var dbPath = appDir + '/../../databases/';
    return dbPath + 'FeaturePermissions.db';
}
