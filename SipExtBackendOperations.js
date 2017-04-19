var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var dbModel = require('dvp-dbmodels');
var ipValidator = require('./IpValidator.js');
var Promise = require('bluebird');
var config = require('config');

var allowCodecPref = config.Host.AllowCodecConfigure;

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

var PickGatewayTransferRules = function(reqId, companyId, tenantId, data, callback)
{
    try
    {
        dbModel.CallRule
            .findAll({where :[{CompanyId: companyId},{TenantId: tenantId},{Enable: true}, {ObjCategory: 'GW_TRANSFER'}, {Direction: 'OUTBOUND'}], order: ['Priority'], include: [{model: dbModel.TrunkPhoneNumber, as: "TrunkPhoneNumber", include: [{model: dbModel.LimitInfo, as: 'LimitInfoOutbound'},{model: dbModel.LimitInfo, as: 'LimitInfoBoth'},{model: dbModel.Trunk, as: 'Trunk', include: [{model: dbModel.Translation, as: "Translation"}, {model: dbModel.TrunkOperator, as: "TrunkOperator"}]}]}]})
            .then(function (crList)
            {
                callback(null, crList);

            }).catch(function(err)
            {
                callback(err, null);
            })
    }
    catch(ex)
    {
        callback(ex, null);
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

var GatherFromUserDetails = function(reqId, usrName, companyId, tenantId, ignoreTenant, data, callback)
{
    GetUserByNameTenantDB(reqId, usrName, companyId, tenantId, ignoreTenant, data, function(err, res)
    {
        callback(err, res);
    })
};

var GetUserByNameTenantDB = function(reqId, extName, companyId, tenantId, ignoreTenant, data, callback)
{
    try
    {
        if(!ignoreTenant)
        {
            dbModel.SipUACEndpoint
                .find({where: [{SipUsername: extName},{TenantId: tenantId}, {CompanyId: companyId}, {Enabled: true}], include:[{model: dbModel.Extension, as: 'Extension'}]})
                .then(function (usr)
                {
                    logger.debug('[DVP-DynamicConfigurationGenerator.GetUserByNameTenantDB] PGSQL Get sip endpoint for username tenant query success');

                    callback(undefined, usr);

                }).catch(function(err)
                {
                    logger.error('[DVP-DynamicConfigurationGenerator.GetUserByNameTenantDB] PGSQL Get sip endpoint for username tenant query failed', err);
                    callback(err, undefined);
                })
        }
        else
        {
            dbModel.SipUACEndpoint
                .find({where: [{SipUsername: extName, Enabled: true}], include:[{model: dbModel.Extension, as: 'Extension'}]})
                .then(function (usr)
                {
                    logger.debug('[DVP-DynamicConfigurationGenerator.GetUserByNameTenantDB] PGSQL Get sip endpoint for username tenant query success');

                    callback(undefined, usr);

                }).catch(function(err)
                {
                    logger.error('[DVP-DynamicConfigurationGenerator.GetUserByNameTenantDB] PGSQL Get sip endpoint for username tenant query failed', err);
                    callback(err, undefined);
                })
        }


    }
    catch(ex)
    {
        callback(ex, undefined);
    }


};

var GetTransferCodesForTenantDB = function(reqId, companyId, tenantId, data, callback)
{
    try
    {
        dbModel.TransferCode
            .find({where: [{TenantId: tenantId, CompanyId: companyId}]})
            .then(function (transCode)
            {
                logger.debug('[DVP-DynamicConfigurationGenerator.GetTransferCodesForTenantDB] - [%s] - PGSQL get transfer codes for tenant success', reqId);
                callback(undefined, transCode);
            })
            .catch(function(err)
            {
                logger.error('[DVP-DynamicConfigurationGenerator.GetTransferCodesForTenantDB] - [%s] - PGSQL get transfer codes for tenant failed', reqId, err);

                callback(err, undefined);
            })

    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.GetTransferCodesForTenantDB] - [%s] - PGSQL get transfer codes for tenant failed', reqId, ex);
        callback(ex, undefined);
    }


};

var GetExtensionForDid = function(reqId, didNumber, companyId, tenantId, data, callback)
{
    try
    {
        dbModel.DidNumber.find({where: [{DidNumber: didNumber},{TenantId: tenantId}], include : [{model: dbModel.Extension, as: 'Extension'}]})
            .then(function (didNumDetails)
            {
                logger.debug('[DVP-DynamicConfigurationGenerator.GetExtensionForDid] - [%s] - PGSQL get did number and related extension for company query success', reqId);
                callback(undefined, didNumDetails);

            }).catch(function(err)
            {
                logger.error('[DVP-DynamicConfigurationGenerator.GetExtensionForDid] - [%s] - PGSQL get did number and related extension for company query failed', reqId, err);
                callback(err, undefined);
            });
    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.GetExtensionForDid] - [%s] - Exception occurred', reqId, ex);
        callback(ex, undefined);
    }

};

var GetExtensionDB = function(reqId, ext, companyId, tenantId, data, callback)
{
    try
    {
        dbModel.Extension.find({where: [{Extension: ext},{CompanyId: companyId},{TenantId: tenantId}]})
            .then(function (extDetails)
            {
                logger.debug('[DVP-DynamicConfigurationGenerator.GetExtensionForDid] - [%s] - PGSQL get did number and related extension for company query success', reqId);
                callback(undefined, extDetails);

            }).catch(function(err)
            {
                logger.error('[DVP-DynamicConfigurationGenerator.GetExtensionForDid] - [%s] - PGSQL get did number and related extension for company query failed', reqId, err);
                callback(err, undefined);
            });
    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.GetExtensionForDid] - [%s] - Exception occurred', reqId, ex);
        callback(ex, undefined);
    }

};

var GetPresenceDB = function(reqId, username, data, callback)
{
    try
    {
        dbModel.SipPresence.find({where: [{SipUsername: username}]})
            .then(function (presInfo)
            {
                logger.debug('[DVP-DynamicConfigurationGenerator.GetPresenceDB] - [%s] - PGSQL get presence details query success', reqId);
                callback(undefined, presInfo);
            })
            .catch(function(err)
            {
                logger.error('[DVP-DynamicConfigurationGenerator.GetPresenceDB] - [%s] - PGSQL get presence details query failed', reqId, err);
                callback(err, undefined);
            });
    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.GetPresenceDB] - [%s] - Exception occurred', reqId, ex);
        callback(ex, undefined);
    }

};

var GetAllDataForExt = function(reqId, extension, companyId, tenantId, extType, callServerId, data, callback)
{
    try
    {

        if(extType === 'USER')
        {
            dbModel.Extension.find({where: [{Extension: extension},{TenantId: tenantId},{CompanyId: companyId},{ObjCategory: extType}], include: [{model: dbModel.SipUACEndpoint, as:'SipUACEndpoint', include: [{model: dbModel.CloudEndUser, as:'CloudEndUser'},{model: dbModel.UserGroup, as:'UserGroup', include: [{model: dbModel.Extension, as:'Extension'}]}]}]})
                .then(function (extData)
                {
                    if(extData && extData.SipUACEndpoint && extData.SipUACEndpoint.Enabled)
                    {

                        GetTransferCodesForTenantDB(reqId, companyId, tenantId, data, function(err, resTrans)
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
                                        callback(err, extData);
                                    }
                                }

                            })




                        })

                    }
                    else
                    {
                        callback(undefined, extData);
                    }

                }).catch(function(err)
                {
                    callback(err, undefined);
                });
        }
        else if(extType === 'GROUP')
        {
            dbModel.Extension.find({where: [{Extension: extension},{CompanyId: companyId},{TenantId: tenantId},{ObjCategory: extType}], include: [{model: dbModel.UserGroup, as:'UserGroup'}]})
                .then(function (extData)
                {
                    callback(undefined, extData);
                }).catch(function(err)
                {
                    callback(err, undefined);
                });
        }
        else if(extType === 'CONFERENCE')
        {
            dbModel.Extension.find({where: [{Extension: extension},{CompanyId: companyId},{TenantId: tenantId},{ObjCategory: extType}], include: [{model: dbModel.Conference, as:'Conference', include : [{model: dbModel.ConferenceUser, as : 'ConferenceUser', include:[{model: dbModel.SipUACEndpoint, as: 'SipUACEndpoint', include:[{model: dbModel.CloudEndUser, as: 'CloudEndUser'}]}]},{model: dbModel.CloudEndUser, as: 'CloudEndUser'}]}]})
                .then(function (extData)
                {
                    callback(undefined, extData);
                }).catch(function(err)
                {
                    callback(err, undefined);
                });
        }
        else if(extType === 'VOICE_PORTAL' || extType === 'AUTO_ATTENDANT')
        {
            dbModel.Extension.find({where: [{Extension: extension},{CompanyId: companyId},{TenantId: tenantId},{ObjCategory: extType}]})
                .then(function (extData)
                {
                    dbModel.Context.find({where: [{CompanyId: companyId},{TenantId: tenantId},{ContextCat: 'INTERNAL'}]})
                        .then(function (ctxt)
                        {
                            extData.Context = ctxt;
                            callback(undefined, extData);

                        }).catch(function(err)
                        {
                            callback(err, undefined);
                        });

                }).catch(function(err)
                {
                    callback(err, undefined);
                });
        }
        else if(extType === 'IVR' || extType === 'CAMPAIGN')
        {
            dbModel.Extension.find({where: [{Extension: extension},{CompanyId: companyId},{TenantId: tenantId},{ObjCategory: extType}]})
                .then(function (extData)
                {
                    dbModel.Application.find({where: [{CompanyId: companyId},{TenantId: tenantId},{id: extData.ExtraData}], include : [{model: dbModel.Application, as: "MasterApplication"}]})
                        .then(function (appData)
                        {
                            extData.Application = appData;
                            callback(undefined, extData);

                        }).catch(function(err)
                        {
                            callback(err, undefined);
                        });

                }).catch(function(err)
                {
                    callback(err, undefined);
                });
        }
        else
        {
            logger.error('[DVP-DynamicConfigurationGenerator.GetAllDataForExt] - [%s] - Unsupported extension type', reqId);
            callback(new Error('Unsupported extension type'), undefined);
        }

    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.GetAllDataForExt] - [%s] - Exception occurred', reqId, ex);
        callback(ex, false);
    }

};

var GetGroupBy_Name_Domain = function(grpName, domain, data, callback)
{
    try
    {
        dbModel.UserGroup
            .find({where: [{Domain: domain}], include: [{model: dbModel.SipUACEndpoint, as: "SipUACEndpoint", include:[{model: dbModel.CloudEndUser, as : "CloudEndUser"}]}, {model: dbModel.Extension, as: "Extension", where:[{Extension: grpName}]}]})
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
    callback(null, null);
}

var GetContext = function(context, callback)
{

    try
    {
        dbModel.Context
            .find({where :[{Context: context}]})
            .then(function (ctxt)
            {
                logger.debug('[DVP-DynamicConfigurationGenerator.GetContext] PGSQL Get context query success');

                callback(undefined, ctxt);

            }).catch(function(err)
            {
                logger.error('[DVP-DynamicConfigurationGenerator.GetContext] PGSQL Get context query failed', err);
                callback(err, undefined);
            });

    }
    catch(ex)
    {
        callback(ex, undefined);
    }
};

var GetEmergencyNumber = function(numb, companyId, tenantId, data, callback)
{
    try
    {
        dbModel.EmergencyNumber
            .find({where :[{EmergencyNum: numb},{TenantId: tenantId},{CompanyId: companyId}]})
            .then(function (eNum)
            {
                logger.debug('[DVP-DynamicConfigurationGenerator.GetContext] PGSQL Get emergency number query success');

                callback(undefined, eNum);

            }).catch(function(err)
            {
                logger.error('[DVP-DynamicConfigurationGenerator.GetContext] PGSQL Get emergency number query failed', err);
                callback(err, undefined);
            });

    }
    catch(ex)
    {
        callback(ex, undefined);
    }
};

var GetPhoneNumberDetails = function(phnNum, callback)
{
    try
    {
        dbModel.TrunkPhoneNumber
            .find({where :[{PhoneNumber: phnNum},{Enable: true}], include: [{model: dbModel.LimitInfo, as: 'LimitInfoInbound'},{model: dbModel.LimitInfo, as: 'LimitInfoBoth'},{model:dbModel.Trunk, as : 'Trunk', include:[{model: dbModel.TrunkIpAddress, as:'TrunkIpAddress'}]}]})
            .then(function (phnInfo)
            {
                logger.debug('[DVP-DynamicConfigurationGenerator.GetPhoneNumberDetails] PGSQL Get phone num details query success');

                callback(undefined, phnInfo, null);

            }).catch(function(err)
            {
                logger.error('[DVP-DynamicConfigurationGenerator.GetPhoneNumberDetails] PGSQL Get phone num details query failed', err);
                callback(err, undefined, null);
            })
    }
    catch(ex)
    {
        callback(ex, undefined, null);
    }
};

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
                                        Proxy: null,
                                        Username: trunk.Username,
                                        Password: trunk.Password
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
                                                            IpUrl: rslt.LoadBalancer.MainIP,
                                                            Domain: result.InternalIp,
                                                            TrunkCode: trunk.TrunkCode,
                                                            Proxy: null,
                                                            Username: trunk.Username,
                                                            Password: trunk.Password
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

var ValidateBlacklistNumber = function(phnNum, companyId, tenantId, data, callback)
{
    try
    {
        dbModel.NumberBlacklist
            .find({where :[{PhoneNumber: phnNum},{CompanyId: companyId},{TenantId: tenantId}]})
            .then(function (blackListNum)
            {
                logger.debug('[DVP-DynamicConfigurationGenerator.GetPhoneNumberDetails] PGSQL Get phone num details query success');

                callback(null, blackListNum);

            }).catch(function(err)
            {
                logger.error('[DVP-DynamicConfigurationGenerator.GetPhoneNumberDetails] PGSQL Get phone num details query failed', err);
                callback(err, null);
            })
    }
    catch(ex)
    {
        callback(ex, null);
    }
};

var GetGatewayForOutgoingRequest = function(fromNumber, lbId, data, callback)
{
    var outgoingRequest = {
        LimitId: "",
        GwIpUrl: "",
        OutboundLimit: "",
        BothLimit: ""
    };

    dbModel.TrunkPhoneNumber
        .find({where :[{PhoneNumber: fromNumber}], include : [{model: dbModel.Trunk, as: "Trunk"}]})
        .then(function (result)
        {
            if(result)
            {
                logger.debug('[DVP-DynamicConfigurationGenerator.GetGatewayForOutgoingRequest] PGSQL Get trunk number query success');
                if(result.Trunk)
                {
                    if(result.OutboundLimitId)
                    {
                        outgoingRequest.OutboundLimit = result.OutboundLimitId;
                    }

                    if(result.BothLimitId)
                    {
                        outgoingRequest.BothLimit = result.BothLimitId;
                    }

                    if(result.Trunk.IpUrl)
                    {
                        outgoingRequest.GwIpUrl = result.Trunk.IpUrl;
                    }

                    callback(undefined, outgoingRequest);

                }
                else
                {
                    callback(new Error('Trunk not added to number'), undefined);
                }
            }
            else
            {
                logger.debug('[DVP-DynamicConfigurationGenerator.GetGatewayForOutgoingRequest] PGSQL Get trunk number query success');
                callback(new Error('Number not found'), undefined);
            }

        }).catch(function(err)
        {
            logger.error('[DVP-DynamicConfigurationGenerator.GetGatewayForOutgoingRequest] PGSQL Get trunk number query failed', err);
            callback(err, undefined);
        });
};

var GetCloudForUser = function(username, clusterId, data, callback)
{
    var incomingRequest = {};

    dbModel.SipUACEndpoint.find({where:[{SipUsername: username, Enabled: true}]})
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
                        if(endUser.ClusterId && endUser.ClusterId == clusterId)
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


};

var GetCloudForIncomingRequest = function(toNumber, fromIp, data, callback)
{
    var incomingRequest = {
        InboundLimit: "",
        BothLimit: "",
        IpCode: "",
        LoadBalanceType: ""
    };

    dbModel.TrunkPhoneNumber
        .find({where :[{PhoneNumber: toNumber}], include:[{model:dbModel.Trunk, as : 'Trunk', include:[{model: dbModel.TrunkIpAddress, as:'TrunkIpAddress'}]}]})
        .then(function (phn)
        {
            try
            {
                if(phn && phn.CompanyId && phn.TenantId && (phn.ObjCategory === 'INBOUND' || phn.ObjCategory === 'BOTH') && phn.Trunk && phn.Trunk.TrunkIpAddress.length > 0)
                {

                    var isValidIp = ipValidator.ValidateRange(fromIp, phn.Trunk.TrunkIpAddress);

                    if(isValidIp)
                    {
                        logger.debug('[DVP-DynamicConfigurationGenerator.GetCloudForIncomingRequest] PGSQL Get trunk number query success');
                        //record found
                        var companyId = phn.CompanyId;
                        var tenantId = phn.TenantId;

                        if(phn.InboundLimitId != null)
                        {
                            incomingRequest.InboundLimit = phn.InboundLimitId;
                        }

                        if(phn.BothLimitId)
                        {
                            incomingRequest.BothLimit = phn.BothLimitId;
                        }

                        dbModel.CloudEndUser
                            .find({where :[{CompanyId: companyId}, {TenantId: tenantId}]})
                            .then(function (endUser)
                            {
                                if(endUser && endUser.SIPConnectivityProvision)
                                {
                                    logger.debug('[DVP-DynamicConfigurationGenerator.GetCloudForIncomingRequest] PGSQL Get cloud end user query success');
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
                                                        logger.debug('[DVP-DynamicConfigurationGenerator.GetCloudForIncomingRequest] PGSQL Get call server query success');
                                                        //call server found
                                                        incomingRequest.IpCode = cs.InternalMainIP;
                                                        incomingRequest.LoadBalanceType = "cs";

                                                        callback(undefined, incomingRequest);

                                                    }
                                                    else
                                                    {
                                                        logger.debug('[DVP-DynamicConfigurationGenerator.GetCloudForIncomingRequest] PGSQL Get call server query success');
                                                        callback(new Error('Cannot find a call server dedicated to company number'), undefined);
                                                    }

                                                }).catch(function(err)
                                                {
                                                    logger.error('[DVP-DynamicConfigurationGenerator.GetCloudForIncomingRequest] PGSQL Get call server query failed', err);
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
                                                        logger.debug('[DVP-DynamicConfigurationGenerator.GetCloudForIncomingRequest] PGSQL Get sip profile query success');
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
                                                        logger.debug('[DVP-DynamicConfigurationGenerator.GetCloudForIncomingRequest] PGSQL Get sip profile query success');
                                                        callback(new Error('Cannot find a sip network profile'), undefined);
                                                    }


                                                }).catch(function(err)
                                                {
                                                    logger.error('[DVP-DynamicConfigurationGenerator.GetCloudForIncomingRequest] PGSQL Get sip profile query failed', err);
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
                                                            logger.debug('[DVP-DynamicConfigurationGenerator.GetCloudForIncomingRequest] PGSQL Get cloud query success');

                                                            incomingRequest.IpCode = clusterInfo.Code;
                                                            incomingRequest.LoadBalanceType = "cluster";

                                                            callback(undefined, incomingRequest);
                                                        }
                                                        else
                                                        {
                                                            logger.debug('[DVP-DynamicConfigurationGenerator.GetCloudForIncomingRequest] PGSQL Get cloud query success');
                                                            callback(new Error('Cannot find a cloud for end user'), undefined);
                                                        }

                                                    }).catch(function(err)
                                                    {
                                                        logger.error('[DVP-DynamicConfigurationGenerator.GetCloudForIncomingRequest] PGSQL Get cloud query failed', err);
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
                                    logger.debug('[DVP-DynamicConfigurationGenerator.GetCloudForIncomingRequest] PGSQL Get cloud end user query success');
                                    callback(new Error('Cloud Enduser not found'), undefined);
                                }

                            }).catch(function(err)
                            {
                                logger.error('[DVP-DynamicConfigurationGenerator.GetCloudForIncomingRequest] PGSQL Get cloud end user query failed', err);
                                callback(err, undefined);
                            });
                    }
                    else
                    {
                        callback(new Error('Unauthorized ip'), null);
                    }


                }
                else
                {
                    logger.debug('[DVP-DynamicConfigurationGenerator.GetCloudForIncomingRequest] PGSQL Get trunk number query success');
                    callback(new Error('Invalid phone number'), undefined);
                }
            }
            catch(ex)
            {
                callback(ex, undefined);
            }

        }).catch(function(err)
        {
            logger.error('[DVP-DynamicConfigurationGenerator.GetCloudForIncomingRequest] PGSQL Get trunk number query failed', err);
            callback(err, undefined);
        });


};

var GetCallServerClusterDetailsDB = function(csId, data, callback)
{
    try
    {
        dbModel.CallServer
            .find({where :[{id: csId}], include: [{model: dbModel.Cloud, as: 'Cloud', include: [{model: dbModel.LoadBalancer, as: 'LoadBalancer'}]}]})
            .then(function (cloudInfo)
            {
                callback(undefined, cloudInfo);
            })
            .catch(function(err)
            {
                callback(err, undefined);
            })
    }
    catch(ex)
    {
        callback(ex, undefined);
    }
};

var getContextPreferences = function(context1, context2, companyId, tenantId)
{
    if(allowCodecPref === 'true' || allowCodecPref === true)
    {
        var tempArr = [];
        tempArr.push(context1, context2);

        var sortedArr = tempArr.sort();

        return dbModel.ContextCodecPref
            .find({where :[{Context1: sortedArr[0], Context2: sortedArr[1], CompanyId: companyId, TenantId: tenantId}]})
    }
    else
    {
        return new Promise(function(fulfill, reject){
            fulfill(null);
        })
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
module.exports.PickGatewayTransferRules = PickGatewayTransferRules;
module.exports.getContextPreferences = getContextPreferences;

