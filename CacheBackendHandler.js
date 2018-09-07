var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var dbModel = require('dvp-dbmodels');
var underscore = require('underscore');
var async = require('async');
var redisHandler = require('./DataCachingRedisHandler.js');
var ipValidator = require('./IpValidator.js');


var GetUserBy_Ext_Domain = function(extension, domain, data, callback)
{
    try
    {
        dbModel.SipUACEndpoint
            .find({where: {SipExtension: extension, Enabled: true}, include: [{model: dbModel.CloudEndUser, as: "CloudEndUser", where: {Domain: domain}}]})
            .then(function (ext)
            {
                logger.debug('[DVP-DynamicConfigurationGenerator.GetUserBy_Ext_Domain] PGSQL Get sip endpoint for ext domain query success');

                callback(undefined, ext);

            }).catch(function(err)
            {
                logger.error('[DVP-DynamicConfigurationGenerator.GetUserBy_Ext_Domain] PGSQL Get sip endpoint for ext domain query failed', err);

                callback(err, undefined);
            })
    }
    catch(ex)
    {
        callback(ex, undefined);
    }
};

var GetUserBy_Name_Domain = function(extName, domain, data, callback)
{
    try
    {
        dbModel.SipUACEndpoint
            .find({where: {SipUsername: extName, Enabled: true}, include: [{model: dbModel.CloudEndUser, as: "CloudEndUser", where: {Domain : domain}}]})
            .then(function (ext)
            {
                logger.debug('[DVP-DynamicConfigurationGenerator.GetUserBy_Name_Domain] PGSQL Get sip endpoint for username domain query success');

                callback(undefined, ext);

            }).catch(function(err)
            {
                logger.error('[DVP-DynamicConfigurationGenerator.GetUserBy_Name_Domain] PGSQL Get sip endpoint for username domain query failed', err);
                callback(err, undefined);
            })

    }
    catch(ex)
    {
        callback(ex, undefined);
    }


};

var GetUserDetailsByUsername = function(reqId, username, data, callback)
{
    try
    {
        dbModel.SipUACEndpoint
            .find({where: [{SipUsername: username, Enabled: true}]})
            .then(function (usr)
            {
                logger.debug('[DVP-DynamicConfigurationGenerator.GetUserDetailsByUsername] PGSQL Get sip endpoint for username query success');

                callback(undefined, usr);

            }).catch(function(err)
            {
                logger.error('[DVP-DynamicConfigurationGenerator.GetUserDetailsByUsername] PGSQL Get sip endpoint for username query failed', err);
                callback(err, undefined);
            })

    }
    catch(ex)
    {
        callback(ex, undefined);
    }
};

var GetPublicClusterDetailsDB = function(reqId, data, cb)
{
    try
    {
        dbModel.Cloud.find({where :[{Type: 'PUBLIC'}], include: [{model: dbModel.LoadBalancer, as: "LoadBalancer"}]})
            .then(function(resCloud)
            {
                logger.debug('[DVP-DynamicConfigurationGenerator.GetPublicClusterDetailsDB] - [%s] - Public CloudEndUser details found',reqId);

                cb(undefined, resCloud);

            }).catch(function(errCloud)
            {
                logger.error('[DVP-DynamicConfigurationGenerator.GetPublicClusterDetailsDB] - [%s] - Public CloudEndUser details searching error',reqId, errCloud);
                cb(errCloud, undefined);
            });
    }
    catch(ex)
    {
        cb(ex, undefined);
    }
}

//Done
var GatherFromUserDetails = function(reqId, usrName, companyId, tenantId, ignoreTenant, data, callback)
{
    GetUserByNameTenantDB(reqId, usrName, companyId, tenantId, ignoreTenant, data, function(err, res)
    {
        callback(err, res);
    })
};

//Done
//OK
var GetUserByNameTenantDB = function(reqId, extName, companyId, tenantId, ignoreTenant, data, callback)
{
    try
    {
        var usrKey = 'SIPUSER:' + extName;

        redisHandler.GetObjectParseJson(null, usrKey, function(err1, usr)
        {
            if(usr && usr.Extension)
            {
                callback(null, usr);
            }
            else
            {
                callback(err1, null);
            }

        });


    }
    catch(ex)
    {
        callback(ex, null);
    }


};

//Done
//OK
var GetTransferCodesForTenantDB = function(reqId, companyId, tenantId, data, callback)
{
    try
    {
        if(data)
        {
            callback(undefined, data.TransferCode);
        }
        else
        {
            callback(new Error('Error getting TransferCode'), undefined);
        }

    }
    catch(ex)
    {
        callback(ex, undefined);
    }


};

//Done
//OK
var GetExtensionForDid = function(reqId, didNumber, companyId, tenantId, data, callback)
{
    try
    {
        var didKey = 'DIDNUMBER:' + tenantId + ':' + companyId + ':' + didNumber;
        redisHandler.GetObjectParseJson(null, didKey, function(err, did)
        {

            if (did && did.ExtensionId)
            {

                var extByIdKey = 'EXTENSIONBYID:' + tenantId + ':' + companyId + ':' + did.ExtensionId;

                redisHandler.GetObjectParseJson(null, extByIdKey, function (err, ext)
                {
                    if (ext)
                    {
                        did.Extension = ext;
                        callback(null, did);
                    }
                    else
                    {
                        callback(err, null);
                    }

                });

            }
            else
            {
                callback(new Error('DID not found or extension not set'), null);
            }


        });
    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.GetExtensionForDid] - [%s] - Exception occurred', reqId, ex);
        callback(ex, null);
    }

};

//Done
//OK if a separate extension keys are managed by extension number for tenant
var GetExtensionDB = function(reqId, ext, companyId, tenantId, data, callback)
{
    try
    {
        var extKey = 'EXTENSION:' + tenantId + ':' + companyId + ':' + ext;

        redisHandler.GetObjectParseJson(null, extKey, function(err, ext)
        {
            callback(err, ext);
        });
    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.GetExtensionForDid] - [%s] - Exception occurred', reqId, ex);
        callback(ex, undefined);
    }

};

//Incomplete
var GetPresenceDB = function(reqId, username, data, callback)
{
    try
    {
        callback(undefined, undefined);
        //dbModel.SipPresence.find({where: [{SipUsername: username}]})
        //    .then(function (presInfo)
        //    {
        //        logger.debug('[DVP-DynamicConfigurationGenerator.GetPresenceDB] - [%s] - PGSQL get presence details query success', reqId);
        //        callback(undefined, presInfo);
        //    })
        //    .catch(function(err)
        //    {
        //        logger.error('[DVP-DynamicConfigurationGenerator.GetPresenceDB] - [%s] - PGSQL get presence details query failed', reqId, err);
        //        callback(err, undefined);
        //    });
    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.GetPresenceDB] - [%s] - Exception occurred', reqId, ex);
        callback(ex, undefined);
    }

};

var AppendConferenceUser = function(confUser, companyId, tenantId, data, callback)
{
    if(confUser.SipUACEndpointId)
    {
        var usrKey = 'SIPUSERBYID:' + tenantId + ':' + companyId + ':' + confUser.SipUACEndpointId;

        redisHandler.GetObjectParseJson(null, usrKey, function(err, usr)
        {
            if(usr && usr.Enabled && usr.Extension)
            {
                if(data.CloudEndUser && usr.CloudEndUserId && data.CloudEndUser[usr.CloudEndUserId])
                {
                    usr.CloudEndUser = data.CloudEndUser[usr.CloudEndUserId];
                }

                confUser.SipUACEndpoint = usr;
            }


            callback(null, confUser);

        });
    }
    else
    {
        callback(null, confUser);
    }
};

var ManageConfUserIds = function(reqId, confUserArr, companyId, tenantId, data, callback)
{
    var usrArr = [];
    var count = 0;

    var length = Object.keys(confUserArr).length;

    try
    {
        for (var key in confUserArr)
        {
            if (confUserArr.hasOwnProperty(key))
            {
                var confUser = confUserArr[key];

                if(confUser)
                {
                    AppendConferenceUser(confUser, companyId, tenantId, data, function(err, appendResp)
                    {
                        usrArr.push(appendResp);

                        if(count < length)
                        {
                            callback(null, usrArr);
                        }

                    })

                }

            }
            else
            {
                if(count < length)
                {
                    callback(null, usrArr);
                }
            }
        }
    }
    catch(ex)
    {
        if(count < length)
        {
            callback(null, usrArr);
        }
    }
};

//Done - Without Conference
var GetAllDataForExt = function(reqId, extension, companyId, tenantId, extType, callServerId, data, callback)
{
    try
    {

        var extKey = 'EXTENSION:' + tenantId + ':' + companyId + ':' + extension;

        redisHandler.GetObjectParseJson(null, extKey, function(err, extData)
        {
            if(extData)
            {
                extType = extData.ObjCategory;

                if(extType === 'USER')
                {
                    if(extData.SipUACEndpoint && extData.SipUACEndpoint.Enabled && extData.SipUACEndpoint.CloudEndUserId)
                    {
                        if (data.CloudEndUser)
                        {
                            var ceTemp = data.CloudEndUser[extData.SipUACEndpoint.CloudEndUserId];

                            if (ceTemp)
                            {
                                extData.SipUACEndpoint.CloudEndUser = ceTemp;
                            }

                        }

                        GetTransferCodesForTenantDB(reqId, extData.SipUACEndpoint.CompanyId, extData.SipUACEndpoint.TenantId, data, function(err, resTrans)
                        {
                            if(resTrans)
                            {
                                extData.SipUACEndpoint.TransferCode = resTrans;
                            }

                            GetPresenceDB(reqId, extData.SipUACEndpoint.SipUsername, data, function(err, presInf)
                            {
                                if(presInf && presInf.Status === 'Available')
                                {
                                    extData.SipUACEndpoint.UsePublic = false;
                                    callback(err, extData);
                                }
                                else
                                {
                                    if(extData.SipUACEndpoint.UsePublic)
                                    {
                                        GetCallServerClusterDetailsDB(callServerId, data, function(err, cloudInfo)
                                        {
                                            if(cloudInfo && cloudInfo.Cloud && cloudInfo.Cloud.LoadBalancer)
                                            {
                                                extData.SipUACEndpoint.Domain = cloudInfo.Cloud.LoadBalancer.MainIP;
                                                extData.SipUACEndpoint.UsePublic = true;
                                            }

                                            callback(err, extData);

                                        })
                                    }
                                    else
                                    {
                                        extData.SipUACEndpoint.UsePublic = false;

                                        if(extData.SipUACEndpoint.GroupId)
                                        {
                                            var grpKey = 'USERGROUP:' + tenantId + ':' + companyId + ':' + extData.SipUACEndpoint.GroupId;
                                            redisHandler.GetObjectParseJson(null, grpKey, function(err, groupInfo)
                                            {
                                                if(groupInfo)
                                                {
                                                    extData.SipUACEndpoint.UserGroup = groupInfo;
                                                }
                                                callback(null, extData);

                                            });


                                        }
                                        else
                                        {
                                            callback(err, extData);
                                        }

                                    }
                                }

                            })

                        })
                    }
                    else
                    {
                        callback(new Error('User not tagged to extension'), null);
                    }

                }
                else if(extType === 'GROUP')
                {

                    if(extData.UserGroup)
                    {
                        callback(null, extData);
                    }
                    else
                    {
                        callback(new Error('Group not tagged to extension'), null);
                    }

                }
                else if(extType === 'CONFERENCE')
                {
                    if(extData.Conference)
                    {
                        var confKey = 'CONFERENCE:' + tenantId + ':' + companyId + ':' + extData.Conference.ConferenceName;
                        redisHandler.GetObjectParseJson(null, confKey, function(err, confInfo)
                        {
                            if(confInfo)
                            {
                                ManageConfUserIds(reqId, confInfo, companyId, tenantId, data, function(err, usrList)
                                {
                                    extData.Conference.ConferenceUser = usrList;

                                    callback(null, extData);

                                });
                            }
                            else
                            {
                                callback(null, extData);
                            }


                        });
                    }
                    else
                    {
                        callback(new Error('Conference not tagged to extension'), null);
                    }

                }
                else if(extType === 'VOICE_PORTAL' || extType === 'AUTO_ATTENDANT')
                {

                    callback(null, extData);
                }
                else if(extType === 'IVR' || extType === 'CAMPAIGN')
                {
                    if(data.Application)
                    {
                        var app = data.Application[extData.ExtraData];

                        if(app)
                        {
                            extData.Application = app;

                            if(app.MasterApplicationId)
                            {
                                var masterApp = data.Application[app.MasterApplicationId];

                                if(masterApp)
                                {
                                    app.MasterApplication = masterApp
                                }
                            }


                        }
                    }

                    callback(null, extData);
                }
                else
                {
                    logger.error('[DVP-DynamicConfigurationGenerator.GetAllDataForExt] - [%s] - Unsupported extension type', reqId);
                    callback(new Error('Unsupported extension type'), null);
                }
            }
            else
            {
                callback(null, null);
            }

        });



    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.GetAllDataForExt] - [%s] - Exception occurred', reqId, ex);
        callback(ex, false);
    }

};

var PickGatewayTransferRules = function(reqId, companyId, tenantId, data, callback)
{
    var emptyArr = [];
    callback(new Error('Caching not implemented'), emptyArr);
};

//Only Used in Directory Profile - No Need To Cache
var GetGroupBy_Name_Domain = function(grpName, domain, data, callback)
{
    try
    {
        dbModel.UserGroup
            .find({where: [{Domain: domain},{GroupName: grpName}], include: [{model: dbModel.SipUACEndpoint, as: "SipUACEndpoint", include:[{model: dbModel.CloudEndUser, as : "CloudEndUser"}]}, {model: dbModel.Extension, as: "Extension"}]})
            .then(function (grpData)
            {

                logger.debug('[DVP-DynamicConfigurationGenerator.GetGroupBy_Name_Domain] PGSQL Get user group query success');

                callback(undefined, grpData);
            }).catch(function(err)
            {
                logger.error('[DVP-DynamicConfigurationGenerator.GetGroupBy_Name_Domain] PGSQL Get user group query failed', err);

                callback(err, undefined);
            })
    }
    catch(ex)
    {
        callback(ex, undefined);
    }
};

//Incomplete
var GetGroupByExtension = function(reqId, extension, tenant, data, callback)
{
    try
    {
        dbModel.Extension
            .find({where: [{Extension: extension},{TenantId: tenant}], include: [{model: dbModel.UserGroup, as: "UserGroup", include:[{model: dbModel.SipUACEndpoint, as: "SipUACEndpoint"}]}]})
            .then(function (grpData)
            {

                logger.debug('[DVP-DynamicConfigurationGenerator.GetGroupByExtension] PGSQL GetGroupByExtension query success');

                callback(undefined, grpData);
            }).catch(function(err)
            {
                logger.error('[DVP-DynamicConfigurationGenerator.GetGroupByExtension] PGSQL GetGroupByExtension query failed', err);

                callback(err, undefined);
            })
    }
    catch(ex)
    {
        callback(ex, undefined);
    }
};

//Incomplete - not used in call app
var GetCallServersForEndUserDB = function(reqId, companyId, tenantId, data, callback)
{
    var csList = [];
    try
    {
        //record found

        dbModel.CloudEndUser
            .find({where :[{CompanyId: companyId}, {TenantId: tenantId}]})
            .then(function (endUser)
            {
                if(endUser && endUser.SIPConnectivityProvision)
                {
                    logger.debug('[DVP-DynamicConfigurationGenerator.GetCallServersForEndUserDB] - [%s] - PGSQL Get cloud end user query success', reqId);
                    var provisionMechanism = endUser.SIPConnectivityProvision;

                    switch(provisionMechanism)
                    {
                        case 1:
                        {
                            //find call server
                            dbModel.CallServer
                                .find({where :[{CompanyId: companyId}, {TenantId: tenantId}]})
                                .then(function (cs)
                                {
                                    if(cs)
                                    {
                                        logger.debug('[DVP-DynamicConfigurationGenerator.GetCallServersForEndUserDB] - [%s] - PGSQL Get call server query success', reqId);
                                        //call server found
                                        csList.push(cs);
                                        callback(undefined, csList);

                                    }
                                    else
                                    {
                                        logger.debug('[DVP-DynamicConfigurationGenerator.GetCallServersForEndUserDB] - [%s] - PGSQL Get call server query success', reqId);
                                        callback(new Error('Cannot find a call server dedicated to company number'), csList);
                                    }

                                }).catch(function(err)
                                {
                                    logger.error('[DVP-DynamicConfigurationGenerator.GetCallServersForEndUserDB] - [%s] - PGSQL Get call server query failed', reqId, err);
                                    callback(err, csList);
                                });
                        }
                            break;
                        case 2:
                        {
                            //find call server that matches profile
                            dbModel.SipNetworkProfile
                                .find({where :[{CompanyId: companyId}, {TenantId: tenantId}, {ObjType: "INTERNAL"}], include : [{model: dbModel.CallServer, as: "CallServer"}]})
                                .then(function (res)
                                {
                                    if(res)
                                    {
                                        logger.debug('[DVP-DynamicConfigurationGenerator.GetCallServersForEndUserDB] - [%s] - PGSQL Get sip profile query success', reqId);
                                        if(res.CallServer)
                                        {

                                            csList.push(res.CallServer);

                                            callback(undefined, csList);
                                        }
                                        else
                                        {
                                            callback(new Error('call server not connected to sip profile'), csList);
                                        }
                                    }
                                    else
                                    {
                                        logger.debug('[DVP-DynamicConfigurationGenerator.GetCallServersForEndUserDB] - [%s] - PGSQL Get sip profile query success', reqId);
                                        callback(new Error('Cannot find a sip network profile'), csList);
                                    }


                                }).catch(function(err)
                                {
                                    logger.error('[DVP-DynamicConfigurationGenerator.GetCallServersForEndUserDB] - [%s] - PGSQL Get sip profile query failed', reqId, err);
                                    callback(err, csList);
                                });
                            break;
                        }
                        case 3:
                        {
                            //find cloud code that belongs to cloud end user

                            if(endUser.ClusterId)
                            {
                                var clusId = endUser.ClusterId;

                                dbModel.Cloud
                                    .find({where :[{id: clusId}], include:[{model: dbModel.CallServer, as:"CallServer"}]})
                                    .then(function (clusterInfo)
                                    {
                                        if(clusterInfo)
                                        {
                                            logger.debug('[DVP-DynamicConfigurationGenerator.GetCallServersForEndUserDB] - [%s] - PGSQL Get cloud query success', reqId);

                                            callback(undefined, clusterInfo.CallServer);
                                        }
                                        else
                                        {
                                            logger.debug('[DVP-DynamicConfigurationGenerator.GetCallServersForEndUserDB] - [%s] - PGSQL Get cloud query success', reqId);
                                            callback(new Error('Cannot find a cloud for end user'), csList);
                                        }

                                    }).catch(function(err)
                                    {
                                        logger.error('[DVP-DynamicConfigurationGenerator.GetCallServersForEndUserDB] - [%s] - PGSQL Get cloud query failed', reqId, err);
                                        callback(err, csList);
                                    });

                            }
                            else
                            {
                                callback(new Error('Cluster Id not set'), csList);
                            }
                            break;

                        }
                        default:
                        {
                            callback(new Error('Invalid provision mechanism'), csList);
                            break;
                        }
                    }
                }
                else
                {
                    logger.debug('[DVP-DynamicConfigurationGenerator.GetCallServersForEndUserDB] - [%s] - PGSQL Get cloud end user query success', reqId);
                    callback(new Error('Cloud Enduser not found'), csList);
                }

            }).catch(function(err)
            {
                logger.error('[DVP-DynamicConfigurationGenerator.GetCallServersForEndUserDB] - [%s] - PGSQL Get cloud end user query failed', reqId, err);
                callback(err, csList);
            });
    }
    catch(ex)
    {
        callback(ex, csList);

    }
};

var GetCacheObject = function(tenantId, companyId, callback)
{
    try
    {
        redisHandler.GetObjectParseJson(null, 'DVPCACHE:' + tenantId + ':' + companyId, function(err, data)
        {
            callback(err, data);
        });
    }
    catch(ex)
    {
        callback(ex, null);
    }
}


//Done
var GetContext = function(context, callback)
{
    try
    {
        redisHandler.GetObjectParseJson(null, 'CONTEXT:' + context, function(err, ctxt)
        {
            callback(err, ctxt);
        });

    }
    catch(ex)
    {
        callback(ex, null);
    }
};

//Done
var GetEmergencyNumber = function(numb, companyId, tenantId, data, callback)
{
    try
    {
        var eNum = null;

        redisHandler.GetObjectParseJson(null, 'EMERGENCYNUMBER:' + tenantId + ':' + companyId + ':' + numb, function(err, eNum)
        {
            callback(err, eNum);
        });

    }
    catch(ex)
    {
        callback(ex, null);
    }
};

//Done
var GetPhoneNumberDetails = function(phnNum, cb)
{
    try
    {

        redisHandler.GetObjectParseJson(null, 'TRUNKNUMBER:' + phnNum, function(err, phnInfo)
        {
            if(phnInfo)
            {

                if(!phnInfo.Enable)
                {
                    cb(undefined, undefined, null);
                }
                else
                {
                    var arr = [];

                    arr.push(function(callback)
                    {
                        redisHandler.GetObjectParseJson(null, 'DVPCACHE:' + phnInfo.TenantId + ':' + phnInfo.CompanyId, function(err, data)
                        {
                            callback(null, data);
                        })
                    });

                    arr.push(function(callback)
                    {
                        redisHandler.GetObjectParseJson(null, 'TRUNK:' + phnInfo.TrunkId, function(err, tr)
                        {
                            callback(null, tr);
                        })
                    });

                    if(phnInfo.InboundLimitId)
                    {
                        arr.push(function(callback)
                        {
                            redisHandler.GetObjectParseJson(null, 'LIMIT:' + phnInfo.TenantId + ':' + phnInfo.CompanyId + ':' + phnInfo.InboundLimitId, function(err, inbLimInfo)
                            {
                                callback(null, inbLimInfo);
                            });
                        })

                    }

                    if(phnInfo.BothLimitId)
                    {
                        arr.push(function(callback)
                        {
                            redisHandler.GetObjectParseJson(null, 'LIMIT:' + phnInfo.TenantId + ':' + phnInfo.CompanyId + ':' + phnInfo.BothLimitId, function(err, bothLimInfo)
                            {
                                callback(null, bothLimInfo);
                            });
                        })

                    }

                    async.parallel(arr, function(err, results)
                    {
                        if(err)
                        {
                            cb(undefined, undefined, null);
                        }
                        else
                        {
                            if(results && results.length > 0)
                            {
                                var dt = results[0];
                                phnInfo.Trunk = results[1];

                                if(phnInfo.InboundLimitId)
                                {
                                    phnInfo.LimitInfoInbound = results[2];

                                }

                                if(phnInfo.BothLimitId)
                                {
                                    phnInfo.LimitInfoBoth = results[3];
                                }

                                cb(undefined, phnInfo, dt);
                            }
                        }

                    });


                }
            }
            else
            {
                cb(undefined, undefined, null);
            }

        });

    }
    catch(ex)
    {
        cb(ex, undefined, null);
    }
};

//Directory Profile
var GetGatewayListForCallServerProfile = function(profile, csId, reqId, data, callback)
{
    try
    {
        var gatewayList = [];

        dbModel.SipNetworkProfile
            .find({where :[{ProfileName: profile},{ObjType: 'EXTERNAL'}], include: [{model: dbModel.CallServer, as: "CallServer", where:[{id: csId}]},{model: dbModel.Trunk, as: "Trunk"}]})
            .then(function (result)
            {
                try
                {
                    if(result)
                    {
                        logger.debug('[DVP-DynamicConfigurationGenerator.GetGatewayListForCallServerProfile] PGSQL Get SipNetworkProfile query success');
                        //check profile contains direct trunk map

                        //direct trunk termination
                        if(result.Trunk != null)
                        {
                            var trunkList = result.Trunk;

                            trunkList.forEach(function(trunk)
                            {
                                var gw =
                                {
                                    IpUrl : trunk.IpUrl,
                                    Domain : result.InternalIp,
                                    TrunkCode: trunk.TrunkCode,
                                    Proxy: undefined,
                                    Username: trunk.Username,
                                    Password: trunk.Password,
                                    Register: trunk.Register
                                };
                                gatewayList.push(gw);
                            })
                        }

                        if(result.CallServer && result.CallServer.ClusterId)
                        {
                            try
                            {
                                dbModel.Cloud.find({where: [{id: result.CallServer.ClusterId}], include: [{ model: dbModel.LoadBalancer, as: "LoadBalancer", include: [{model: dbModel.Trunk, as: "Trunk"}]}]})
                                    .then(function (rslt)
                                    {

                                        logger.debug('[DVP-DynamicConfigurationGenerator.GetGatewayListForCallServerProfile] PGSQL Get Cloud - LoadBalancer - Trunk query success');

                                        if (rslt)
                                        {
                                            if (rslt.LoadBalancer && rslt.LoadBalancer.Trunk)
                                            {
                                                var trunkList = rslt.LoadBalancer.Trunk;

                                                trunkList.forEach(function (trunk)
                                                {
                                                    var gw =
                                                    {
                                                        IpUrl: trunk.IpUrl,
                                                        Domain: result.InternalIp,
                                                        TrunkCode: trunk.TrunkCode,
                                                        Proxy: rslt.LoadBalancer.MainIP,
                                                        Username: trunk.Username,
                                                        Password: trunk.Password,
                                                        Register: trunk.Register
                                                    };
                                                    gatewayList.push(gw);
                                                });

                                                callback(undefined, gatewayList);
                                            }
                                            else
                                            {
                                                logger.warn('[DVP-DynamicConfigurationGenerator.GetGatewayListForCallServerProfile] - [%s] - load balancer not found', reqId);
                                                callback(undefined, gatewayList);
                                            }
                                        }
                                        else
                                        {
                                            logger.warn('[DVP-DynamicConfigurationGenerator.GetGatewayListForCallServerProfile] - [%s] - cluster query returned empty', reqId);
                                            callback(undefined, gatewayList);
                                        }


                                    }).catch(function (err)
                                    {
                                        logger.error('[DVP-DynamicConfigurationGenerator.GetGatewayListForCallServerProfile] - [%s] - PGSQL Get Cloud - LoadBalancer - Trunk query failed', reqId, err);

                                        callback(err, gatewayList);
                                    });
                            }
                            catch (ex)
                            {
                                callback(ex, undefined);
                            }

                        }
                        else
                        {
                            logger.warn('[DVP-DynamicConfigurationGenerator.GetGatewayListForCallServerProfile] - [%s] - Sip network profile not connected to call server or call server connected is not in cluster', reqId);

                            callback(undefined, gatewayList);
                        }

                    }
                    else
                    {
                        logger.info('[DVP-DynamicConfigurationGenerator.GetPhoneNumberDetails] - PGSQL Get SipNetworkProfile query success');
                        callback(new Error("Profile not found"), undefined);
                    }
                }
                catch(ex)
                {
                    callback(ex, undefined);
                }

            }).catch(function(err)
            {
                logger.error('[DVP-DynamicConfigurationGenerator.GetGatewayListForCallServerProfile] PGSQL Get SipNetworkProfile query failed', err);
                callback(err, undefined);
            });

    }
    catch(ex)
    {
        callback(ex, undefined);
    }
};

//Done
var ValidateBlacklistNumber = function(phnNum, companyId, tenantId, data, callback)
{
    try
    {

        redisHandler.GetObjectParseJson(null, 'NUMBERBLACKLIST:' + tenantId + ':' + companyId + ':' + phnNum, function(err, blNum)
        {
            callback(err, blNum);
        });

    }
    catch(ex)
    {
        callback(ex, null);
    }
};

//Incomplete
var GetGatewayForOutgoingRequest = function(fromNumber, lbId, data, callback)
{
    var outgoingRequest = {
        LimitId: "",
        GwIpUrl: "",
        OutboundLimit: "",
        BothLimit: ""
    };

    redisHandler.GetObjectParseJson(null, 'TRUNKNUMBER:' + fromNumber, function(err, result)
    {
        if (result && result.TrunkId && (result.ObjCategory === 'OUTBOUND' || result.ObjCategory === 'BOTH'))
        {
            redisHandler.GetObjectParseJson(null, 'TRUNK:' + result.TrunkId, function(err, trInfo)
            {
                if(trInfo)
                {
                    if(result.OutboundLimitId)
                    {
                        outgoingRequest.OutboundLimit = result.OutboundLimitId;
                    }

                    if(result.BothLimitId)
                    {
                        outgoingRequest.BothLimit = result.BothLimitId;
                    }

                    if(trInfo.IpUrl)
                    {
                        outgoingRequest.GwIpUrl = trInfo.IpUrl;
                    }

                    callback(undefined, outgoingRequest);

                }
                else
                {
                    callback(new Error('Trunk not found'), null);
                }
            });

        }
        else
        {
            callback(new Error('Phone number not added to trunk'), null);
        }
    });


};

//Incomplete
var GetCompanyLimits = function(companyId, tenantId, callback)
{
    callback(null, null);
};

//Incomplete
var GetCloudForUser = function(username, clusterId, data, callback)
{
    var incomingRequest = {};

    dbModel.SipUACEndpoint.find({where:[{SipUsername: username, Enabled:true}]})
        .then(function(sipUsr)
        {
            if(sipUsr && sipUsr.CompanyId && sipUsr.TenantId)
            {
                var companyId = sipUsr.CompanyId;
                var tenantId = sipUsr.TenantId;

                dbModel.CloudEndUser
                    .find({where :[{CompanyId: companyId}, {TenantId: tenantId}]})
                    .then(function (endUser)
                    {
                        if(endUser.ClusterId && endUser.ClusterId === clusterId)
                        {
                            if(endUser && endUser.SIPConnectivityProvision)
                            {
                                logger.debug('[DVP-DynamicConfigurationGenerator.GetCloudForUser] PGSQL Get cloud end user query success');
                                var provisionMechanism = endUser.SIPConnectivityProvision;

                                switch(provisionMechanism)
                                {
                                    case 1:
                                    {
                                        //find call server
                                        dbModel.CallServer
                                            .find({where :[{CompanyId: companyId}, {TenantId: tenantId}]})
                                            .then(function (cs)
                                            {
                                                if(cs)
                                                {
                                                    logger.debug('[DVP-DynamicConfigurationGenerator.GetCloudForUser] PGSQL Get call server query success');
                                                    //call server found
                                                    incomingRequest.IpCode = cs.InternalMainIP;
                                                    incomingRequest.LoadBalanceType = "cs";

                                                    callback(undefined, incomingRequest);

                                                }
                                                else
                                                {
                                                    logger.debug('[DVP-DynamicConfigurationGenerator.GetCloudForUser] PGSQL Get call server query success');
                                                    callback(new Error('Cannot find a call server dedicated to company number'), undefined);
                                                }

                                            }).catch(function(err)
                                            {
                                                logger.error('[DVP-DynamicConfigurationGenerator.GetCloudForUser] PGSQL Get call server query failed', err);
                                                callback(err, undefined);
                                            });
                                    }
                                        break;
                                    case 2:
                                    {
                                        //find call server that matches profile
                                        dbModel.SipNetworkProfile
                                            .find({where :[{CompanyId: companyId}, {TenantId: tenantId}, {ObjType: "INTERNAL"}], include : [{model: dbModel.CallServer, as: "CallServer"}]})
                                            .then(function (res)
                                            {
                                                if(res)
                                                {
                                                    logger.debug('[DVP-DynamicConfigurationGenerator.GetCloudForUser] PGSQL Get sip profile query success');
                                                    if(res.CallServer)
                                                    {
                                                        incomingRequest.IpCode = res.CallServer.InternalMainIP;
                                                        incomingRequest.LoadBalanceType = "cs";

                                                        callback(undefined, incomingRequest);
                                                    }
                                                    else
                                                    {
                                                        callback(new Error('call server not connected to sip profile'), undefined);
                                                    }
                                                }
                                                else
                                                {
                                                    logger.debug('[DVP-DynamicConfigurationGenerator.GetCloudForUser] PGSQL Get sip profile query success');
                                                    callback(new Error('Cannot find a sip network profile'), undefined);
                                                }


                                            }).catch(function(err)
                                            {
                                                logger.error('[DVP-DynamicConfigurationGenerator.GetCloudForUser] PGSQL Get sip profile query failed', err);
                                                callback(err, undefined);
                                            });
                                        break;
                                    }
                                    case 3:
                                    {
                                        //find cloud code that belongs to cloud end user

                                        if(endUser.ClusterId)
                                        {
                                            var clusId = endUser.ClusterId;

                                            dbModel.Cloud
                                                .find({where :[{id: clusId}]})
                                                .then(function (clusterInfo)
                                                {
                                                    if(clusterInfo)
                                                    {
                                                        logger.debug('[DVP-DynamicConfigurationGenerator.GetCloudForUser] PGSQL Get cloud query success');

                                                        incomingRequest.IpCode = clusterInfo.Code;
                                                        incomingRequest.LoadBalanceType = "cluster";

                                                        callback(undefined, incomingRequest);
                                                    }
                                                    else
                                                    {
                                                        logger.debug('[DVP-DynamicConfigurationGenerator.GetCloudForUser] PGSQL Get cloud query success');
                                                        callback(new Error('Cannot find a cloud for end user'), undefined);
                                                    }

                                                }).catch(function(err)
                                                {
                                                    logger.error('[DVP-DynamicConfigurationGenerator.GetCloudForUser] PGSQL Get cloud query failed', err);
                                                    callback(err, undefined);
                                                });

                                        }
                                        else
                                        {
                                            callback(new Error('Cluster Id not set'), undefined);
                                        }
                                        break;

                                    }
                                    default:
                                    {
                                        callback(new Error('Invalid provision mechanism'), undefined);
                                        break;
                                    }
                                }
                            }
                            else
                            {
                                logger.debug('[DVP-DynamicConfigurationGenerator.GetCloudForUser] PGSQL Get cloud end user query success');
                                callback(new Error('Cloud Enduser not found'), undefined);
                            }
                        }
                        else
                        {
                            callback(new Error('Cloud Enduser not connected to cluster or cluster provided do not match'), undefined);
                        }


                    }).catch(function(err)
                    {
                        logger.error('[DVP-DynamicConfigurationGenerator.GetCloudForUser] PGSQL Get cloud end user query failed', err);
                        callback(err, undefined);
                    });

            }
            else
            {
                callback(new Error('User not found'), undefined);
            }
        })
        .catch(function(err)
        {
            logger.error('[DVP-DynamicConfigurationGenerator.GetCloudForIncomingRequest] Error occurred', err);
            callback(err, undefined);
        })


}

//Incomplete
var GetCloudForIncomingRequest = function(toNumber, fromIp, data, callback)
{
    var incomingRequest = {
        InboundLimit: "",
        BothLimit: "",
        IpCode: "",
        LoadBalanceType: ""
    };

    redisHandler.GetObjectParseJson(null, 'TRUNKNUMBER:' + toNumber, function(err, phnInfo)
    {
        if (phnInfo && phnInfo.TrunkId && (phnInfo.ObjCategory === 'INBOUND' || phnInfo.ObjCategory === 'BOTH'))
        {
            redisHandler.GetObjectParseJson(null, 'TRUNK:' + phnInfo.TrunkId, function(err, trInfo)
            {
                if(trInfo && trInfo.TrunkIpAddress)
                {
                    var isValidIp = ipValidator.ValidateRange(fromIp, trInfo.TrunkIpAddress);

                    if(isValidIp)
                    {
                        var companyId = phnInfo.CompanyId;
                        var tenantId = phnInfo.TenantId;

                        if(phnInfo.InboundLimitId != null)
                        {
                            incomingRequest.InboundLimit = phnInfo.InboundLimitId;
                        }

                        if(phnInfo.BothLimitId)
                        {
                            incomingRequest.BothLimit = phnInfo.BothLimitId;
                        }

                        redisHandler.GetObjectParseJson(null, 'DVPCACHE:' + tenantId + ':' + companyId, function(err, data)
                        {
                            if(data && data.CloudEndUser && Object.keys(data.CloudEndUser).length > 0)
                            {
                                var endUser = underscore.find(data.CloudEndUser, function(eu)
                                {
                                    return eu;
                                });

                                if(endUser && endUser.SIPConnectivityProvision)
                                {
                                    var provisionMechanism = endUser.SIPConnectivityProvision;

                                    switch(provisionMechanism)
                                    {
                                        case 1:
                                        {
                                            //find call server

                                            if(data.CallServer && Object.keys(data.CallServer).length > 0)
                                            {
                                                var cs = underscore.find(data.CallServer, function(cls)
                                                {
                                                    return cls;
                                                });

                                                incomingRequest.IpCode = cs.InternalMainIP;
                                                incomingRequest.LoadBalanceType = "cs";

                                                callback(undefined, incomingRequest);
                                            }
                                            else
                                            {
                                                callback(new Error('Callserver not found'), null);
                                            }

                                            break;

                                        }

                                        case 2:
                                        {
                                            //find call server that matches profile

                                            if(data.SipNetworkProfile)
                                            {
                                                var prof = underscore.find(data.SipNetworkProfile, function(profile)
                                                {
                                                    return profile.ObjType === "INTERNAL"
                                                });

                                                if(prof && prof.CallServerId)
                                                {
                                                    redisHandler.GetObjectParseJson(null, 'CALLSERVER:' + prof.CallServerId, function(err, csInfo)
                                                    {
                                                        if(csInfo)
                                                        {
                                                            incomingRequest.IpCode = csInfo.InternalMainIP;
                                                            incomingRequest.LoadBalanceType = "cs";

                                                            callback(undefined, incomingRequest);
                                                        }
                                                        else
                                                        {
                                                            callback(new Error('Callserver not found'), null);
                                                        }
                                                    });
                                                }
                                                else
                                                {
                                                    callback(new Error('cs not tagged to profile'), null);
                                                }
                                            }
                                            else
                                            {
                                                callback(new Error('Sip Network profile not found'), null);
                                            }

                                            break;

                                        }
                                        case 3:
                                        {
                                            //find cloud code that belongs to cloud end user

                                            if(endUser.ClusterId)
                                            {
                                                var clusId = endUser.ClusterId;

                                                redisHandler.GetObjectParseJson(null, 'CLOUD:' + clusId, function(err, clusterInfo)
                                                {
                                                    if(clusterInfo)
                                                    {
                                                        incomingRequest.IpCode = clusterInfo.Code;
                                                        incomingRequest.LoadBalanceType = "cluster";

                                                        callback(undefined, incomingRequest);
                                                    }
                                                    else
                                                    {
                                                        callback(new Error('Cannot find a cloud for end user'), null);
                                                    }
                                                });

                                            }
                                            else
                                            {
                                                callback(new Error('Cluster Id not set'), undefined);
                                            }
                                            break;

                                        }
                                        default:
                                        {
                                            callback(new Error('Invalid provision mechanism'), undefined);
                                            break;
                                        }
                                    }
                                }
                                else
                                {
                                    callback(new Error('Enduser not found'), null);
                                }
                            }
                            else
                            {
                                callback(new Error('Cloud Enduser not found'), null);
                            }

                        });
                    }
                    else
                    {
                        callback(new Error('Invalid Ip'), null);
                    }

                }
                else
                {
                    callback(new Error('Trunk or Ip addresses not found'), null);
                }
            })

        }
        else
        {
            callback(new Error('Phone number not found'), null);
        }
    });


};


var GetCloudForPublicUserRequest = function(fromUser, clusterId, data, callback)
{
    var incomingRequest = {
        IpCode: "",
        LoadBalanceType: ""
    };


    redisHandler.GetObjectParseJson(null, 'SIPUSER:' + fromUser, function(err, usr)
    {
        if (usr && usr.TenantId && usr.CompanyId)
        {
            redisHandler.GetObjectParseJson(null, 'DVPCACHE:' + usr.TenantId + ':' + usr.CompanyId, function(err, data)
            {
                if(data && data.CloudEndUser && Object.keys(data.CloudEndUser).length > 0)
                {
                    var endUser = underscore.find(data.CloudEndUser, function(eu)
                    {
                        return eu;
                    });

                    if(endUser && endUser.SIPConnectivityProvision)
                    {
                        var provisionMechanism = endUser.SIPConnectivityProvision;

                        switch(provisionMechanism)
                        {
                            case 1:
                            {
                                //find call server

                                if(data.CallServer && Object.keys(data.CallServer).length > 0)
                                {
                                    var cs = underscore.find(data.CallServer, function(cls)
                                    {
                                        return cls;
                                    });

                                    incomingRequest.IpCode = cs.InternalMainIP;
                                    incomingRequest.LoadBalanceType = "cs";

                                    callback(undefined, incomingRequest);
                                }
                                else
                                {
                                    callback(new Error('Callserver not found'), null);
                                }

                                break;

                            }

                            case 2:
                            {
                                //find call server that matches profile

                                if(data.SipNetworkProfile)
                                {
                                    var prof = underscore.find(data.SipNetworkProfile, function(profile)
                                    {
                                        return profile.ObjType === "INTERNAL"
                                    });

                                    if(prof && prof.CallServerId)
                                    {
                                        redisHandler.GetObjectParseJson(null, 'CALLSERVER:' + prof.CallServerId, function(err, csInfo)
                                        {
                                            if(csInfo)
                                            {
                                                incomingRequest.IpCode = csInfo.InternalMainIP;
                                                incomingRequest.LoadBalanceType = "cs";

                                                callback(undefined, incomingRequest);
                                            }
                                            else
                                            {
                                                callback(new Error('Callserver not found'), null);
                                            }
                                        });
                                    }
                                    else
                                    {
                                        callback(new Error('cs not tagged to profile'), null);
                                    }
                                }
                                else
                                {
                                    callback(new Error('Sip Network profile not found'), null);
                                }

                                break;

                            }
                            case 3:
                            {
                                //find cloud code that belongs to cloud end user

                                if(endUser.ClusterId === clusterId)
                                {
                                    var clusId = clusterId;

                                    redisHandler.GetObjectParseJson(null, 'CLOUD:' + clusId, function(err, clusterInfo)
                                    {
                                        if(clusterInfo)
                                        {
                                            incomingRequest.IpCode = clusterInfo.Code;
                                            incomingRequest.LoadBalanceType = "cluster";

                                            callback(undefined, incomingRequest);
                                        }
                                        else
                                        {
                                            callback(new Error('Cannot find a cloud for end user'), null);
                                        }
                                    });

                                }
                                else
                                {
                                    callback(new Error('Cluster Id not set or do not match'), undefined);
                                }
                                break;

                            }
                            default:
                            {
                                callback(new Error('Invalid provision mechanism'), undefined);
                                break;
                            }
                        }
                    }
                    else
                    {
                        callback(new Error('Enduser not found'), null);
                    }
                }
                else
                {
                    callback(new Error('Cloud Enduser not found'), null);
                }

            });

        }
        else
        {
            callback(new Error('From user not found'), null);
        }
    });


};


//Not in use
var GetCallServerClusterDetailsDB = function(csId, data, callback)
{
    try
    {
        redisHandler.GetObjectParseJson(null, 'CALLSERVER:' + csId, function(err1, csInfo)
        {
            if(csInfo && csInfo.ClusterId)
            {
                redisHandler.GetObjectParseJson(null, 'CLOUD:' + csInfo.ClusterId, function(err, cloudInfo)
                {
                    callback(err, cloudInfo);

                });
            }
            else
            {
                if(err1)
                {
                    callback(err1, null);
                }
                else
                {
                    callback(new Error('Call server not found or cluster not set'), null);
                }

            }

        });
    }
    catch(ex)
    {
        callback(ex, undefined);
    }
};


module.exports.GetUserBy_Name_Domain = GetUserBy_Name_Domain;
module.exports.GetUserBy_Ext_Domain = GetUserBy_Ext_Domain;
module.exports.GetGatewayListForCallServerProfile = GetGatewayListForCallServerProfile;
module.exports.GetCloudForIncomingRequest = GetCloudForIncomingRequest;
module.exports.GetGatewayForOutgoingRequest = GetGatewayForOutgoingRequest;
module.exports.GetContext = GetContext;
module.exports.GetPhoneNumberDetails = GetPhoneNumberDetails;
module.exports.GetGroupBy_Name_Domain = GetGroupBy_Name_Domain;
module.exports.GetAllDataForExt = GetAllDataForExt;
module.exports.GetExtensionForDid = GetExtensionForDid;
module.exports.GetExtensionDB = GetExtensionDB;
module.exports.GetEmergencyNumber = GetEmergencyNumber;
module.exports.GetUserByNameTenantDB = GetUserByNameTenantDB;
module.exports.GetTransferCodesForTenantDB = GetTransferCodesForTenantDB;
module.exports.GatherFromUserDetails = GatherFromUserDetails;
module.exports.GetCallServerClusterDetailsDB = GetCallServerClusterDetailsDB;
module.exports.GetUserDetailsByUsername = GetUserDetailsByUsername;
module.exports.GetCallServersForEndUserDB = GetCallServersForEndUserDB;
module.exports.GetPublicClusterDetailsDB = GetPublicClusterDetailsDB;
module.exports.GetCloudForUser = GetCloudForUser;
module.exports.GetGroupByExtension = GetGroupByExtension;
module.exports.ValidateBlacklistNumber = ValidateBlacklistNumber;
module.exports.GetCacheObject = GetCacheObject;
module.exports.GetCloudForPublicUserRequest = GetCloudForPublicUserRequest;
module.exports.PickGatewayTransferRules = PickGatewayTransferRules;
