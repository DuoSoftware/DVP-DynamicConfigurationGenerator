var nodeUuid = require('node-uuid');
var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var config = require('config');
var Promise = require('bluebird');
var extApi = require('./ExternalApiAccess.js');
var xmlBuilder = require('./XmlExtendedDialplanBuilder.js');
var xmlRespBuilder = require('./XmlResponseGenerator.js');
var transHandler = require('dvp-ruleservice/TranslationHandler.js');
var redisHandler = require('./RedisHandler.js');
var conferenceHandler = require('./ConferenceOperations.js');
var util = require('util');
var underscore = require('underscore');
var libphonenumber = require('libphonenumber');
var backendFactory = require('./BackendFactory.js');
var LimitValidator = require('./LimitValidator.js').LimitValidator;

/*var backendHandler;
var ruleHandler;

var useCache = config.UseCache;

if(useCache)
{
    backendHandler = require('./CacheBackendHandler.js');
    ruleHandler = require('dvp-ruleservice/CacheBackendOperations.js');
}
else
{
    backendHandler = require('./SipExtBackendOperations.js');
    ruleHandler = require('dvp-ruleservice/CallRuleBackendOperations.js');
}*/

var CreateFMEndpointList = function(reqId, aniNum, context, companyId, tenantId, fmList, dodNum, dodActive, callerIdNum, callerIdName, csId, appId, cacheData, callback)
{
    var epList = [];
    try
    {
        var len = fmList.length;
        var count = 0;

        backendFactory.getBackendHandler().GetCompanyLimits(companyId, tenantId).then(function(compLimits)
        {
            fmList.forEach(function(fm)
            {
                if(count < len)
                {
                    if (fm.ObjCategory === 'GATEWAY')
                    {
                        //pick outbound rule
                        backendFactory.getRuleHandler().PickCallRuleOutboundComplete(reqId, aniNum, fm.DestinationNumber, '', context, companyId, tenantId, false, cacheData, function (err, rule)
                        {
                            if (!err && rule)
                            {
                                var ep =
                                {
                                    Profile: rule.GatewayCode,
                                    Type: 'GATEWAY',
                                    LegStartDelay: 0,
                                    BypassMedia: false,
                                    LegTimeout: fm.RingTimeout,
                                    Destination: rule.DNIS,
                                    Domain: rule.IpUrl,
                                    CompanyId: companyId,
                                    TenantId: tenantId,
                                    AppId: appId,
                                    Action: 'FOLLOW_ME',
                                    Priority: fm.Priority,
                                    TrunkNumber: rule.TrunkNumber

                                };

                                if(dodActive && dodNum)
                                {
                                    ep.Origination = dodNum;
                                    ep.OriginationCallerIdNumber = dodNum;
                                }
                                else
                                {
                                    ep.Origination = rule.ANI;
                                    ep.OriginationCallerIdNumber = rule.ANI;
                                }

                                var limits = {
                                    NumberOutboundLimit: rule.OutLimit,
                                    NumberBothLimit: rule.BothLimit,
                                    CompanyOutboundLimit: compLimits.OutboundLimit,
                                    CompanyBothLimit: compLimits.BothLimit
                                };

                                var NumLimitInfo = LimitValidator(limits, rule.TrunkNumber, 'outbound');

                                if(NumLimitInfo)
                                {
                                    ep.Limits = NumLimitInfo;
                                    epList.push(ep);
                                }

                                count++;

                                if(count >= len)
                                {
                                    var tempEpList = underscore.sortBy(epList, 'Priority');
                                    callback(undefined, tempEpList);
                                }
                            }
                            else
                            {
                                count++;

                                if(count >= len)
                                {
                                    var tempEpList = underscore.sortBy(epList, 'Priority');
                                    callback(undefined, tempEpList);
                                }
                            }
                        })
                    }
                    else if(fm.ObjCategory === 'PBXUSER' || fm.ObjCategory === 'USER')
                    {
                        backendFactory.getBackendHandler().GetAllDataForExt(reqId, fm.DestinationNumber, companyId, tenantId, 'USER', csId, cacheData, function (err, extDetails)
                        {

                            if (!err && extDetails)
                            {
                                if (extDetails.SipUACEndpoint && extDetails.SipUACEndpoint.CloudEndUser)
                                {
                                    var ep =
                                    {
                                        Profile: '',
                                        Type: 'USER',
                                        LegStartDelay: 0,
                                        BypassMedia: fm.BypassMedia,
                                        LegTimeout: fm.RingTimeout,
                                        Origination: callerIdName,
                                        OriginationCallerIdNumber: callerIdNum,
                                        Destination: fm.DestinationNumber,
                                        Domain: extDetails.SipUACEndpoint.CloudEndUser.Domain,
                                        CompanyId: companyId,
                                        TenantId: tenantId,
                                        AppId: appId,
                                        Action: 'FOLLOW_ME',
                                        Priority: fm.Priority
                                    };


                                    if(extDetails.SipUACEndpoint.UsePublic)
                                    {
                                        ep.Profile = 'external';
                                        ep.Type = 'PUBLIC_USER';
                                        ep.Destination = extDetails.SipUACEndpoint.SipUsername;
                                        ep.Domain = extDetails.SipUACEndpoint.Domain;
                                    }

                                    epList.push(ep);

                                    count++;

                                    if(count >= len)
                                    {
                                        var tempEpList = underscore.sortBy(epList, 'Priority');
                                        callback(undefined, tempEpList);
                                    }
                                }
                                else
                                {
                                    count++;

                                    if(count >= len)
                                    {
                                        var tempEpList = underscore.sortBy(epList, 'Priority');
                                        callback(undefined, tempEpList);
                                    }
                                }
                            }
                            else
                            {
                                count++;

                                if(count >= len)
                                {
                                    var tempEpList = underscore.sortBy(epList, 'Priority');
                                    callback(undefined, tempEpList);
                                }
                            }

                        });
                    }
                    else
                    {
                        count++;

                        if(count >= len)
                        {
                            var tempEpList = underscore.sortBy(epList, 'Priority');
                            callback(undefined, tempEpList);
                        }

                    }
                }
                else
                {
                    var tempEpList = underscore.sortBy(epList, 'Priority');
                    callback(undefined, tempEpList);
                }
            });



        }).catch(function(err)
        {
            logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error getting company limits', reqId);
            callback(err, xmlBuilder.createRejectResponse());

        });


    }
    catch(ex)
    {
        var tempEpList = underscore.sortBy(epList, 'Priority');
        callback(ex, tempEpList);
    }
};

var AttendantTransferLegInfoHandler = function(reqId, fromUser, toUser)
{
    try
    {
        var AttTransLegInfo =
        {
            InternalLegs: '',
            ExternalLegs: '',
            GroupLegs: '',
            ConferenceLegs: '',
            IVRLegs: ''
        };
        if(fromUser)
        {
            //a leg processing
            AttTransLegInfo.TransferCode = fromUser.TransferCode;
            if(fromUser.TransInternalEnable)
            {
                AttTransLegInfo.InternalLegs = 'a';
            }
            if(fromUser.TransExternalEnable)
            {
                AttTransLegInfo.ExternalLegs = 'a';
            }
            if(fromUser.TransGroupEnable)
            {
                AttTransLegInfo.GroupLegs = 'a';
            }
            if(fromUser.TransConferenceEnable)
            {
                AttTransLegInfo.ConferenceLegs = 'a';
            }
            if(fromUser.TransIVREnable)
            {
                AttTransLegInfo.IVRLegs = 'a';
            }

        }

        if(toUser)
        {
            //b leg processing
            AttTransLegInfo.TransferCode = toUser.TransferCode;
            if(toUser.TransInternalEnable)
            {
                AttTransLegInfo.InternalLegs = AttTransLegInfo.InternalLegs + 'b';
            }
            if(toUser.TransExternalEnable)
            {
                AttTransLegInfo.ExternalLegs = AttTransLegInfo.ExternalLegs + 'b';
            }
            if(toUser.TransGroupEnable)
            {
                AttTransLegInfo.GroupLegs = AttTransLegInfo.GroupLegs + 'b';
            }
            if(toUser.TransConferenceEnable)
            {
                AttTransLegInfo.ConferenceLegs = AttTransLegInfo.ConferenceLegs + 'b';
            }
            if(toUser.TransIVREnable)
            {
                AttTransLegInfo.IVRLegs = AttTransLegInfo.IVRLegs + 'b';
            }
        }

        logger.debug('DVP-DynamicConfigurationGenerator.AttendantTransferLegInfoHandler] - [%s] - Attendant Transfer Details : ', reqId, JSON.stringify(AttTransLegInfo));

        return AttTransLegInfo;
    }
    catch(ex)
    {
        logger.error('DVP-DynamicConfigurationGenerator.AttendantTransferLegInfoHandler] - [%s] - Error occurred', reqId, ex);
        return null;
    }
};

var CheckIddValidity = function(dnis, trNum)
{
    try
    {

        var dnisNumberType = libphonenumber.phoneUtil.getNumberType(libphonenumber.phoneUtil.parseAndKeepRawInput(dnis, null));

        if(dnisNumberType === 3 || dnisNumberType === 9)
        {
            return true;
        }
        else
        {
            var dnisCountryCode = libphonenumber.phoneUtil.getRegionCodeForNumber(libphonenumber.phoneUtil.parseAndKeepRawInput(dnis, null));
            var trNumCountryCode = libphonenumber.phoneUtil.getRegionCodeForNumber(libphonenumber.phoneUtil.parseAndKeepRawInput(trNum, null));

            if(dnisCountryCode === trNumCountryCode)
            {
                return true;
            }
            else
            {
                return false;
            }
        }
    }
    catch(err)
    {
        logger.error('DVP-DynamicConfigurationGenerator.CheckIddValidity] - ERROR occurred', err);
        return false;
    }

};


var ProcessCallForwarding = function(reqId, aniNum, dnisNum, callerDomain, context, direction, extraData, companyId, tenantId, disconReason, fwdId, dodNumber, securityToken, origName, origNum, csId, cacheData, callback)
{
    try
    {
        //Get fwd obj from redis
        var profile = '';
        var uuid = '';
        var variableUserId = '';
        var huntDestinationNumber = '';
        var switchname = '';
        var callerIdNum = '';
        var callerIdName = '';
        var csId = -1;


        if(extraData)
        {
            profile = extraData['variable_sofia_profile_name'];
            variableUserId = extraData['variable_user_id'];
            huntDestinationNumber = extraData['Hunt-Destination-Number'];
            uuid = extraData['variable_uuid'];
            switchname = extraData['hostname'];
            csId = parseInt(extraData['hostname']);
        }

        redisHandler.GetObject(reqId, fwdId, function(err, redisObj)
        {
            //match discon reason

            if(err)
            {
                logger.error('DVP-DynamicConfigurationGenerator.ProcessCallForwarding] - [%s] - Error occurred while getting fwd obj from redis', reqId, err);
                callback(err, xmlBuilder.createRejectResponse());
            }
            else if(redisObj)
            {
                logger.debug('DVP-DynamicConfigurationGenerator.ProcessCallForwarding] - [%s] - Redis object found : ', reqId, redisObj);
                var fwdList = JSON.parse(redisObj);

                if(fwdList && fwdList.length > 0)
                {
                    var fwdRule = underscore.find(fwdList, function(fwdRecord){return fwdRecord.DisconnectReason === disconReason});

                    if(fwdRule)
                    {
                        if(fwdRule.ObjCategory === 'GATEWAY')
                        {
                            logger.debug('DVP-DynamicConfigurationGenerator.ProcessCallForwarding] - [%s] - Gateway Forward', reqId);
                            //pick outbound rule
                            backendFactory.getRuleHandler().PickCallRuleOutboundComplete(reqId, origNum, fwdRule.DestinationNumber, '', context, companyId, tenantId, false, cacheData, function(err, rule)
                            {
                                if(err)
                                {
                                    logger.error('DVP-DynamicConfigurationGenerator.ProcessCallForwarding] - [%s] - Outbound rule for gateway forward not found', reqId, err);
                                    callback(err, xmlBuilder.createRejectResponse());
                                }
                                else if(rule)
                                {
                                    logger.debug('DVP-DynamicConfigurationGenerator.ProcessCallForwarding] - [%s] - Outbound rule for gateway forward found', reqId);

                                    var ringTout = 60;

                                    if(fwdRule.RingTimeout)
                                    {
                                        ringTout = fwdRule.RingTimeout;
                                    }

                                    var ep =
                                    {
                                        Profile: rule.GatewayCode,
                                        Type: 'GATEWAY',
                                        LegStartDelay: 0,
                                        LegTimeout:ringTout,
                                        BypassMedia: false,
                                        Origination: rule.ANI,
                                        OriginationCallerIdNumber: rule.ANI,
                                        Destination: rule.DNIS,
                                        Domain: rule.IpUrl,
                                        TrunkNumber: rule.TrunkNumber,
                                        NumberType: rule.NumberType,
                                        CompanyId: rule.CompanyId,
                                        TenantId: rule.TenantId,
                                        Action: 'FORWARDING',
                                        Operator: rule.Operator
                                    };

                                    if(dodNumber)
                                    {
                                        ep.Origination = dodNumber;
                                        ep.OriginationCallerIdNumber = dodNumber;
                                    }

                                    extApi.CheckBalance(reqId, uuid, ep.Origination, ep.Destination, 'minute', ep.Operator, ep.CompanyId, ep.TenantId)
                                        .then(function(balanceRes)
                                        {
                                            if (balanceRes && balanceRes.IsSuccess)
                                            {
                                                backendFactory.getBackendHandler().getContextPreferences(context, 'public', companyId, tenantId).then(function(codecPrefs)
                                                {
                                                    var tempCodecPref = null;
                                                    if(codecPrefs)
                                                    {
                                                        tempCodecPref = codecPrefs.Codecs;
                                                    }

                                                    backendFactory.getBackendHandler().GetCompanyLimits(companyId, tenantId).then(function(compLimits)
                                                    {
                                                        var limits = {
                                                            NumberOutboundLimit: rule.OutLimit,
                                                            NumberBothLimit: rule.BothLimit,
                                                            CompanyOutboundLimit: compLimits.OutboundLimit,
                                                            CompanyBothLimit: compLimits.BothLimit
                                                        };

                                                        var NumLimitInfo = LimitValidator(limits, rule.TrunkNumber, 'outbound');

                                                        if(NumLimitInfo)
                                                        {
                                                            ep.Limits = NumLimitInfo;
                                                            var xml = xmlBuilder.CreateRouteGatewayDialplan(reqId, ep, context, profile, '[^\\s]*', false, null, null, tempCodecPref, null);

                                                            callback(null, xml);
                                                        }
                                                        else
                                                        {
                                                            logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Limits not defined', reqId);
                                                            callback(err, xmlBuilder.createRejectResponse());
                                                        }



                                                    }).catch(function(err)
                                                    {
                                                        logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error getting company limits', reqId);
                                                        callback(err, xmlBuilder.createRejectResponse());

                                                    });





                                                }).catch(function(err)
                                                {
                                                    logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                    callback(err, xmlBuilder.createRejectResponse());
                                                });

                                            }
                                            else
                                            {
                                                callback(new Error('insufficient balance'), xmlBuilder.createRejectResponse());
                                            }

                                        })
                                        .catch(function(err)
                                        {
                                            callback(err, xmlBuilder.createRejectResponse());
                                        })


                                }
                                else
                                {
                                    logger.debug('DVP-DynamicConfigurationGenerator.ProcessCallForwarding] - [%s] - Outbound rule for gateway forward not found', reqId);
                                    callback(undefined, xmlBuilder.createRejectResponse());
                                }
                            })
                        }
                        else
                        {
                            //pick extension
                            logger.debug('DVP-DynamicConfigurationGenerator.ProcessCallForwarding] - [%s] - Extension Forward - DestNum : %s, tenantId : %d', reqId, fwdRule.DestinationNumber, tenantId);
                            backendFactory.getBackendHandler().GetAllDataForExt(reqId, fwdRule.DestinationNumber, companyId, tenantId, 'USER', csId, cacheData, function(err, extDetails)
                            {
                                if(err)
                                {
                                    logger.error('DVP-DynamicConfigurationGenerator.ProcessCallForwarding] - [%s] - Error occurred while getting all data for ext for forward', reqId, err);
                                    callback(err, xmlBuilder.createRejectResponse());
                                }
                                else if(extDetails)
                                {
                                    logger.debug('DVP-DynamicConfigurationGenerator.ProcessCallForwarding] - [%s] - Extension details found for extension Forward', reqId);
                                    if (extDetails.SipUACEndpoint && extDetails.SipUACEndpoint.CloudEndUser)
                                    {
                                        logger.debug('DVP-DynamicConfigurationGenerator.ProcessCallForwarding] - [%s] - Cloud enduser is set', reqId);
                                        var bypassMedia = false;

                                        var grp = '';

                                        var domain = '';

                                        if(extDetails.SipUACEndpoint && extDetails.SipUACEndpoint.CloudEndUser)
                                        {
                                            domain = extDetails.SipUACEndpoint.CloudEndUser.Domain;
                                        }

                                        if(extDetails.SipUACEndpoint.UserGroup && extDetails.SipUACEndpoint.UserGroup.Extension)
                                        {
                                            grp = extDetails.SipUACEndpoint.UserGroup.Extension.Extension;
                                        }

                                        var ringTout = 60;

                                        if(fwdRule.RingTimeout)
                                        {
                                            ringTout = fwdRule.RingTimeout;
                                        }

                                        var ep =
                                        {
                                            Profile: '',
                                            Type: 'USER',
                                            LegStartDelay: 0,
                                            BypassMedia: bypassMedia,
                                            LegTimeout: ringTout,
                                            Origination: origName,
                                            OriginationCallerIdNumber: origNum,
                                            Destination: fwdRule.DestinationNumber,
                                            Domain: domain,
                                            Group: grp,
                                            CompanyId: companyId,
                                            TenantId: tenantId,
                                            Action: 'FORWARDING'
                                        };

                                        var customStr = tenantId + '_' + extDetails.Extension + '_PBXUSERCALL';

                                        redisHandler.SetObjectWithExpire(customStr, uuid, 60, function(err, redisResult)
                                        {
                                            if(!err && redisResult)
                                            {
                                                logger.debug('DVP-DynamicConfigurationGenerator.ProcessCallForwarding] - [%s] - Redis set object success', reqId);

                                                var attTransInfo = AttendantTransferLegInfoHandler(reqId, null, extDetails.SipUACEndpoint);

                                                backendFactory.getBackendHandler().getContextPreferences(context, extDetails.SipUACEndpoint.ContextId, companyId, tenantId).then(function(codecPrefs)
                                                {
                                                    var tempCodecPref = null;
                                                    if(codecPrefs)
                                                    {
                                                        tempCodecPref = codecPrefs.Codecs;
                                                    }
                                                    var xml = xmlBuilder.CreateRouteUserDialplan(reqId, ep, context, profile, '[^\\s]*', false, undefined, attTransInfo, null, tempCodecPref);

                                                    callback(undefined, xml);

                                                }).catch(function(err)
                                                {
                                                    logger.debug('DVP-DynamicConfigurationGenerator.ProcessCallForwarding] - [%s] - Redis set object failed', reqId);
                                                    callback(err, xmlBuilder.createRejectResponse());
                                                });

                                            }
                                            else
                                            {
                                                logger.debug('DVP-DynamicConfigurationGenerator.ProcessCallForwarding] - [%s] - Redis set object failed', reqId);
                                                callback(undefined, xmlBuilder.createRejectResponse());
                                            }
                                        })


                                    }
                                    else
                                    {
                                        logger.debug('DVP-DynamicConfigurationGenerator.ProcessCallForwarding] - [%s] - Cloud enduser not set', reqId);
                                        callback(undefined, xmlBuilder.createRejectResponse());
                                    }
                                }
                                else
                                {
                                    logger.debug('DVP-DynamicConfigurationGenerator.ProcessCallForwarding] - [%s] - Extension details not found', reqId, err);
                                    callback(undefined, xmlBuilder.createRejectResponse());
                                }
                            });

                        }
                    }
                    else
                    {
                        logger.debug('DVP-DynamicConfigurationGenerator.ProcessCallForwarding] - [%s] - No objects in forwarding rule not found', reqId);
                        callback(undefined, xmlBuilder.createRejectResponse());
                    }
                }
                else
                {
                    logger.debug('DVP-DynamicConfigurationGenerator.ProcessCallForwarding] - [%s] - No objects in forwarding list', reqId);
                    callback(undefined, xmlBuilder.createRejectResponse());
                }
            }
            else
            {
                logger.debug('DVP-DynamicConfigurationGenerator.ProcessCallForwarding] - [%s] - Redis object not found : ', reqId);
                callback(undefined, xmlBuilder.createRejectResponse());
            }
        })

        //check number type
        //pick extension or rule
        //route to destination

    }
    catch(ex)
    {
        callback(ex, xmlBuilder.createRejectResponse());

    }
};

var handleIVRExt = function(reqId, companyId, tenantId, uuid, context, extDetails, isTransfer, ani)
{

    return new Promise(function(fulfill, reject)
    {
        if(extDetails.Application && extDetails.Application.Availability)
        {
            var app = extDetails.Application;

            if(extDetails.Application.MasterApplication && extDetails.Application.MasterApplication.Availability && extDetails.Application.MasterApplication.Url)
            {
                var masterUrl = '';
                var masterApp = extDetails.Application.MasterApplication;

                if(masterApp.ObjType === "HTTAPI")
                {
                    logger.info('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Master App Type is HTTAPI for Extension IVR', reqId);
                    //add to redis
                    masterUrl = masterApp.Url;
                    var sessionData =
                    {
                        path: app.Url,
                        company: companyId,
                        tenant: tenantId,
                        app: app.AppName,
                        appid: app.id
                    };

                    var jsonString = JSON.stringify(sessionData);

                    logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Session Data Object created for HTTAPI : %s', reqId, jsonString);

                    redisHandler.SetObject(uuid + "_data", jsonString, function(err, result)
                    {
                        if(err)
                        {
                            reject(err);
                        }
                        else
                        {
                            redisHandler.ExpireKey(uuid + "_data", 86400);
                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Session data added to redis successfully - Key : %s_data', reqId, uuid);

                            var xml = '';

                            if(isTransfer)
                            {
                                xml = xmlRespBuilder.CreateHttpApiDialplanTransfer('[^\\s]*', context, masterUrl, reqId, null, app.id, companyId, tenantId, 'outbound', ani);
                            }
                            else
                            {
                                xml = xmlRespBuilder.CreateHttpApiDialplan('[^\\s]*', context, masterUrl, reqId, null, app.id, companyId, tenantId, 'outbound', ani);
                            }

                            fulfill(xml);
                        }

                    });

                }
            }
            else
            {
                reject(new Error('Master application not found for IVR extension'));
            }
        }
        else
        {
            reject(new Error('Application not found for IVR extension'));
        }
    })



};


var ProcessExtendedDialplan = function(reqId, ani, dnis, context, direction, extraData, fromUserData, companyId, tenantId, securityToken, numLimitInfo, dvpCallDirection, ctxt, cacheData, callback)
{

    try
    {
        var profile = '';
        var variableUserId = '';
        var huntDestinationNumber = '';
        var callerIdNum = '';
        var callerIdName = '';
        var uuid = '';
        var toFaxType = undefined;
        var fromFaxType = undefined;
        var ctxtRecordingEnabled = false;
        var url = '';
        var appId = '';
        var csId = -1;
        var appType = '';

        if(ctxt && ctxt.RecordingEnabled)
        {
            ctxtRecordingEnabled = ctxt.RecordingEnabled;
        }

        if(extraData)
        {
            profile = extraData['variable_sofia_profile_name'];
            variableUserId = extraData['Caller-ANI'];
            huntDestinationNumber = extraData['Hunt-Destination-Number'];
            callerIdNum = extraData['Caller-Caller-ID-Number'];
            callerIdName = extraData['Caller-Caller-ID-Name'];
            uuid = extraData['variable_uuid'];
            fromFaxType = extraData['TrunkFaxType'];
            url = extraData['DVPAppUrl'];
            appId = extraData['AppId'];
            csId = parseInt(extraData['hostname']);
            appType = extraData['variable_dvp_app_type'];

            var opCat = extraData["variable_DVP_OPERATION_CAT"];
            var currentApp = extraData["variable_current_application"];

            if(opCat === 'AUTO_ATTENDANT')
            {
                appType = 'AUTO_ATTENDANT';
            }
            else if(opCat == 'DIALER')
            {
                appType = 'DIALER';
            }
            else if(opCat === 'ATT_XFER_IVR' || extraData['IsIVRTransfer'])
            {
                appType = 'IVR_TRANSFER';
            }

            if(currentApp === 'voicemail')
            {
                appType = 'VOICEMAIL';
            }
        }



        //Get ANI DNIS Context

        //Check for DID
        if(direction === 'IN')
        {
            logger.debug('[DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Checking for DID', reqId);
            backendFactory.getBackendHandler().GetExtensionForDid(reqId, dnis, companyId, tenantId, cacheData, function(err, didRes)
            {
                if(err)
                {
                    callback(err, xmlBuilder.createRejectResponse());
                }
                else if(didRes && didRes.Extension)
                {
                    logger.debug('[DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - DID FOUND - Mapped to extension : %s', reqId, didRes.Extension.Extension);

                    logger.debug('[DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Trying to get full extension details - Extension : %s, Category : %s', reqId, didRes.Extension.Extension, didRes.Extension.ObjCategory);

                    backendFactory.getBackendHandler().GetAllDataForExt(reqId, didRes.Extension.Extension, companyId, tenantId, didRes.Extension.ObjCategory, csId, cacheData, function(err, extDetails)
                    {
                        if(err)
                        {
                            //return default xml
                            logger.error('[DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error occurred getting AllDataForExt', reqId, err);

                            callback(err, xmlBuilder.createRejectResponse());
                        }
                        else if(extDetails)
                        {
                            logger.debug('[DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - TO EXTENSION FOUND - TYPE : %s', reqId, extDetails.ObjCategory);
                            toFaxType = extDetails.ExtraData;
                            if(extDetails.ObjCategory === 'USER')
                            {
                                if(extDetails.SipUACEndpoint)
                                {
                                    //Check extension type and handle accordingly
                                    var grp = '';
                                    var toUsrDomain = '';

                                    if(extDetails.SipUACEndpoint && extDetails.SipUACEndpoint.CloudEndUser)
                                    {
                                        toUsrDomain = extDetails.SipUACEndpoint.CloudEndUser.Domain;
                                    }

                                    if(extDetails.SipUACEndpoint.UserGroup && extDetails.SipUACEndpoint.UserGroup.Extension)
                                    {
                                        grp = extDetails.SipUACEndpoint.UserGroup.Extension.Extension;
                                    }

                                    if(url)
                                    {
                                        extApi.RemoteGetDialplanConfig(reqId, ani, dnis, context, direction, extDetails.SipUACEndpoint.SipUserUuid, undefined, extDetails.ObjCategory, undefined, appId, url, companyId, tenantId, securityToken, function(err, pbxDetails)
                                        {
                                            if(err)
                                            {
                                                callback(err, xmlBuilder.createRejectResponse());
                                            }
                                            else if(!pbxDetails)
                                            {
                                                var recEnabled = false;

                                                if((extDetails.SipUACEndpoint.Context && extDetails.SipUACEndpoint.Context.RecordingEnabled) || extDetails.SipUACEndpoint.RecordingEnabled)
                                                {
                                                    recEnabled = true;
                                                }
                                                else
                                                {
                                                    recEnabled = false;
                                                }

                                                var ep =
                                                {
                                                    Profile: profile,
                                                    Type: 'USER',
                                                    LegStartDelay: 0,
                                                    BypassMedia: false,
                                                    LegTimeout: 60,
                                                    Origination: callerIdName,
                                                    OriginationCallerIdNumber: callerIdNum,
                                                    Destination: extDetails.Extension,
                                                    Domain: toUsrDomain,
                                                    Group: undefined,
                                                    IsVoicemailEnabled: false,
                                                    PersonalGreeting: false,
                                                    CompanyId: companyId,
                                                    TenantId: tenantId,
                                                    AppId: appId,
                                                    Action: 'DEFAULT',
                                                    RecordEnabled: recEnabled
                                                };

                                                var customStr = tenantId + '_' + extDetails.Extension + '_PBXUSERCALL';


                                                redisHandler.SetObjectWithExpire(customStr, uuid, 60, function(err, redisResult)
                                                {
                                                    if(!err && redisResult)
                                                    {
                                                        var attTransInfo = AttendantTransferLegInfoHandler(reqId, null, extDetails.SipUACEndpoint);

                                                        if(extDetails.SipUACEndpoint.UsePublic)
                                                        {
                                                            ep.Profile = 'external';
                                                            ep.Type = 'PUBLIC_USER';
                                                            ep.Destination = extDetails.SipUACEndpoint.SipUsername;
                                                            ep.Domain = extDetails.SipUACEndpoint.Domain;
                                                        }

                                                        backendFactory.getBackendHandler().getContextPreferences(context, extDetails.SipUACEndpoint.ContextId, companyId, tenantId).then(function(codecPrefs)
                                                        {
                                                            var tempCodecPref = null;
                                                            if(codecPrefs)
                                                            {
                                                                tempCodecPref = codecPrefs.Codecs;
                                                            }

                                                            var xml = xmlBuilder.CreateRouteUserDialplan(reqId, ep, context, profile, '[^\\s]*', false, numLimitInfo, attTransInfo, dvpCallDirection, tempCodecPref);

                                                            callback(undefined, xml);

                                                        }).catch(function(err)
                                                        {
                                                            logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                            callback(err, xmlBuilder.createRejectResponse());
                                                        });


                                                    }
                                                    else
                                                    {
                                                        callback(err, xmlBuilder.createRejectResponse());
                                                    }
                                                });
                                            }
                                            else
                                            {
                                                logger.info('[DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - REMOTE EXTENDED DIALPLAN FOUND', reqId);

                                                if(pbxDetails.OperationType === 'DENY')
                                                {
                                                    callback(null, xmlBuilder.CreateOutboundDeniedMessageDialplan(reqId, '[^\\s]*', context, companyId, tenantId, appId, dvpCallDirection));
                                                }
                                                else
                                                {
                                                    var pbxObj = pbxDetails;


                                                    var voicemailEnabled = pbxObj.VoicemailEnabled;
                                                    var personalGreeting = pbxObj.PersonalGreeting;
                                                    var bypassMedia = pbxObj.BypassMedia;

                                                    var ringTime = 60;

                                                    if(pbxObj.RingTimeout)
                                                    {
                                                        ringTime = pbxObj.RingTimeout;
                                                    }

                                                    logger.info('[DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - OPERATION TYPE : %s', reqId, pbxObj.OperationType);


                                                    if(pbxObj.OperationType === 'DND')
                                                    {
                                                        var xml = xmlBuilder.CreateSendBusyMessageDialplan(reqId, '[^\\s]*', context, numLimitInfo, companyId, tenantId, appId, dvpCallDirection);

                                                        callback(undefined, xml);
                                                    }
                                                    else if(pbxObj.OperationType === 'USER_DIAL')
                                                    {

                                                        var recEnabled = false;

                                                        if((extDetails.SipUACEndpoint.Context && extDetails.SipUACEndpoint.Context.RecordingEnabled) || extDetails.SipUACEndpoint.RecordingEnabled)
                                                        {
                                                            recEnabled = true;
                                                        }
                                                        else
                                                        {
                                                            recEnabled = false;
                                                        }

                                                        var ep =
                                                        {
                                                            Profile: profile,
                                                            Type: 'USER',
                                                            LegStartDelay: 0,
                                                            BypassMedia: false,
                                                            LegTimeout: ringTime,
                                                            Origination: callerIdName,
                                                            OriginationCallerIdNumber: callerIdNum,
                                                            Destination: extDetails.Extension,
                                                            Domain: toUsrDomain,
                                                            Group: grp,
                                                            IsVoicemailEnabled: voicemailEnabled,
                                                            PersonalGreeting: personalGreeting,
                                                            CompanyId: companyId,
                                                            TenantId: tenantId,
                                                            AppId: appId,
                                                            Action: 'DEFAULT',
                                                            RecordEnabled: recEnabled
                                                        };

                                                        var customStr = tenantId + '_' + extDetails.Extension + '_PBXUSERCALL';

                                                        redisHandler.SetObjectWithExpire(customStr, uuid, 60, function(err, redisResult)
                                                        {
                                                            if(!err && redisResult)
                                                            {
                                                                var attTransInfo = AttendantTransferLegInfoHandler(reqId, null, extDetails.SipUACEndpoint);

                                                                if(extDetails.SipUACEndpoint.UsePublic)
                                                                {
                                                                    ep.Profile = 'external';
                                                                    ep.Type = 'PUBLIC_USER';
                                                                    ep.Destination = extDetails.SipUACEndpoint.SipUsername;
                                                                    ep.Domain = extDetails.SipUACEndpoint.Domain;
                                                                }

                                                                backendFactory.getBackendHandler().getContextPreferences(context, extDetails.SipUACEndpoint.ContextId, companyId, tenantId).then(function(codecPrefs)
                                                                {
                                                                    var tempCodecPref = null;
                                                                    if(codecPrefs)
                                                                    {
                                                                        tempCodecPref = codecPrefs.Codecs;
                                                                    }
                                                                    var xml = xmlBuilder.CreateRouteUserDialplan(reqId, ep, context, profile, '[^\\s]*', false, numLimitInfo, attTransInfo, dvpCallDirection, tempCodecPref);

                                                                    callback(undefined, xml);

                                                                }).catch(function(err)
                                                                {
                                                                    logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                                    callback(err, xmlBuilder.createRejectResponse());
                                                                });


                                                            }
                                                            else
                                                            {
                                                                callback(err, xmlBuilder.createRejectResponse());
                                                            }
                                                        });
                                                    }
                                                    else if(pbxObj.OperationType === 'FOLLOW_ME')
                                                    {
                                                        if(pbxDetails.Endpoints && pbxDetails.Endpoints.length > 0)
                                                        {
                                                            CreateFMEndpointList(reqId, ani, context, companyId, tenantId, pbxDetails.Endpoints, '', false, callerIdNum, callerIdName, csId, appId, cacheData, function(err, epList)
                                                            {
                                                                if(err)
                                                                {
                                                                    callback(err, xmlBuilder.createRejectResponse());
                                                                }
                                                                else if(epList && epList.length > 0)
                                                                {
                                                                    var xml = xmlBuilder.CreateFollowMeDialplan(reqId, epList, context, profile, '[^\\s]*', false, numLimitInfo, companyId, tenantId, appId, dvpCallDirection);

                                                                    callback(undefined, xml);
                                                                }
                                                                else
                                                                {
                                                                    callback(err, xmlBuilder.createRejectResponse());
                                                                }
                                                            })
                                                        }
                                                    }
                                                    else if(pbxObj.OperationType === 'FORWARD')
                                                    {
                                                        if(pbxDetails.Endpoints)
                                                        {
                                                            var ep =
                                                            {
                                                                Profile: profile,
                                                                Type: 'USER',
                                                                LegStartDelay: 0,
                                                                BypassMedia: false,
                                                                LegTimeout: ringTime,
                                                                Origination: callerIdName,
                                                                OriginationCallerIdNumber: callerIdNum,
                                                                Destination: extDetails.Extension,
                                                                Domain: toUsrDomain,
                                                                Group: grp,
                                                                CompanyId: companyId,
                                                                TenantId: tenantId,
                                                                AppId: appId,
                                                                Action: 'DEFAULT'
                                                            };

                                                            if(dodActive && dodNumber)
                                                            {
                                                                ep.DodNumber = dodNumber;
                                                            }

                                                            var pbxFwdKey = util.format('DVPFORWARDING_%d_%d_%s', companyId, tenantId, pbxDetails.UserRefId);
                                                            var forwardingInfo = JSON.stringify(pbxDetails.Endpoints);

                                                            redisHandler.SetObjectWithExpire(pbxFwdKey, forwardingInfo, 360, function(err, redisResp)
                                                            {
                                                                if(err)
                                                                {
                                                                    callback(err, xmlBuilder.createRejectResponse());
                                                                }
                                                                else
                                                                {
                                                                    if(extDetails.SipUACEndpoint.UsePublic)
                                                                    {
                                                                        ep.Profile = 'external';
                                                                        ep.Type = 'PUBLIC_USER';
                                                                        ep.Destination = extDetails.SipUACEndpoint.SipUsername;
                                                                        ep.Domain = extDetails.SipUACEndpoint.Domain;
                                                                        ep.BypassMedia = false;
                                                                    }

                                                                    var attTransInfo = AttendantTransferLegInfoHandler(reqId, null, extDetails.SipUACEndpoint);

                                                                    backendFactory.getBackendHandler().getContextPreferences(context, extDetails.SipUACEndpoint.ContextId, companyId, tenantId).then(function(codecPrefs)
                                                                    {
                                                                        var tempCodecPref = null;
                                                                        if(codecPrefs)
                                                                        {
                                                                            tempCodecPref = codecPrefs.Codecs;
                                                                        }

                                                                        var xml = xmlBuilder.CreateForwardingDialplan(reqId, ep, context, profile, '[^\\s]*', false, pbxFwdKey, numLimitInfo, attTransInfo, dvpCallDirection, tempCodecPref);

                                                                        callback(undefined, xml);

                                                                    }).catch(function(err)
                                                                    {
                                                                        logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                                        callback(err, xmlBuilder.createRejectResponse());
                                                                    });


                                                                }
                                                            });
                                                        }
                                                        else
                                                        {
                                                            var ep =
                                                            {
                                                                Profile: profile,
                                                                Type: 'USER',
                                                                LegStartDelay: 0,
                                                                BypassMedia: false,
                                                                LegTimeout: ringTime,
                                                                Origination: callerIdName,
                                                                OriginationCallerIdNumber: callerIdNum,
                                                                Destination: extDetails.Extension,
                                                                Domain: toUsrDomain,
                                                                Group: grp,
                                                                IsVoicemailEnabled: voicemailEnabled,
                                                                PersonalGreeting: personalGreeting,
                                                                CompanyId: companyId,
                                                                TenantId: tenantId,
                                                                AppId: appId,
                                                                Action: 'DEFAULT'
                                                            };

                                                            var customStr = tenantId + '_' + extDetails.Extension + '_PBXUSERCALL';

                                                            redisHandler.SetObjectWithExpire(customStr, uuid, 60, function(err, redisResult)
                                                            {
                                                                if(!err && redisResult)
                                                                {
                                                                    var attTransInfo = AttendantTransferLegInfoHandler(reqId, null, extDetails.SipUACEndpoint);

                                                                    if(extDetails.SipUACEndpoint.UsePublic)
                                                                    {
                                                                        ep.Profile = 'external';
                                                                        ep.Type = 'PUBLIC_USER';
                                                                        ep.Destination = extDetails.SipUACEndpoint.SipUsername;
                                                                        ep.Domain = extDetails.SipUACEndpoint.Domain;
                                                                    }

                                                                    backendFactory.getBackendHandler().getContextPreferences(context, extDetails.SipUACEndpoint.ContextId, companyId, tenantId).then(function(codecPrefs)
                                                                    {
                                                                        var tempCodecPref = null;
                                                                        if(codecPrefs)
                                                                        {
                                                                            tempCodecPref = codecPrefs.Codecs;
                                                                        }
                                                                        var xml = xmlBuilder.CreateRouteUserDialplan(reqId, ep, context, profile, '[^\\s]*', false, numLimitInfo, attTransInfo, dvpCallDirection, tempCodecPref);

                                                                        callback(undefined, xml);

                                                                    }).catch(function(err)
                                                                    {
                                                                        logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                                        callback(err, xmlBuilder.createRejectResponse());
                                                                    });


                                                                }
                                                                else
                                                                {
                                                                    callback(err, xmlBuilder.createRejectResponse());
                                                                }
                                                            });

                                                        }

                                                    }
                                                    else if(pbxObj.OperationType === 'CALL_DIVERT')
                                                    {
                                                        //Check if divert number is an extension or not

                                                        if (pbxObj.Endpoints && pbxObj.Endpoints.ObjCategory === 'GATEWAY')
                                                        {
                                                            //pick outbound rule
                                                            backendFactory.getRuleHandler().PickCallRuleOutboundComplete(reqId, ani, pbxObj.Endpoints.DestinationNumber, '', context, companyId, tenantId, false, cacheData, function (err, rule)
                                                            {
                                                                if (!err && rule)
                                                                {
                                                                    var ep =
                                                                    {
                                                                        Profile: rule.GatewayCode,
                                                                        Type: 'GATEWAY',
                                                                        LegStartDelay: 0,
                                                                        BypassMedia: false,
                                                                        LegTimeout: 60,
                                                                        Destination: rule.DNIS,
                                                                        Domain: rule.IpUrl,
                                                                        CompanyId: companyId,
                                                                        TenantId: tenantId,
                                                                        AppId: appId,
                                                                        Action: 'CALL_DIVERT',
                                                                        Operator: rule.Operator
                                                                    };


                                                                    ep.Origination = rule.ANI;
                                                                    ep.OriginationCallerIdNumber = rule.ANI;

                                                                    var attTransInfo = AttendantTransferLegInfoHandler(reqId, fromUserData, null);

                                                                    extApi.CheckBalance(reqId, uuid, ep.Origination, ep.Destination, 'minute', ep.Operator, ep.CompanyId, ep.TenantId)
                                                                        .then(function(balanceRes)
                                                                        {
                                                                            if (balanceRes && balanceRes.IsSuccess)
                                                                            {
                                                                                backendFactory.getBackendHandler().getContextPreferences(context, 'public', companyId, tenantId).then(function(codecPrefs)
                                                                                {
                                                                                    var tempCodecPref = null;
                                                                                    if(codecPrefs)
                                                                                    {
                                                                                        tempCodecPref = codecPrefs.Codecs;
                                                                                    }

                                                                                    backendFactory.getBackendHandler().GetCompanyLimits(companyId, tenantId).then(function(compLimits)
                                                                                    {
                                                                                        var limits = {
                                                                                            NumberOutboundLimit: rule.OutLimit,
                                                                                            NumberBothLimit: rule.BothLimit,
                                                                                            CompanyOutboundLimit: compLimits.OutboundLimit,
                                                                                            CompanyBothLimit: compLimits.BothLimit
                                                                                        };

                                                                                        var NumLimitInfo = LimitValidator(limits, rule.TrunkNumber, 'outbound');

                                                                                        if(NumLimitInfo)
                                                                                        {
                                                                                            ep.Limits = NumLimitInfo;
                                                                                            var xml = xmlBuilder.CreateRouteGatewayDialplan(reqId, ep, context, profile, '[^\\s]*', false, attTransInfo, dvpCallDirection, tempCodecPref, numLimitInfo);

                                                                                            callback(null, xml);
                                                                                        }
                                                                                        else
                                                                                        {
                                                                                            logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Limits not defined', reqId);
                                                                                            callback(err, xmlBuilder.createRejectResponse());
                                                                                        }



                                                                                    }).catch(function(err)
                                                                                    {
                                                                                        logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error getting company limits', reqId);
                                                                                        callback(err, xmlBuilder.createRejectResponse());

                                                                                    });



                                                                                }).catch(function(err)
                                                                                {
                                                                                    logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                                                    callback(err, xmlBuilder.createRejectResponse());
                                                                                });


                                                                            }
                                                                            else
                                                                            {
                                                                                callback(new Error('insufficient balance'), xmlBuilder.createRejectResponse());
                                                                            }

                                                                        })
                                                                        .catch(function(err)
                                                                        {
                                                                            callback(err, xmlBuilder.createRejectResponse());
                                                                        })

                                                                }
                                                                else
                                                                {
                                                                    callback(new Error('Outbound rule not found'), xmlBuilder.createRejectResponse());
                                                                }
                                                            })
                                                        }
                                                        else if(pbxObj.Endpoints && (pbxObj.Endpoints.ObjCategory === 'PBXUSER' || pbxObj.Endpoints.ObjCategory === 'USER'))
                                                        {
                                                            backendFactory.getBackendHandler().GetAllDataForExt(reqId, pbxObj.Endpoints.DestinationNumber, companyId, tenantId, 'USER', csId, function (err, extDetails)
                                                            {
                                                                if (!err && extDetails)
                                                                {
                                                                    if (extDetails.SipUACEndpoint && extDetails.SipUACEndpoint.CloudEndUser)
                                                                    {
                                                                        var ep =
                                                                        {
                                                                            Profile: '',
                                                                            Type: 'USER',
                                                                            LegStartDelay: 0,
                                                                            BypassMedia: false,
                                                                            LegTimeout: 60,
                                                                            Origination: callerIdName,
                                                                            OriginationCallerIdNumber: callerIdNum,
                                                                            Destination: extDetails.Extension,
                                                                            Domain: extDetails.SipUACEndpoint.CloudEndUser.Domain,
                                                                            CompanyId: companyId,
                                                                            TenantId: tenantId,
                                                                            AppId: appId,
                                                                            Action: 'DEFAULT'
                                                                        };

                                                                        var attTransInfo = AttendantTransferLegInfoHandler(reqId, null, extDetails.SipUACEndpoint);

                                                                        if(extDetails.SipUACEndpoint.UsePublic)
                                                                        {
                                                                            ep.Profile = 'external';
                                                                            ep.Type = 'PUBLIC_USER';
                                                                            ep.Destination = extDetails.SipUACEndpoint.SipUsername;
                                                                            ep.Domain = extDetails.SipUACEndpoint.Domain;
                                                                        }

                                                                        backendFactory.getBackendHandler().getContextPreferences(context, extDetails.SipUACEndpoint.ContextId, companyId, tenantId).then(function(codecPrefs)
                                                                        {
                                                                            var tempCodecPref = null;
                                                                            if(codecPrefs)
                                                                            {
                                                                                tempCodecPref = codecPrefs.Codecs;
                                                                            }
                                                                            var xml = xmlBuilder.CreateRouteUserDialplan(reqId, ep, context, profile, '[^\\s]*', false, numLimitInfo, attTransInfo, tempCodecPref);
                                                                            callback(undefined, xml);

                                                                        }).catch(function(err)
                                                                        {
                                                                            logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                                            callback(err, xmlBuilder.createRejectResponse());
                                                                        });



                                                                    }
                                                                    else
                                                                    {
                                                                        callback(new Error('Sip user or cloud end user not found'), xmlBuilder.createRejectResponse());
                                                                    }
                                                                }
                                                                else
                                                                {
                                                                    callback(new Error('Extension not found'), xmlBuilder.createRejectResponse());
                                                                }

                                                            });
                                                        }
                                                        else
                                                        {
                                                            callback(new Error('PBX endpoints not found'), xmlBuilder.createRejectResponse());
                                                        }
                                                    }
                                                    else
                                                    {
                                                        logger.info('[DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - UNSUPPORTED OPERATION TYPE - TRYING NORMAL USER DIAL', reqId);
                                                        if(extDetails.SipUACEndpoint && extDetails.SipUACEndpoint.CloudEndUser)
                                                        {
                                                            domain = extDetails.SipUACEndpoint.CloudEndUser.Domain;
                                                        }

                                                        if(extDetails.SipUACEndpoint.UserGroup && extDetails.SipUACEndpoint.UserGroup.Extension)
                                                        {
                                                            grp = extDetails.SipUACEndpoint.UserGroup.Extension.Extension;
                                                        }

                                                        var recEnabled = false;

                                                        if((extDetails.SipUACEndpoint.Context && extDetails.SipUACEndpoint.Context.RecordingEnabled) || extDetails.SipUACEndpoint.RecordingEnabled)
                                                        {
                                                            recEnabled = true;
                                                        }
                                                        else
                                                        {
                                                            recEnabled = false;
                                                        }

                                                        var ep =
                                                        {
                                                            Profile: profile,
                                                            Type: 'USER',
                                                            LegStartDelay: 0,
                                                            BypassMedia: false,
                                                            LegTimeout: ringTime,
                                                            Origination: callerIdName,
                                                            OriginationCallerIdNumber: callerIdNum,
                                                            Destination: extDetails.Extension,
                                                            Domain: toUsrDomain,
                                                            Group: grp,
                                                            IsVoicemailEnabled: voicemailEnabled,
                                                            PersonalGreeting: personalGreeting,
                                                            CompanyId: companyId,
                                                            TenantId: tenantId,
                                                            AppId: appId,
                                                            Action: 'DEFAULT',
                                                            RecordEnabled: recEnabled
                                                        };

                                                        var customStr = tenantId + '_' + extDetails.Extension + '_PBXUSERCALL';

                                                        redisHandler.SetObjectWithExpire(customStr, uuid, 60, function(err, redisResult)
                                                        {
                                                            if(!err && redisResult)
                                                            {
                                                                var attTransInfo = AttendantTransferLegInfoHandler(reqId, null, extDetails.SipUACEndpoint);

                                                                if(extDetails.SipUACEndpoint.UsePublic)
                                                                {
                                                                    ep.Profile = 'external';
                                                                    ep.Type = 'PUBLIC_USER';
                                                                    ep.Destination = extDetails.SipUACEndpoint.SipUsername;
                                                                    ep.Domain = extDetails.SipUACEndpoint.Domain;
                                                                }

                                                                backendFactory.getBackendHandler().getContextPreferences(context, extDetails.SipUACEndpoint.ContextId, companyId, tenantId).then(function(codecPrefs)
                                                                {
                                                                    var tempCodecPref = null;
                                                                    if(codecPrefs)
                                                                    {
                                                                        tempCodecPref = codecPrefs.Codecs;
                                                                    }
                                                                    var xml = xmlBuilder.CreateRouteUserDialplan(reqId, ep, context, profile, '[^\\s]*', false, numLimitInfo, attTransInfo, dvpCallDirection, tempCodecPref);

                                                                    callback(undefined, xml);

                                                                }).catch(function(err)
                                                                {
                                                                    logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                                    callback(err, xmlBuilder.createRejectResponse());
                                                                });


                                                            }
                                                            else
                                                            {
                                                                callback(err, xmlBuilder.createRejectResponse());
                                                            }
                                                        });
                                                    }
                                                }



                                            }
                                        })
                                    }
                                    else
                                    {
                                        logger.info('[DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - APP URL NOT SET - TRYING NORMAL USER DIAL', reqId);

                                        var recEnabled = false;

                                        if((extDetails.SipUACEndpoint.Context && extDetails.SipUACEndpoint.Context.RecordingEnabled) || extDetails.SipUACEndpoint.RecordingEnabled)
                                        {
                                            recEnabled = true;
                                        }
                                        else
                                        {
                                            recEnabled = false;
                                        }

                                        var ep =
                                        {
                                            Profile: profile,
                                            Type: 'USER',
                                            LegStartDelay: 0,
                                            BypassMedia: false,
                                            LegTimeout: 60,
                                            Origination: callerIdName,
                                            OriginationCallerIdNumber: callerIdNum,
                                            Destination: extDetails.Extension,
                                            Domain: toUsrDomain,
                                            Group: undefined,
                                            IsVoicemailEnabled: false,
                                            PersonalGreeting: false,
                                            CompanyId: companyId,
                                            TenantId: tenantId,
                                            AppId: appId,
                                            Action: 'DEFAULT',
                                            RecordEnabled: recEnabled
                                        };

                                        var customStr = tenantId + '_' + extDetails.Extension + '_PBXUSERCALL';


                                        redisHandler.SetObjectWithExpire(customStr, uuid, 60, function(err, redisResult)
                                        {
                                            if(!err && redisResult)
                                            {
                                                var attTransInfo = AttendantTransferLegInfoHandler(reqId, null, extDetails.SipUACEndpoint);

                                                if(extDetails.SipUACEndpoint.UsePublic)
                                                {
                                                    ep.Profile = 'external';
                                                    ep.Type = 'PUBLIC_USER';
                                                    ep.Destination = extDetails.SipUACEndpoint.SipUsername;
                                                    ep.Domain = extDetails.SipUACEndpoint.Domain;
                                                }

                                                backendFactory.getBackendHandler().getContextPreferences(context, extDetails.SipUACEndpoint.ContextId, companyId, tenantId).then(function(codecPrefs)
                                                {
                                                    var tempCodecPref = null;
                                                    if(codecPrefs)
                                                    {
                                                        tempCodecPref = codecPrefs.Codecs;
                                                    }
                                                    var xml = xmlBuilder.CreateRouteUserDialplan(reqId, ep, context, profile, '[^\\s]*', false, numLimitInfo, attTransInfo, dvpCallDirection, tempCodecPref);

                                                    callback(undefined, xml);

                                                }).catch(function(err)
                                                {
                                                    logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                    callback(err, xmlBuilder.createRejectResponse());
                                                });


                                            }
                                            else
                                            {
                                                callback(err, xmlBuilder.createRejectResponse());
                                            }
                                        });
                                    }

                                }
                                else
                                {
                                    logger.error('[DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - SipUACEndpoint not found for extension', reqId);
                                    callback(new Error('SipUACEndpoint not found for extension'), xmlBuilder.createRejectResponse());
                                }

                            }
                            else if(extDetails.ObjCategory === 'FAX')
                            {
                                if(toFaxType && fromFaxType)
                                {
                                    //Route Fax Dialplan
                                    var ep =
                                    {
                                        Profile: profile,
                                        Type: 'USER',
                                        LegStartDelay: 0,
                                        BypassMedia: false,
                                        LegTimeout: 60,
                                        Origination: callerIdName,
                                        OriginationCallerIdNumber: callerIdNum,
                                        Destination: dnis,
                                        Domain: '',
                                        CompanyId: companyId,
                                        TenantId: tenantId,
                                        AppId: appId
                                    };

                                    var xml = xmlBuilder.CreateRouteFaxUserDialplan(reqId, ep, context, profile, '[^\\s]*', false, fromFaxType, toFaxType);

                                    callback(undefined, xml);


                                }
                                else
                                {
                                    callback(new Error('fax types not set'), xmlBuilder.createRejectResponse());
                                }

                            }
                            else if(extDetails.ObjCategory === 'GROUP')
                            {
                                if(extDetails.UserGroup)
                                {

                                    var ep =
                                    {
                                        Profile: profile,
                                        Type: 'GROUP',
                                        LegStartDelay: 0,
                                        BypassMedia: false,
                                        LegTimeout: 60,
                                        Origination: callerIdName,
                                        OriginationCallerIdNumber: callerIdNum,
                                        Destination: extDetails.Extension,
                                        Domain: extDetails.UserGroup.Domain,
                                        Group: extDetails.Extension,
                                        CompanyId: companyId,
                                        TenantId: tenantId,
                                        AppId: appId,
                                        Action: 'DEFAULT',
                                        RecordEnabled: false
                                    };

                                    var customStr = tenantId + '_' + extDetails.Extension + '_PBXUSERCALL';

                                    redisHandler.SetObjectWithExpire(customStr, uuid, 60, function(err, redisResult)
                                    {
                                        if (!err && redisResult)
                                        {
                                            var attTransInfo = AttendantTransferLegInfoHandler(reqId, null, extDetails.SipUACEndpoint);
                                            var xml = xmlBuilder.CreateRouteUserDialplan(reqId, ep, context, profile, '[^\\s]*', false, numLimitInfo, attTransInfo, dvpCallDirection, null);
                                            callback(undefined, xml);
                                        }
                                        else
                                        {
                                            callback(err, xmlBuilder.createRejectResponse());
                                        }
                                    });


                                }
                                else
                                {
                                    callback(new Error('Group not found'), xmlBuilder.createRejectResponse());
                                }


                            }
                            else if(extDetails.ObjCategory === 'CONFERENCE')
                            {
                                //call conference handler
                                conferenceHandler.ConferenceHandlerOperation(reqId, extDetails, direction, '', context, profile, companyId, tenantId, appId, dvpCallDirection, cacheData, function(err, confXml)
                                {
                                    callback(err, confXml);
                                })
                            }
                            else if(extDetails.ObjCategory === 'AUTO_ATTENDANT')
                            {

                                var ep =
                                {
                                    Profile: profile,
                                    Type: 'AUTO_ATTENDANT',
                                    LegStartDelay: 0,
                                    BypassMedia: false,
                                    LegTimeout: 60,
                                    Origination: callerIdName,
                                    OriginationCallerIdNumber: callerIdNum,
                                    Destination: extDetails.Extension,
                                    CompanyId: companyId,
                                    TenantId: tenantId,
                                    AppId: appId,
                                    Action: 'AUTO_ATTENDANT'
                                };

                                var toContext = '';

                                if(extDetails.Context)
                                {
                                    toContext = extDetails.Context.Context;
                                }

                                var xml = xmlBuilder.CreateAutoAttendantDialplan(reqId, ep, context, toContext, '[^\\s]*', false, dvpCallDirection, numLimitInfo);

                                callback(null, xml);

                            }
                            else if(extDetails.ObjCategory === 'IVR')
                            {

                                handleIVRExt(reqId, companyId, tenantId, uuid, context, extDetails, false, callerIdNum)
                                    .then(function(ivrResp)
                                    {
                                        callback(null, ivrResp);

                                    })
                                    .catch(function(err)
                                    {
                                        callback(err, xmlBuilder.createRejectResponse());
                                    });

                            }
                            else
                            {
                                callback(err, xmlBuilder.createRejectResponse());
                            }

                        }
                        else
                        {
                            logger.info('[DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - All Data For Extension Returned Empty Object - TYPE : %s', reqId, didRes.Extension.ObjCategory);

                            callback(new Error('Extension not found'), xmlBuilder.createRejectResponse());

                        }
                    });
                }
                else
                {
                    //Check for phone number is fax

                    if(numLimitInfo && numLimitInfo.CallType === 'FAX')
                    {
                        var xml = xmlBuilder.CreateReceiveFaxDialplan(reqId, context, profile, '[^\\s]*', 'AUDIO', 'T38', numLimitInfo, uuid);
                        callback(undefined, xml);
                    }
                    else
                    {
                        logger.info('[DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - DID Not Found Or Not Mapped To an Extension', reqId);
                        callback(err, xmlBuilder.createRejectResponse());
                    }

                }
            })
        }
        else
        {
            //Get From User

            if(fromUserData)
            {
                var fromUserUuid = fromUserData.SipUserUuid;

                if(fromUserData.Extension && fromUserData.Extension.ObjCategory === 'FAX')
                {
                    fromFaxType = fromUserData.Extension.ExtraData;
                }

                var dodNumber = undefined;
                var dodActive = undefined;

                if(fromUserData.Extension)
                {
                    dodNumber = fromUserData.Extension.DodNumber;
                    dodActive = fromUserData.Extension.DodActive;
                }

                //Get to user
                backendFactory.getBackendHandler().GetExtensionDB(reqId, dnis, companyId, tenantId, cacheData, function(err, extInfo)
                {
                    if(err)
                    {
                        callback(err, xmlBuilder.createRejectResponse());
                    }
                    else if(extInfo)
                    {
                        logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Extension found', reqId);
                        backendFactory.getBackendHandler().GetAllDataForExt(reqId, dnis, companyId, tenantId, extInfo.ObjCategory, csId, cacheData, function(err, extDetails)
                        {
                            if(err)
                            {
                                //return default xml
                                callback(err, xmlBuilder.createRejectResponse());
                            }
                            else if(extDetails)
                            {
                                logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Extension Category : %s', reqId, extDetails.ObjCategory);
                                toFaxType = extDetails.ExtraData;
                                if(extDetails.ObjCategory === 'USER')
                                {
                                    if(extDetails.SipUACEndpoint)
                                    {
                                        var grp = '';
                                        var toUsrDomain = '';


                                        if(extDetails.SipUACEndpoint && extDetails.SipUACEndpoint.CloudEndUser)
                                        {
                                            toUsrDomain = extDetails.SipUACEndpoint.CloudEndUser.Domain;
                                        }

                                        if(extDetails.SipUACEndpoint.UserGroup && extDetails.SipUACEndpoint.UserGroup.Extension)
                                        {
                                            grp = extDetails.SipUACEndpoint.UserGroup.Extension.Extension;
                                        }

                                        if(url)
                                        {
                                            //Check extension type and handle accordingly
                                            extApi.RemoteGetDialplanConfig(reqId, ani, dnis, context, direction, extDetails.SipUACEndpoint.SipUserUuid, fromUserUuid, extDetails.ObjCategory, undefined, appId, url, companyId, tenantId, securityToken, function(err, pbxDetails)
                                            {
                                                if(err)
                                                {
                                                    callback(err, xmlBuilder.createRejectResponse());
                                                }
                                                else if(!pbxDetails)
                                                {
                                                    if(fromUserData.DenyOutboundFor === 'ALL')
                                                    {
                                                        callback(null, xmlBuilder.CreateOutboundDeniedMessageDialplan(reqId, '[^\\s]*', context, companyId, tenantId, appId, dvpCallDirection));
                                                    }
                                                    else
                                                    {
                                                        var recEnabled = false;

                                                        if(ctxtRecordingEnabled)
                                                        {
                                                            recEnabled = true;
                                                        }
                                                        else
                                                        {
                                                            if(fromUserData.RecordingEnabled)
                                                            {
                                                                recEnabled = true;
                                                            }
                                                            else
                                                            {
                                                                recEnabled = false;
                                                            }
                                                        }



                                                        var ep =
                                                        {
                                                            Profile: profile,
                                                            Type: 'USER',
                                                            LegStartDelay: 0,
                                                            BypassMedia: false,
                                                            LegTimeout: 60,
                                                            Origination: callerIdName,
                                                            OriginationCallerIdNumber: callerIdNum,
                                                            Destination: extDetails.Extension,
                                                            Domain: toUsrDomain,
                                                            Group: grp,
                                                            IsVoicemailEnabled: false,
                                                            PersonalGreeting: undefined,
                                                            CompanyId: companyId,
                                                            TenantId: tenantId,
                                                            AppId: appId,
                                                            Action: 'DEFAULT',
                                                            RecordEnabled: recEnabled
                                                        };

                                                        var customStr = tenantId + '_' + extDetails.Extension + '_PBXUSERCALL';

                                                        redisHandler.SetObjectWithExpire(customStr, uuid, 60, function(err, redisResult)
                                                        {
                                                            if(!err && redisResult)
                                                            {
                                                                var attTransInfo = AttendantTransferLegInfoHandler(reqId, fromUserData, extDetails.SipUACEndpoint);

                                                                if(extDetails.SipUACEndpoint.UsePublic)
                                                                {
                                                                    ep.Profile = 'external';
                                                                    ep.Type = 'PUBLIC_USER';
                                                                    ep.Destination = extDetails.SipUACEndpoint.SipUsername;
                                                                    ep.Domain = extDetails.SipUACEndpoint.Domain;
                                                                }

                                                                backendFactory.getBackendHandler().getContextPreferences(context, extDetails.SipUACEndpoint.ContextId, companyId, tenantId).then(function(codecPrefs)
                                                                {
                                                                    var tempCodecPref = null;
                                                                    if(codecPrefs)
                                                                    {
                                                                        tempCodecPref = codecPrefs.Codecs;
                                                                    }
                                                                    var xml = xmlBuilder.CreateRouteUserDialplan(reqId, ep, context, profile, '[^\\s]*', false, undefined, attTransInfo, dvpCallDirection, tempCodecPref);

                                                                    callback(undefined, xml);

                                                                }).catch(function(err)
                                                                {
                                                                    logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                                    callback(err, xmlBuilder.createRejectResponse());
                                                                });


                                                            }
                                                            else
                                                            {
                                                                callback(err, xmlBuilder.createRejectResponse());
                                                            }
                                                        });
                                                    }

                                                }
                                                else
                                                {

                                                    if(pbxDetails.OperationType === 'DENY')
                                                    {
                                                        callback(null, xmlBuilder.CreateOutboundDeniedMessageDialplan(reqId, '[^\\s]*', context, companyId, tenantId, appId, dvpCallDirection));
                                                    }
                                                    else
                                                    {
                                                        var pbxObj = pbxDetails;

                                                        var voicemailEnabled = pbxObj.VoicemailEnabled;
                                                        var personalGreeting = pbxObj.PersonalGreeting;
                                                        var bypassMedia = pbxObj.BypassMedia;

                                                        var ringTime = 60;

                                                        if(pbxObj.RingTimeout)
                                                        {
                                                            ringTime = pbxObj.RingTimeout;
                                                        }


                                                        if(pbxObj.OperationType === 'DND')
                                                        {
                                                            var xml = xmlBuilder.CreateSendBusyMessageDialplan(reqId, '[^\\s]*', context, undefined, companyId, tenantId, appId, dvpCallDirection);

                                                            callback(undefined, xml);
                                                        }
                                                        else if(pbxObj.OperationType === 'USER_DIAL')
                                                        {
                                                            var recEnabled = false;

                                                            if(ctxtRecordingEnabled)
                                                            {
                                                                recEnabled = true;
                                                            }
                                                            else
                                                            {
                                                                if(fromUserData.RecordingEnabled)
                                                                {
                                                                    recEnabled = true;
                                                                }
                                                                else
                                                                {
                                                                    recEnabled = false;
                                                                }
                                                            }


                                                            var ep =
                                                            {
                                                                Profile: profile,
                                                                Type: 'USER',
                                                                LegStartDelay: 0,
                                                                BypassMedia: bypassMedia,
                                                                LegTimeout: ringTime,
                                                                Origination: callerIdName,
                                                                OriginationCallerIdNumber: callerIdNum,
                                                                Destination: extDetails.Extension,
                                                                Domain: toUsrDomain,
                                                                Group: grp,
                                                                IsVoicemailEnabled: voicemailEnabled,
                                                                PersonalGreeting: personalGreeting,
                                                                CompanyId: companyId,
                                                                TenantId: tenantId,
                                                                AppId: appId,
                                                                Action: 'DEFAULT',
                                                                RecordEnabled: recEnabled
                                                            };

                                                            var customStr = tenantId + '_' + extDetails.Extension + '_PBXUSERCALL';

                                                            redisHandler.SetObjectWithExpire(customStr, uuid, 60, function(err, redisResult)
                                                            {
                                                                if(!err && redisResult)
                                                                {
                                                                    var attTransInfo = AttendantTransferLegInfoHandler(reqId, fromUserData, extDetails.SipUACEndpoint);

                                                                    if(extDetails.SipUACEndpoint.UsePublic)
                                                                    {
                                                                        ep.Profile = 'external';
                                                                        ep.Type = 'PUBLIC_USER';
                                                                        ep.Destination = extDetails.SipUACEndpoint.SipUsername;
                                                                        ep.Domain = extDetails.SipUACEndpoint.Domain;
                                                                    }

                                                                    backendFactory.getBackendHandler().getContextPreferences(context, extDetails.SipUACEndpoint.ContextId, companyId, tenantId).then(function(codecPrefs)
                                                                    {
                                                                        var tempCodecPref = null;
                                                                        if(codecPrefs)
                                                                        {
                                                                            tempCodecPref = codecPrefs.Codecs;
                                                                        }
                                                                        var xml = xmlBuilder.CreateRouteUserDialplan(reqId, ep, context, profile, '[^\\s]*', false, undefined, attTransInfo, dvpCallDirection, tempCodecPref);

                                                                        callback(undefined, xml);

                                                                    }).catch(function(err)
                                                                    {
                                                                        logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                                        callback(err, xmlBuilder.createRejectResponse());
                                                                    });


                                                                }
                                                                else
                                                                {
                                                                    callback(err, xmlBuilder.createRejectResponse());
                                                                }
                                                            });
                                                        }
                                                        else if(pbxObj.OperationType === 'FOLLOW_ME')
                                                        {
                                                            if(pbxDetails.Endpoints && pbxDetails.Endpoints.length > 0)
                                                            {
                                                                CreateFMEndpointList(reqId, ani, context, companyId, tenantId, pbxDetails.Endpoints, '', false, callerIdNum, callerIdName, csId, appId, cacheData, function(err, epList)
                                                                {
                                                                    if(err)
                                                                    {
                                                                        callback(err, xmlBuilder.createRejectResponse());
                                                                    }
                                                                    else if(epList && epList.length > 0)
                                                                    {
                                                                        var xml = xmlBuilder.CreateFollowMeDialplan(reqId, epList, context, profile, '[^\\s]*', false, undefined, companyId, tenantId, appId, dvpCallDirection);

                                                                        callback(undefined, xml);
                                                                    }
                                                                    else
                                                                    {
                                                                        callback(err, xmlBuilder.createRejectResponse());
                                                                    }
                                                                })
                                                            }
                                                            else
                                                            {
                                                                callback(new Error('No '), xmlBuilder.createRejectResponse());
                                                            }
                                                        }
                                                        else if(pbxObj.OperationType === 'FORWARD')
                                                        {
                                                            if(pbxDetails.Endpoints)
                                                            {
                                                                var ep =
                                                                {
                                                                    Profile: profile,
                                                                    Type: 'USER',
                                                                    LegStartDelay: 0,
                                                                    BypassMedia: bypassMedia,
                                                                    LegTimeout: ringTime,
                                                                    Origination: callerIdName,
                                                                    OriginationCallerIdNumber: callerIdNum,
                                                                    Destination: dnis,
                                                                    Domain: toUsrDomain,
                                                                    Group: grp,
                                                                    CompanyId: companyId,
                                                                    TenantId: tenantId,
                                                                    AppId: appId
                                                                };

                                                                if(dodActive && dodNumber)
                                                                {
                                                                    ep.DodNumber = dodNumber;
                                                                }

                                                                var pbxFwdKey = util.format('DVPFORWARDING_%d_%d_%s', companyId, tenantId, pbxDetails.UserRefId);
                                                                var forwardingInfo = JSON.stringify(pbxDetails.Endpoints);

                                                                redisHandler.SetObjectWithExpire(pbxFwdKey, forwardingInfo, 360, function(err, redisResp)
                                                                {
                                                                    if(err)
                                                                    {
                                                                        callback(err, xmlBuilder.createRejectResponse());
                                                                    }
                                                                    else
                                                                    {

                                                                        if(extDetails.SipUACEndpoint.UsePublic)
                                                                        {
                                                                            ep.Profile = 'external';
                                                                            ep.Type = 'PUBLIC_USER';
                                                                            ep.Destination = extDetails.SipUACEndpoint.SipUsername;
                                                                            ep.Domain = extDetails.SipUACEndpoint.Domain;
                                                                            ep.BypassMedia = false;
                                                                        }

                                                                        var attTransInfo = AttendantTransferLegInfoHandler(reqId, null, extDetails.SipUACEndpoint);

                                                                        backendFactory.getBackendHandler().getContextPreferences(context, extDetails.SipUACEndpoint.ContextId, companyId, tenantId).then(function(codecPrefs)
                                                                        {
                                                                            var tempCodecPref = null;
                                                                            if(codecPrefs)
                                                                            {
                                                                                tempCodecPref = codecPrefs.Codecs;
                                                                            }

                                                                            var xml = xmlBuilder.CreateForwardingDialplan(reqId, ep, context, profile, '[^\\s]*', false, pbxFwdKey, null, attTransInfo, dvpCallDirection, tempCodecPref);
                                                                            callback(undefined, xml);

                                                                        }).catch(function(err)
                                                                        {
                                                                            logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                                            callback(err, xmlBuilder.createRejectResponse());
                                                                        });



                                                                    }
                                                                });
                                                            }
                                                            else
                                                            {
                                                                var recEnabled = false;

                                                                if(ctxtRecordingEnabled)
                                                                {
                                                                    recEnabled = true;
                                                                }
                                                                else
                                                                {
                                                                    if(fromUserData.RecordingEnabled)
                                                                    {
                                                                        recEnabled = true;
                                                                    }
                                                                    else
                                                                    {
                                                                        recEnabled = false;
                                                                    }
                                                                }
                                                                //Do Normal User Dial
                                                                var ep =
                                                                {
                                                                    Profile: profile,
                                                                    Type: 'USER',
                                                                    LegStartDelay: 0,
                                                                    BypassMedia: bypassMedia,
                                                                    LegTimeout: ringTime,
                                                                    Origination: callerIdName,
                                                                    OriginationCallerIdNumber: callerIdNum,
                                                                    Destination: extDetails.Extension,
                                                                    Domain: toUsrDomain,
                                                                    Group: grp,
                                                                    IsVoicemailEnabled: voicemailEnabled,
                                                                    PersonalGreeting: personalGreeting,
                                                                    CompanyId: companyId,
                                                                    TenantId: tenantId,
                                                                    AppId: appId,
                                                                    Action: 'DEFAULT',
                                                                    RecordEnabled: recEnabled
                                                                };

                                                                var customStr = tenantId + '_' + extDetails.Extension + '_PBXUSERCALL';

                                                                redisHandler.SetObjectWithExpire(customStr, uuid, 60, function(err, redisResult)
                                                                {
                                                                    if(!err && redisResult)
                                                                    {
                                                                        var attTransInfo = AttendantTransferLegInfoHandler(reqId, fromUserData, extDetails.SipUACEndpoint);

                                                                        if(extDetails.SipUACEndpoint.UsePublic)
                                                                        {
                                                                            ep.Profile = 'external';
                                                                            ep.Type = 'PUBLIC_USER';
                                                                            ep.Destination = extDetails.SipUACEndpoint.SipUsername;
                                                                            ep.Domain = extDetails.SipUACEndpoint.Domain;
                                                                        }

                                                                        backendFactory.getBackendHandler().getContextPreferences(context, extDetails.SipUACEndpoint.ContextId, companyId, tenantId).then(function(codecPrefs)
                                                                        {
                                                                            var tempCodecPref = null;
                                                                            if(codecPrefs)
                                                                            {
                                                                                tempCodecPref = codecPrefs.Codecs;
                                                                            }
                                                                            var xml = xmlBuilder.CreateRouteUserDialplan(reqId, ep, context, profile, '[^\\s]*', false, undefined, attTransInfo, dvpCallDirection, tempCodecPref);

                                                                            callback(undefined, xml);

                                                                        }).catch(function(err)
                                                                        {
                                                                            logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                                            callback(err, xmlBuilder.createRejectResponse());
                                                                        });


                                                                    }
                                                                    else
                                                                    {
                                                                        callback(err, xmlBuilder.createRejectResponse());
                                                                    }
                                                                });
                                                            }

                                                        }
                                                        else if(pbxObj.OperationType === 'CALL_DIVERT')
                                                        {
                                                            if (pbxObj.Endpoints && pbxObj.Endpoints.ObjCategory === 'GATEWAY')
                                                            {
                                                                //pick outbound rule
                                                                backendFactory.getRuleHandler().PickCallRuleOutboundComplete(reqId, ani, pbxObj.Endpoints.DestinationNumber, '', context, companyId, tenantId, false, cacheData, function (err, rule)
                                                                {
                                                                    if (!err && rule)
                                                                    {
                                                                        var ep =
                                                                        {
                                                                            Profile: rule.GatewayCode,
                                                                            Type: 'GATEWAY',
                                                                            LegStartDelay: 0,
                                                                            BypassMedia: false,
                                                                            LegTimeout: 60,
                                                                            Destination: rule.DNIS,
                                                                            Domain: rule.IpUrl,
                                                                            TrunkNumber: rule.TrunkNumber,
                                                                            AppId: appId,
                                                                            NumberType: rule.NumberType,
                                                                            CompanyId: rule.CompanyId,
                                                                            TenantId: rule.TenantId,
                                                                            Action: 'CALL_DIVERT',
                                                                            Operator: rule.Operator
                                                                        };


                                                                        if(dodActive && dodNumber)
                                                                        {
                                                                            ep.Origination = dodNumber;
                                                                            ep.OriginationCallerIdNumber = dodNumber;
                                                                        }
                                                                        else
                                                                        {
                                                                            ep.Origination = rule.ANI;
                                                                            ep.OriginationCallerIdNumber = rule.ANI;
                                                                        }

                                                                        var attTransInfo = AttendantTransferLegInfoHandler(reqId, fromUserData, null);

                                                                        extApi.CheckBalance(reqId, uuid, ep.Origination, ep.Destination, 'minute', ep.Operator, ep.CompanyId, ep.TenantId)
                                                                            .then(function(balanceRes)
                                                                            {
                                                                                if (balanceRes && balanceRes.IsSuccess)
                                                                                {
                                                                                    backendFactory.getBackendHandler().getContextPreferences(context, 'public', companyId, tenantId).then(function(codecPrefs)
                                                                                    {
                                                                                        var tempCodecPref = null;
                                                                                        if(codecPrefs)
                                                                                        {
                                                                                            tempCodecPref = codecPrefs.Codecs;
                                                                                        }


                                                                                        backendFactory.getBackendHandler().GetCompanyLimits(companyId, tenantId).then(function(compLimits)
                                                                                        {
                                                                                            var limits = {
                                                                                                NumberOutboundLimit: rule.OutLimit,
                                                                                                NumberBothLimit: rule.BothLimit,
                                                                                                CompanyOutboundLimit: compLimits.OutboundLimit,
                                                                                                CompanyBothLimit: compLimits.BothLimit
                                                                                            };

                                                                                            var NumLimitInfo = LimitValidator(limits, rule.TrunkNumber, 'outbound');

                                                                                            if(NumLimitInfo)
                                                                                            {
                                                                                                ep.Limits = NumLimitInfo;
                                                                                                var xml = xmlBuilder.CreateRouteGatewayDialplan(reqId, ep, context, profile, '[^\\s]*', false, attTransInfo, dvpCallDirection, tempCodecPref, null);

                                                                                                callback(null, xml);
                                                                                            }
                                                                                            else
                                                                                            {
                                                                                                logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Limits not defined', reqId);
                                                                                                callback(err, xmlBuilder.createRejectResponse());
                                                                                            }



                                                                                        }).catch(function(err)
                                                                                        {
                                                                                            logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error getting company limits', reqId);
                                                                                            callback(err, xmlBuilder.createRejectResponse());

                                                                                        });





                                                                                    }).catch(function(err)
                                                                                    {
                                                                                        logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                                                        callback(err, xmlBuilder.createRejectResponse());
                                                                                    });


                                                                                }
                                                                                else
                                                                                {
                                                                                    callback(new Error('insufficient balance'), xmlBuilder.createRejectResponse());
                                                                                }

                                                                            })
                                                                            .catch(function(err)
                                                                            {
                                                                                callback(err, xmlBuilder.createRejectResponse());
                                                                            });


                                                                    }
                                                                    else
                                                                    {
                                                                        callback(undefined, xmlBuilder.createRejectResponse());
                                                                    }
                                                                })
                                                            }
                                                            else if(pbxObj.Endpoints && (pbxObj.Endpoints.ObjCategory === 'PBXUSER' || pbxObj.Endpoints.ObjCategory === 'USER'))
                                                            {
                                                                backendFactory.getBackendHandler().GetAllDataForExt(reqId, pbxObj.Endpoints.DestinationNumber, companyId, tenantId, 'USER', csId, cacheData, function (err, extDetails)
                                                                {

                                                                    if (!err && extDetails)
                                                                    {
                                                                        if (extDetails.SipUACEndpoint && extDetails.SipUACEndpoint.CloudEndUser)
                                                                        {
                                                                            var ep =
                                                                            {
                                                                                Profile: '',
                                                                                Type: 'USER',
                                                                                LegStartDelay: 0,
                                                                                BypassMedia: false,
                                                                                LegTimeout: 60,
                                                                                Origination: callerIdName,
                                                                                OriginationCallerIdNumber: callerIdNum,
                                                                                Destination: pbxObj.Endpoints.DestinationNumber,
                                                                                Domain: extDetails.SipUACEndpoint.CloudEndUser.Domain,
                                                                                CompanyId: companyId,
                                                                                TenantId: tenantId,
                                                                                AppId: appId,
                                                                                Action: 'DEFAULT'
                                                                            };

                                                                            var attTransInfo = AttendantTransferLegInfoHandler(reqId, fromUserData, extDetails.SipUACEndpoint);

                                                                            if(extDetails.SipUACEndpoint.UsePublic)
                                                                            {
                                                                                ep.Profile = 'external';
                                                                                ep.Type = 'PUBLIC_USER';
                                                                                ep.Destination = extDetails.SipUACEndpoint.SipUsername;
                                                                                ep.Domain = extDetails.SipUACEndpoint.Domain;
                                                                            }

                                                                            backendFactory.getBackendHandler().getContextPreferences(context, extDetails.SipUACEndpoint.ContextId, companyId, tenantId).then(function(codecPrefs)
                                                                            {
                                                                                var tempCodecPref = null;
                                                                                if(codecPrefs)
                                                                                {
                                                                                    tempCodecPref = codecPrefs.Codecs;
                                                                                }
                                                                                var xml = xmlBuilder.CreateRouteUserDialplan(reqId, ep, context, profile, '[^\\s]*', false, numLimitInfo, attTransInfo, dvpCallDirection, codecPrefs);

                                                                                callback(undefined, xml);

                                                                            }).catch(function(err)
                                                                            {
                                                                                logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                                                callback(err, xmlBuilder.createRejectResponse());
                                                                            });


                                                                        }
                                                                        else
                                                                        {
                                                                            callback(undefined, xmlBuilder.createRejectResponse());
                                                                        }
                                                                    }
                                                                    else
                                                                    {
                                                                        callback(undefined, xmlBuilder.createRejectResponse());
                                                                    }

                                                                });
                                                            }
                                                            else
                                                            {
                                                                callback(undefined, xmlBuilder.createRejectResponse());
                                                            }
                                                        }
                                                        else
                                                        {

                                                            var recEnabled = false;

                                                            if(ctxtRecordingEnabled)
                                                            {
                                                                recEnabled = true;
                                                            }
                                                            else
                                                            {
                                                                if(fromUserData.RecordingEnabled)
                                                                {
                                                                    recEnabled = true;
                                                                }
                                                                else
                                                                {
                                                                    recEnabled = false;
                                                                }
                                                            }

                                                            var ep =
                                                            {
                                                                Profile: profile,
                                                                Type: 'USER',
                                                                LegStartDelay: 0,
                                                                BypassMedia: bypassMedia,
                                                                LegTimeout: ringTime,
                                                                Origination: callerIdName,
                                                                OriginationCallerIdNumber: callerIdNum,
                                                                Destination: dnis,
                                                                Domain: toUsrDomain,
                                                                Group: grp,
                                                                IsVoicemailEnabled: voicemailEnabled,
                                                                PersonalGreeting: personalGreeting,
                                                                CompanyId: companyId,
                                                                TenantId: tenantId,
                                                                AppId: appId,
                                                                Action: 'DEFAULT',
                                                                RecordEnabled: recEnabled
                                                            };

                                                            var customStr = tenantId + '_' + extDetails.Extension + '_PBXUSERCALL';

                                                            redisHandler.SetObjectWithExpire(customStr, uuid, 60, function(err, redisResult)
                                                            {
                                                                if(!err && redisResult)
                                                                {
                                                                    var attTransInfo = AttendantTransferLegInfoHandler(reqId, fromUserData, extDetails.SipUACEndpoint);

                                                                    if(extDetails.SipUACEndpoint.UsePublic)
                                                                    {
                                                                        ep.Profile = 'external';
                                                                        ep.Type = 'PUBLIC_USER';
                                                                        ep.Destination = extDetails.SipUACEndpoint.SipUsername;
                                                                        ep.Domain = extDetails.SipUACEndpoint.Domain;
                                                                    }

                                                                    backendFactory.getBackendHandler().getContextPreferences(context, extDetails.SipUACEndpoint.ContextId, companyId, tenantId).then(function(codecPrefs)
                                                                    {
                                                                        var tempCodecPref = null;
                                                                        if(codecPrefs)
                                                                        {
                                                                            tempCodecPref = codecPrefs.Codecs;
                                                                        }
                                                                        var xml = xmlBuilder.CreateRouteUserDialplan(reqId, ep, context, profile, '[^\\s]*', false, undefined, attTransInfo, dvpCallDirection, tempCodecPref);

                                                                        callback(undefined, xml);

                                                                    }).catch(function(err)
                                                                    {
                                                                        logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                                        callback(err, xmlBuilder.createRejectResponse());
                                                                    });


                                                                }
                                                                else
                                                                {
                                                                    callback(err, xmlBuilder.createRejectResponse());
                                                                }
                                                            });
                                                        }
                                                    }

                                                }
                                            })
                                        }
                                        else
                                        {
                                            if(fromUserData.DenyOutboundFor === 'ALL')
                                            {
                                                callback(null, xmlBuilder.CreateOutboundDeniedMessageDialplan(reqId, '[^\\s]*', context, companyId, tenantId, appId, dvpCallDirection));
                                            }
                                            else
                                            {
                                                var recEnabled = false;

                                                if(ctxtRecordingEnabled)
                                                {
                                                    recEnabled = true;
                                                }
                                                else
                                                {
                                                    if(fromUserData.RecordingEnabled)
                                                    {
                                                        recEnabled = true;
                                                    }
                                                    else
                                                    {
                                                        recEnabled = false;
                                                    }
                                                }

                                                var ep =
                                                {
                                                    Profile: profile,
                                                    Type: 'USER',
                                                    LegStartDelay: 0,
                                                    BypassMedia: false,
                                                    LegTimeout: 60,
                                                    Origination: callerIdName,
                                                    OriginationCallerIdNumber: callerIdNum,
                                                    Destination: extDetails.Extension,
                                                    Domain: toUsrDomain,
                                                    Group: grp,
                                                    IsVoicemailEnabled: false,
                                                    PersonalGreeting: undefined,
                                                    CompanyId: companyId,
                                                    TenantId: tenantId,
                                                    AppId: appId,
                                                    Action: 'DEFAULT',
                                                    RecordEnabled: recEnabled
                                                };

                                                var customStr = tenantId + '_' + extDetails.Extension + '_PBXUSERCALL';

                                                redisHandler.SetObjectWithExpire(customStr, uuid, 60, function(err, redisResult)
                                                {
                                                    if(!err && redisResult)
                                                    {
                                                        var attTransInfo = AttendantTransferLegInfoHandler(reqId, fromUserData, extDetails.SipUACEndpoint);

                                                        if(extDetails.SipUACEndpoint.UsePublic)
                                                        {
                                                            ep.Profile = 'external';
                                                            ep.Type = 'PUBLIC_USER';
                                                            ep.Destination = extDetails.SipUACEndpoint.SipUsername;
                                                            ep.Domain = extDetails.SipUACEndpoint.Domain;
                                                        }

                                                        backendFactory.getBackendHandler().getContextPreferences(context, extDetails.SipUACEndpoint.ContextId, companyId, tenantId).then(function(codecPrefs)
                                                        {
                                                            var tempCodecPref = null;
                                                            if(codecPrefs)
                                                            {
                                                                tempCodecPref = codecPrefs.Codecs;
                                                            }
                                                            var xml = xmlBuilder.CreateRouteUserDialplan(reqId, ep, context, profile, '[^\\s]*', false, undefined, attTransInfo, dvpCallDirection, tempCodecPref);

                                                            callback(undefined, xml);

                                                        }).catch(function(err)
                                                        {
                                                            logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                            callback(err, xmlBuilder.createRejectResponse());
                                                        });


                                                    }
                                                    else
                                                    {
                                                        callback(err, xmlBuilder.createRejectResponse());
                                                    }
                                                });
                                            }

                                        }

                                    }
                                    else
                                    {
                                        callback(err, xmlBuilder.createRejectResponse());
                                    }

                                }
                                else if(extDetails.ObjCategory === 'FAX')
                                {
                                    if(fromFaxType && toFaxType)
                                    {
                                        //process fax dialplan
                                    }
                                    else
                                    {
                                        callback(new Error('fax types not set'), xmlBuilder.createRejectResponse());
                                    }
                                }
                                else if(extDetails.ObjCategory === 'GROUP')
                                {
                                    if(fromUserData.DenyOutboundFor === 'ALL')
                                    {
                                        callback(null, xmlBuilder.CreateOutboundDeniedMessageDialplan(reqId, '[^\\s]*', context, companyId, tenantId, appId, dvpCallDirection));
                                    }
                                    else
                                    {
                                        if(extDetails.UserGroup)
                                        {
                                            var recEnabled = false;

                                            if(ctxtRecordingEnabled)
                                            {
                                                recEnabled = true;
                                            }
                                            else
                                            {
                                                if(fromUserData.RecordingEnabled)
                                                {
                                                    recEnabled = true;
                                                }
                                                else
                                                {
                                                    recEnabled = false;
                                                }
                                            }

                                            var ep =
                                            {
                                                Profile: profile,
                                                Type: 'GROUP',
                                                LegStartDelay: 0,
                                                BypassMedia: false,
                                                LegTimeout: 60,
                                                Origination: callerIdName,
                                                OriginationCallerIdNumber: callerIdNum,
                                                Destination: extDetails.Extension,
                                                Domain: extDetails.UserGroup.Domain,
                                                Group: extDetails.Extension,
                                                CompanyId: companyId,
                                                TenantId: tenantId,
                                                AppId: appId,
                                                Action: 'DEFAULT',
                                                RecordEnabled: recEnabled
                                            };

                                            var customStr = tenantId + '_' + extDetails.Extension + '_PBXUSERCALL';

                                            redisHandler.SetObjectWithExpire(customStr, uuid, 60, function(err, redisResult)
                                            {
                                                if (!err && redisResult)
                                                {
                                                    var attTransInfo = AttendantTransferLegInfoHandler(reqId, fromUserData, null);
                                                    var xml = xmlBuilder.CreateRouteUserDialplan(reqId, ep, context, profile, '[^\\s]*', false, undefined, attTransInfo, dvpCallDirection, null);
                                                    callback(undefined, xml);
                                                }
                                                else
                                                {
                                                    callback(err, xmlBuilder.createRejectResponse());
                                                }
                                            });


                                        }
                                        else
                                        {
                                            callback(err, xmlBuilder.createRejectResponse());
                                        }
                                    }



                                }
                                else if(extDetails.ObjCategory === 'CONFERENCE')
                                {
                                    if(fromUserData.DenyOutboundFor === 'ALL')
                                    {
                                        callback(null, xmlBuilder.CreateOutboundDeniedMessageDialplan(reqId, '[^\\s]*', context, companyId, tenantId, appId, dvpCallDirection));
                                    }
                                    else
                                    {
                                        conferenceHandler.ConferenceHandlerOperation(reqId, extDetails, direction, fromUserUuid, context, profile, companyId, tenantId, appId, dvpCallDirection, cacheData, function(err, confXml)
                                        {
                                            callback(err, confXml);
                                        })
                                    }

                                }
                                else if(extDetails.ObjCategory === 'VOICE_PORTAL')
                                {
                                    extApi.RemoteGetDialplanConfig(reqId, ani, dnis, context, direction, undefined, fromUserUuid, extDetails.ObjCategory, extDetails.ExtraData, appId, url, companyId, tenantId, securityToken, function(err, pbxDetails)
                                    {
                                        if(err)
                                        {
                                            callback(err, xmlBuilder.createRejectResponse());
                                        }
                                        else if(pbxDetails)
                                        {
                                            if(pbxDetails.OperationType === 'DIALPLAN')
                                            {
                                                callback(undefined, pbxDetails.Dialplan);
                                            }
                                        }
                                        else
                                        {
                                            callback(new Error('PBX app returned empty value'), xmlBuilder.createRejectResponse());
                                        }

                                    });

                                }
                                else if(extDetails.ObjCategory === 'IVR')
                                {

                                    handleIVRExt(reqId, companyId, tenantId, uuid, context, extDetails, false, null)
                                        .then(function(ivrResp)
                                        {
                                            callback(null, ivrResp);

                                        })
                                        .catch(function(err)
                                        {
                                            callback(err, xmlBuilder.createRejectResponse());
                                        });

                                }
                                else if(extDetails.ObjCategory === 'AUTO_ATTENDANT')
                                {

                                    var ep =
                                    {
                                        Profile: profile,
                                        Type: 'AUTO_ATTENDANT',
                                        LegStartDelay: 0,
                                        BypassMedia: false,
                                        LegTimeout: 60,
                                        Origination: callerIdName,
                                        OriginationCallerIdNumber: callerIdNum,
                                        Destination: extDetails.Extension,
                                        CompanyId: companyId,
                                        TenantId: tenantId,
                                        AppId: appId,
                                        Action: 'AUTO_ATTENDANT'
                                    };

                                    var toContext = '';

                                    if(extDetails.Context)
                                    {
                                        toContext = extDetails.Context.Context;
                                    }

                                    var xml = xmlBuilder.CreateAutoAttendantDialplan(reqId, ep, context, toContext, '[^\\s]*', false, dvpCallDirection, null);

                                    callback(undefined, xml);

                                }
                                else
                                {
                                    callback(new Error('Unsupported extension category'), xmlBuilder.createRejectResponse());
                                }

                            }
                            else
                            {
                                callback(new Error('Unsupported extension'), xmlBuilder.createRejectResponse());

                            }
                        });
                    }
                    else
                    {
                        logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Out call DNIS is not an extension', reqId);

                        if(url)
                        {
                            extApi.RemoteGetDialplanConfig(reqId, ani, dnis, context, direction, undefined, fromUserUuid, undefined, undefined, appId, url, companyId, tenantId, securityToken, function(err, pbxDetails)
                            {
                                if(err)
                                {
                                    logger.error('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Extended App Returned Error', reqId, err);
                                    callback(err, xmlBuilder.createRejectResponse());
                                }
                                else
                                {
                                    var pbxObj = pbxDetails;

                                    if(pbxObj)
                                    {
                                        if(pbxObj.OperationType === 'DENY')
                                        {
                                            callback(null, xmlBuilder.CreateOutboundDeniedMessageDialplan(reqId, '[^\\s]*', context, companyId, tenantId, appId, dvpCallDirection));
                                        }
                                        else
                                        {
                                            logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Extended App Returned : ', reqId, pbxObj);
                                            var operationType = pbxObj.OperationType;
                                            var voicemailEnabled = pbxObj.VoicemailEnabled;
                                            var bypassMedia = pbxObj.BypassMedia;
                                            var iddEnabled = pbxObj.AllowIDD;

                                            var ringTime = 60;

                                            if(pbxObj.RingTimeout)
                                            {
                                                ringTime = pbxObj.RingTimeout;
                                            }

                                            var grp = '';

                                            var domain = '';

                                            if(operationType === 'GATEWAY')
                                            {
                                                //xml DND response
                                                backendFactory.getRuleHandler().PickCallRuleOutboundComplete(reqId, ani, dnis, '', context, companyId, tenantId, true, cacheData, function(err, rule)
                                                {
                                                    if(err)
                                                    {
                                                        callback(err, xmlBuilder.createRejectResponse());
                                                    }
                                                    else if(rule)
                                                    {
                                                        var allowGwCall = false;
                                                        if(iddEnabled)
                                                        {
                                                            if(CheckIddValidity(rule.DNIS, rule.TrunkNumber))
                                                            {
                                                                allowGwCall = true;
                                                            }
                                                        }
                                                        else
                                                        {
                                                            allowGwCall = true;
                                                        }

                                                        if(allowGwCall)
                                                        {
                                                            if(rule.FaxType)
                                                            {
                                                                toFaxType = rule.FaxType;
                                                            }

                                                            var recEnabled = false;

                                                            if(ctxtRecordingEnabled)
                                                            {
                                                                recEnabled = true;
                                                            }
                                                            else
                                                            {
                                                                if(fromUserData && fromUserData.RecordingEnabled)
                                                                {
                                                                    recEnabled = true;
                                                                }
                                                                else
                                                                {
                                                                    recEnabled = false;
                                                                }
                                                            }

                                                            var ep =
                                                            {
                                                                Profile: rule.GatewayCode,
                                                                Type: 'GATEWAY',
                                                                LegStartDelay: 0,
                                                                BypassMedia: false,
                                                                LegTimeout: 60,
                                                                Origination: rule.ANI,
                                                                OriginationCallerIdNumber: rule.ANI,
                                                                Destination: rule.DNIS,
                                                                Domain: rule.IpUrl,
                                                                TrunkNumber: rule.TrunkNumber,
                                                                NumberType: rule.NumberType,
                                                                CompanyId: rule.CompanyId,
                                                                TenantId: rule.TenantId,
                                                                AppId: appId,
                                                                Action: 'DEFAULT',
                                                                RecordEnabled: recEnabled,
                                                                Operator: rule.Operator
                                                            };

                                                            if(dodActive && dodNumber)
                                                            {
                                                                ep.Origination = dodNumber;
                                                                ep.OriginationCallerIdNumber = dodNumber;
                                                            }

                                                            if(toFaxType)
                                                            {
                                                                //gateway fax dialplan
                                                                var xml = xmlBuilder.CreateRouteFaxGatewayDialplan(reqId, ep, context, profile, '[^\\s]*', false, fromFaxType, toFaxType);
                                                                callback(undefined, xml);
                                                            }
                                                            else
                                                            {
                                                                var attTransInfo = AttendantTransferLegInfoHandler(reqId, fromUserData, null);

                                                                extApi.CheckBalance(reqId, uuid, ep.Origination, ep.Destination, 'minute', ep.Operator, ep.CompanyId, ep.TenantId)
                                                                    .then(function(balanceRes)
                                                                    {
                                                                        if (balanceRes && balanceRes.IsSuccess)
                                                                        {
                                                                            backendFactory.getBackendHandler().getContextPreferences(context, 'public', companyId, tenantId).then(function(codecPrefs)
                                                                            {
                                                                                var tempCodecPref = null;
                                                                                if(codecPrefs)
                                                                                {
                                                                                    tempCodecPref = codecPrefs.Codecs;
                                                                                }

                                                                                backendFactory.getBackendHandler().GetCompanyLimits(companyId, tenantId).then(function(compLimits)
                                                                                {
                                                                                    var limits = {
                                                                                        NumberOutboundLimit: rule.OutLimit,
                                                                                        NumberBothLimit: rule.BothLimit,
                                                                                        CompanyOutboundLimit: compLimits.OutboundLimit,
                                                                                        CompanyBothLimit: compLimits.BothLimit
                                                                                    };

                                                                                    var NumLimitInfo = LimitValidator(limits, rule.TrunkNumber, 'outbound');

                                                                                    if(NumLimitInfo)
                                                                                    {
                                                                                        ep.Limits = NumLimitInfo;
                                                                                        var xml = xmlBuilder.CreateRouteGatewayDialplan(reqId, ep, context, profile, '[^\\s]*', false, attTransInfo, dvpCallDirection, tempCodecPref, null);

                                                                                        callback(null, xml);
                                                                                    }
                                                                                    else
                                                                                    {
                                                                                        logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Limits not defined', reqId);
                                                                                        callback(err, xmlBuilder.createRejectResponse());
                                                                                    }



                                                                                }).catch(function(err)
                                                                                {
                                                                                    logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error getting company limits', reqId);
                                                                                    callback(err, xmlBuilder.createRejectResponse());

                                                                                });





                                                                            }).catch(function(err)
                                                                            {
                                                                                logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                                                callback(err, xmlBuilder.createRejectResponse());
                                                                            });


                                                                        }
                                                                        else
                                                                        {
                                                                            callback(new Error('insufficient balance'), xmlBuilder.createRejectResponse());
                                                                        }

                                                                    })
                                                                    .catch(function(err)
                                                                    {
                                                                        callback(err, xmlBuilder.createRejectResponse());
                                                                    });


                                                            }
                                                        }
                                                        else
                                                        {
                                                            callback(undefined, xmlBuilder.createRejectResponse());
                                                        }

                                                    }
                                                    else
                                                    {
                                                        callback(undefined, xmlBuilder.createRejectResponse());
                                                    }
                                                })
                                            }
                                            else if(operationType === 'PICKUP')
                                            {
                                                var extraData = pbxObj.ExtraData;

                                                if(extraData)
                                                {
                                                    //validate user belongs to same group
                                                    backendFactory.getBackendHandler().GetGroupByExtension(reqId, extraData, tenantId, cacheData, function(err, grpReslt)
                                                    {
                                                        if(err)
                                                        {
                                                            var xml = xmlBuilder.createRejectResponse();
                                                            callback(err, xml);
                                                        }
                                                        else
                                                        {
                                                            if(grpReslt && grpReslt.UserGroup && grpReslt.UserGroup.SipUACEndpoint)
                                                            {
                                                                var usrRec = underscore.find(grpReslt.UserGroup.SipUACEndpoint, function(usrInGrp){return usrInGrp.id === fromUserData.id});

                                                                if(usrRec)
                                                                {
                                                                    var xml = xmlBuilder.CreatePickUpDialplan(reqId, extraData, context, '[^\\s]*', companyId, tenantId, appId, dvpCallDirection);
                                                                    callback(undefined, xml);
                                                                }
                                                                else
                                                                {
                                                                    var xml = xmlBuilder.createRejectResponse();
                                                                    callback(undefined, xml);
                                                                }

                                                            }
                                                            else
                                                            {
                                                                var xml = xmlBuilder.createRejectResponse();
                                                                callback(undefined, xml);
                                                            }

                                                        }
                                                    })


                                                }
                                                else
                                                {
                                                    callback(err, xmlBuilder.createRejectResponse());
                                                }

                                            }
                                            else if(operationType === 'PARK')
                                            {
                                                var extraData = pbxObj.ExtraData;

                                                if(extraData)
                                                {
                                                    var xml = xmlBuilder.CreateParkDialplan(reqId, extraData, context, '[^\\s]*', extraData, companyId, tenantId, appId, dvpCallDirection);
                                                    callback(undefined, xml);
                                                }
                                                else
                                                {
                                                    callback(err, xmlBuilder.createRejectResponse());
                                                }

                                            }
                                            else if(operationType === 'INTERCEPT')
                                            {
                                                var extraData = pbxObj.ExtraData;

                                                var redisKey = tenantId + '_' + extraData + '_PBXUSERCALL';

                                                redisHandler.GetObject(reqId, redisKey, function(err, redisResult)
                                                {
                                                    if(!err && redisResult)
                                                    {
                                                        var xml = xmlBuilder.CreateInterceptDialplan(reqId, redisResult, context, '[^\\s]*', companyId, tenantId, appId, dvpCallDirection);
                                                        callback(undefined, xml);
                                                    }
                                                    else
                                                    {
                                                        callback(err, xmlBuilder.createRejectResponse());
                                                    }
                                                })

                                            }
                                            else if(operationType === 'BARGE')
                                            {
                                                var extraData = pbxObj.ExtraData;

                                                var redisKey = tenantId + '_' + extraData + '_PBXUSERCALL';

                                                redisHandler.GetObject(reqId, redisKey, function(err, redisResult)
                                                {
                                                    if(!err && redisResult)
                                                    {
                                                        var xml = xmlBuilder.CreateBargeDialplan(reqId, redisResult, context, '[^\\s]*', true);
                                                        callback(undefined, xml);
                                                    }
                                                    else
                                                    {
                                                        callback(err, xmlBuilder.createRejectResponse());
                                                    }
                                                })

                                            }
                                            else if(operationType === 'VOICEMAIL')
                                            {
                                                var extraData = pbxObj.ExtraData;

                                                if(extraData)
                                                {
                                                    backendFactory.getBackendHandler().GetAllDataForExt(reqId, extraData, companyId, tenantId, 'USER', csId, cacheData, function(err, extDetails)
                                                    {
                                                        if(err || !extDetails || !extDetails.SipUACEndpoint || !extDetails.SipUACEndpoint.CloudEndUser)
                                                        {
                                                            callback(err, xmlBuilder.createRejectResponse());
                                                        }
                                                        else
                                                        {
                                                            if(fromUserUuid === extDetails.SipUACEndpoint.SipUserUuid)
                                                            {
                                                                var xml = xmlBuilder.CreateVoicemailDialplan(reqId, extraData, context, '[^\\s]*', extDetails.SipUACEndpoint.CloudEndUser.Domain);
                                                                callback(undefined, xml);
                                                            }
                                                            else
                                                            {
                                                                callback(new Error('Cannot listen to other peoples voicemails'), xmlBuilder.createRejectResponse());
                                                            }

                                                        }
                                                    });

                                                }
                                                else
                                                {
                                                    callback(err, xmlBuilder.createRejectResponse());
                                                }

                                            }
                                            else if(operationType === 'DIALPLAN')
                                            {
                                                callback(undefined, pbxObj.Dialplan);
                                            }
                                            else
                                            {
                                                logger.error('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Unsupported Operation Type Returned From Extended App', reqId);
                                                callback(new Error('Unsupported Operation Type Returned From Extended App'), xmlBuilder.createRejectResponse());
                                            }
                                        }



                                    }
                                    else
                                    {
                                        if(fromUserData.DenyOutboundFor === 'ALL' || fromUserData.DenyOutboundFor === 'GATEWAY')
                                        {
                                            callback(null, xmlBuilder.CreateOutboundDeniedMessageDialplan(reqId, '[^\\s]*', context, companyId, tenantId, appId, dvpCallDirection));
                                        }
                                        else
                                        {
                                            backendFactory.getRuleHandler().PickCallRuleOutboundComplete(reqId, ani, dnis, '', context, companyId, tenantId, true, cacheData, function(err, rule)
                                            {
                                                if(err)
                                                {
                                                    callback(err, xmlBuilder.createRejectResponse());
                                                }
                                                else if(rule)
                                                {
                                                    if(rule.FaxType)
                                                    {
                                                        toFaxType = rule.FaxType;
                                                    }

                                                    var recEnabled = false;

                                                    if(ctxtRecordingEnabled)
                                                    {
                                                        recEnabled = true;
                                                    }
                                                    else
                                                    {
                                                        if(fromUserData && fromUserData.RecordingEnabled)
                                                        {
                                                            recEnabled = true;
                                                        }
                                                        else
                                                        {
                                                            recEnabled = false;
                                                        }
                                                    }
                                                    var ep =
                                                    {
                                                        Profile: rule.GatewayCode,
                                                        Type: 'GATEWAY',
                                                        LegStartDelay: 0,
                                                        BypassMedia: false,
                                                        LegTimeout: 60,
                                                        Origination: rule.ANI,
                                                        OriginationCallerIdNumber: rule.ANI,
                                                        Destination: rule.DNIS,
                                                        Domain: rule.IpUrl,
                                                        TrunkNumber: rule.TrunkNumber,
                                                        NumberType: rule.NumberType,
                                                        CompanyId: rule.CompanyId,
                                                        TenantId: rule.TenantId,
                                                        AppId: appId,
                                                        Action: 'DEFAULT',
                                                        RecordEnabled: recEnabled,
                                                        Operator: rule.Operator
                                                    };

                                                    if(dodActive && dodNumber)
                                                    {
                                                        ep.Origination = dodNumber;
                                                        ep.OriginationCallerIdNumber = dodNumber;
                                                    }

                                                    if(toFaxType)
                                                    {
                                                        //gateway fax dialplan
                                                        var xml = xmlBuilder.CreateRouteFaxGatewayDialplan(reqId, ep, context, profile, '[^\\s]*', false, fromFaxType, toFaxType);
                                                        callback(undefined, xml);
                                                    }
                                                    else
                                                    {
                                                        var attTransInfo = AttendantTransferLegInfoHandler(reqId, fromUserData, null);

                                                        extApi.CheckBalance(reqId, uuid, ep.Origination, ep.Destination, 'minute', ep.Operator, ep.CompanyId, ep.TenantId)
                                                            .then(function(balanceRes)
                                                            {
                                                                if (balanceRes && balanceRes.IsSuccess)
                                                                {
                                                                    backendFactory.getBackendHandler().getContextPreferences(context, 'public', companyId, tenantId).then(function(codecPrefs)
                                                                    {
                                                                        var tempCodecPref = null;
                                                                        if(codecPrefs)
                                                                        {
                                                                            tempCodecPref = codecPrefs.Codecs;
                                                                        }

                                                                        backendFactory.getBackendHandler().GetCompanyLimits(companyId, tenantId).then(function(compLimits)
                                                                        {
                                                                            var limits = {
                                                                                NumberOutboundLimit: rule.OutLimit,
                                                                                NumberBothLimit: rule.BothLimit,
                                                                                CompanyOutboundLimit: compLimits.OutboundLimit,
                                                                                CompanyBothLimit: compLimits.BothLimit
                                                                            };

                                                                            var NumLimitInfo = LimitValidator(limits, rule.TrunkNumber, 'outbound');

                                                                            if(NumLimitInfo)
                                                                            {
                                                                                ep.Limits = NumLimitInfo;
                                                                                var xml = xmlBuilder.CreateRouteGatewayDialplan(reqId, ep, context, profile, '[^\\s]*', false, attTransInfo, dvpCallDirection, tempCodecPref, null);

                                                                                callback(null, xml);
                                                                            }
                                                                            else
                                                                            {
                                                                                logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Limits not defined', reqId);
                                                                                callback(err, xmlBuilder.createRejectResponse());
                                                                            }



                                                                        }).catch(function(err)
                                                                        {
                                                                            logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error getting company limits', reqId);
                                                                            callback(err, xmlBuilder.createRejectResponse());

                                                                        });





                                                                    }).catch(function(err)
                                                                    {
                                                                        logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                                        callback(err, xmlBuilder.createRejectResponse());
                                                                    });


                                                                }
                                                                else
                                                                {
                                                                    callback(new Error('insufficient balance'), xmlBuilder.createRejectResponse());
                                                                }

                                                            })
                                                            .catch(function(err)
                                                            {
                                                                callback(err, xmlBuilder.createRejectResponse());
                                                            });


                                                    }

                                                }
                                                else
                                                {
                                                    callback(undefined, xmlBuilder.createRejectResponse());
                                                }
                                            })
                                        }

                                    }
                                }
                            })
                        }
                        else
                        {
                            if(fromUserData.DenyOutboundFor === 'ALL' || fromUserData.DenyOutboundFor === 'GATEWAY')
                            {
                                callback(null, xmlBuilder.CreateOutboundDeniedMessageDialplan(reqId, '[^\\s]*', context, companyId, tenantId, appId, dvpCallDirection));
                            }
                            else
                            {
                                backendFactory.getRuleHandler().PickCallRuleOutboundComplete(reqId, ani, dnis, '', context, companyId, tenantId, true, cacheData, function(err, rule)
                                {
                                    if(err)
                                    {
                                        callback(err, xmlBuilder.createRejectResponse());
                                    }
                                    else if(rule)
                                    {
                                        if(rule.FaxType)
                                        {
                                            toFaxType = rule.FaxType;
                                        }

                                        var recEnabled = false;

                                        if(ctxtRecordingEnabled)
                                        {
                                            recEnabled = true;
                                        }
                                        else
                                        {
                                            if(fromUserData && fromUserData.RecordingEnabled)
                                            {
                                                recEnabled = true;
                                            }
                                            else
                                            {
                                                recEnabled = false;
                                            }
                                        }

                                        var ep =
                                        {
                                            Profile: rule.GatewayCode,
                                            Type: 'GATEWAY',
                                            LegStartDelay: 0,
                                            BypassMedia: false,
                                            LegTimeout: 60,
                                            Origination: rule.ANI,
                                            OriginationCallerIdNumber: rule.ANI,
                                            Destination: rule.DNIS,
                                            Domain: rule.IpUrl,
                                            OutLimit: rule.OutLimit,
                                            BothLimit: rule.BothLimit,
                                            TrunkNumber: rule.TrunkNumber,
                                            NumberType: rule.NumberType,
                                            CompanyId: rule.CompanyId,
                                            TenantId: rule.TenantId,
                                            AppId: appId,
                                            Action: 'DEFAULT',
                                            RecordEnabled: recEnabled,
                                            Operator: rule.Operator
                                        };

                                        if(dodActive && dodNumber)
                                        {
                                            ep.Origination = dodNumber;
                                            ep.OriginationCallerIdNumber = dodNumber;
                                        }

                                        if(toFaxType)
                                        {
                                            //gateway fax dialplan
                                            var xml = xmlBuilder.CreateRouteFaxGatewayDialplan(reqId, ep, context, profile, '[^\\s]*', false, fromFaxType, toFaxType);
                                            callback(undefined, xml);
                                        }
                                        else
                                        {
                                            var attTransInfo = AttendantTransferLegInfoHandler(reqId, fromUserData, null);

                                            extApi.CheckBalance(reqId, uuid, ep.Origination, ep.Destination, 'minute', ep.Operator, ep.CompanyId, ep.TenantId)
                                                .then(function(balanceRes)
                                                {
                                                    if (balanceRes && balanceRes.IsSuccess)
                                                    {
                                                        backendFactory.getBackendHandler().getContextPreferences(context, 'public', companyId, tenantId).then(function(codecPrefs)
                                                        {
                                                            var tempCodecPref = null;
                                                            if(codecPrefs)
                                                            {
                                                                tempCodecPref = codecPrefs.Codecs;
                                                            }

                                                            backendFactory.getBackendHandler().GetCompanyLimits(companyId, tenantId).then(function(compLimits)
                                                            {
                                                                var limits = {
                                                                    NumberOutboundLimit: rule.OutLimit,
                                                                    NumberBothLimit: rule.BothLimit,
                                                                    CompanyOutboundLimit: compLimits.OutboundLimit,
                                                                    CompanyBothLimit: compLimits.BothLimit
                                                                };

                                                                var NumLimitInfo = LimitValidator(limits, rule.TrunkNumber, 'outbound');

                                                                if(NumLimitInfo)
                                                                {
                                                                    ep.Limits = NumLimitInfo;
                                                                    var xml = xmlBuilder.CreateRouteGatewayDialplan(reqId, ep, context, profile, '[^\\s]*', false, attTransInfo, dvpCallDirection, tempCodecPref, null);

                                                                    callback(null, xml);
                                                                }
                                                                else
                                                                {
                                                                    logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Limits not defined', reqId);
                                                                    callback(err, xmlBuilder.createRejectResponse());
                                                                }



                                                            }).catch(function(err)
                                                            {
                                                                logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error getting company limits', reqId);
                                                                callback(err, xmlBuilder.createRejectResponse());

                                                            });





                                                        }).catch(function(err)
                                                        {
                                                            logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                            callback(err, xmlBuilder.createRejectResponse());
                                                        });


                                                    }
                                                    else
                                                    {
                                                        callback(new Error('insufficient balance'), xmlBuilder.createRejectResponse());
                                                    }

                                                })
                                                .catch(function(err)
                                                {
                                                    callback(err, xmlBuilder.createRejectResponse());
                                                });


                                        }

                                    }
                                    else
                                    {
                                        callback(undefined, xmlBuilder.createRejectResponse());
                                    }
                                })
                            }

                        }
                    }
                })
            }
            else
            {
                if(appType && (appType === 'HTTAPI' || appType === 'AUTO_ATTENDANT' || appType === 'VOICEMAIL' || appType === 'DIALER' || appType === 'IVR_TRANSFER'))
                {

                    var fromUserUuid = '';


                    var dodNumber = undefined;
                    var dodActive = undefined;

                    //Get to user
                    backendFactory.getBackendHandler().GetExtensionDB(reqId, dnis, companyId, tenantId, cacheData, function(err, extInfo)
                    {
                        if(err)
                        {
                            callback(err, xmlBuilder.createRejectResponse());
                        }
                        else if(extInfo)
                        {
                            logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Extension found', reqId);
                            backendFactory.getBackendHandler().GetAllDataForExt(reqId, dnis, companyId, tenantId, extInfo.ObjCategory, csId, cacheData, function(err, extDetails)
                            {
                                if(err)
                                {
                                    //return default xml
                                    callback(err, xmlBuilder.createRejectResponse());
                                }
                                else if(extDetails)
                                {
                                    logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Extension Category : %s', reqId, extDetails.ObjCategory);
                                    toFaxType = extDetails.ExtraData;
                                    if(extDetails.ObjCategory === 'USER')
                                    {
                                        if(extDetails.SipUACEndpoint)
                                        {
                                            var grp = '';
                                            var toUsrDomain = '';


                                            if(extDetails.SipUACEndpoint && extDetails.SipUACEndpoint.CloudEndUser)
                                            {
                                                toUsrDomain = extDetails.SipUACEndpoint.CloudEndUser.Domain;
                                            }

                                            if(extDetails.SipUACEndpoint.UserGroup && extDetails.SipUACEndpoint.UserGroup.Extension)
                                            {
                                                grp = extDetails.SipUACEndpoint.UserGroup.Extension.Extension;
                                            }

                                            if(url)
                                            {
                                                //Check extension type and handle accordingly
                                                extApi.RemoteGetDialplanConfig(reqId, ani, dnis, context, direction, extDetails.SipUACEndpoint.SipUserUuid, fromUserUuid, extDetails.ObjCategory, undefined, appId, url, companyId, tenantId, securityToken, function(err, pbxDetails)
                                                {
                                                    if(err)
                                                    {
                                                        callback(err, xmlBuilder.createRejectResponse());
                                                    }
                                                    else if(!pbxDetails)
                                                    {
                                                        if(fromUserData && fromUserData.DenyOutboundFor === 'ALL')
                                                        {
                                                            callback(null, xmlBuilder.CreateOutboundDeniedMessageDialplan(reqId, '[^\\s]*', context, companyId, tenantId, appId, dvpCallDirection));
                                                        }
                                                        else
                                                        {
                                                            var recEnabled = false;

                                                            var ep =
                                                            {
                                                                Profile: profile,
                                                                Type: 'USER',
                                                                LegStartDelay: 0,
                                                                BypassMedia: false,
                                                                LegTimeout: 60,
                                                                Origination: callerIdName,
                                                                OriginationCallerIdNumber: callerIdNum,
                                                                Destination: extDetails.Extension,
                                                                Domain: toUsrDomain,
                                                                Group: grp,
                                                                IsVoicemailEnabled: false,
                                                                PersonalGreeting: undefined,
                                                                CompanyId: companyId,
                                                                TenantId: tenantId,
                                                                AppId: appId,
                                                                Action: 'DEFAULT',
                                                                RecordEnabled: recEnabled
                                                            };

                                                            var customStr = tenantId + '_' + extDetails.Extension + '_PBXUSERCALL';

                                                            redisHandler.SetObjectWithExpire(customStr, uuid, 60, function(err, redisResult)
                                                            {
                                                                if(!err && redisResult)
                                                                {
                                                                    var attTransInfo = AttendantTransferLegInfoHandler(reqId, null, extDetails.SipUACEndpoint);

                                                                    if(extDetails.SipUACEndpoint.UsePublic)
                                                                    {
                                                                        ep.Profile = 'external';
                                                                        ep.Type = 'PUBLIC_USER';
                                                                        ep.Destination = extDetails.SipUACEndpoint.SipUsername;
                                                                        ep.Domain = extDetails.SipUACEndpoint.Domain;
                                                                    }

                                                                    backendFactory.getBackendHandler().getContextPreferences(context, extDetails.SipUACEndpoint.ContextId, companyId, tenantId).then(function(codecPrefs)
                                                                    {
                                                                        var tempCodecPref = null;
                                                                        if(codecPrefs)
                                                                        {
                                                                            tempCodecPref = codecPrefs.Codecs;
                                                                        }
                                                                        var xml = xmlBuilder.CreateRouteUserDialplan(reqId, ep, context, profile, '[^\\s]*', false, undefined, attTransInfo, dvpCallDirection, tempCodecPref);

                                                                        callback(undefined, xml);

                                                                    }).catch(function(err)
                                                                    {
                                                                        logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                                        callback(err, xmlBuilder.createRejectResponse());
                                                                    });


                                                                }
                                                                else
                                                                {
                                                                    callback(err, xmlBuilder.createRejectResponse());
                                                                }
                                                            });
                                                        }

                                                    }
                                                    else
                                                    {
                                                        if(pbxDetails.OperationType === 'DENY')
                                                        {
                                                            callback(null, xmlBuilder.CreateOutboundDeniedMessageDialplan(reqId, '[^\\s]*', context, companyId, tenantId, appId, dvpCallDirection));
                                                        }
                                                        else
                                                        {
                                                            var pbxObj = pbxDetails;

                                                            var voicemailEnabled = pbxObj.VoicemailEnabled;
                                                            var personalGreeting = pbxObj.PersonalGreeting;
                                                            var bypassMedia = pbxObj.BypassMedia;

                                                            var ringTime = 60;

                                                            if(pbxObj.RingTimeout)
                                                            {
                                                                ringTime = pbxObj.RingTimeout;
                                                            }


                                                            if(pbxObj.OperationType === 'DND')
                                                            {
                                                                var xml = xmlBuilder.CreateSendBusyMessageDialplan(reqId, '[^\\s]*', context, undefined, companyId, tenantId, appId, dvpCallDirection);

                                                                callback(undefined, xml);
                                                            }
                                                            else if(pbxObj.OperationType === 'USER_DIAL')
                                                            {
                                                                var recEnabled = false;


                                                                var ep =
                                                                {
                                                                    Profile: profile,
                                                                    Type: 'USER',
                                                                    LegStartDelay: 0,
                                                                    BypassMedia: bypassMedia,
                                                                    LegTimeout: ringTime,
                                                                    Origination: callerIdName,
                                                                    OriginationCallerIdNumber: callerIdNum,
                                                                    Destination: extDetails.Extension,
                                                                    Domain: toUsrDomain,
                                                                    Group: grp,
                                                                    IsVoicemailEnabled: voicemailEnabled,
                                                                    PersonalGreeting: personalGreeting,
                                                                    CompanyId: companyId,
                                                                    TenantId: tenantId,
                                                                    AppId: appId,
                                                                    Action: 'DEFAULT',
                                                                    RecordEnabled: recEnabled
                                                                };

                                                                var customStr = tenantId + '_' + extDetails.Extension + '_PBXUSERCALL';

                                                                redisHandler.SetObjectWithExpire(customStr, uuid, 60, function(err, redisResult)
                                                                {
                                                                    if(!err && redisResult)
                                                                    {
                                                                        var attTransInfo = AttendantTransferLegInfoHandler(reqId, null, extDetails.SipUACEndpoint);

                                                                        if(extDetails.SipUACEndpoint.UsePublic)
                                                                        {
                                                                            ep.Profile = 'external';
                                                                            ep.Type = 'PUBLIC_USER';
                                                                            ep.Destination = extDetails.SipUACEndpoint.SipUsername;
                                                                            ep.Domain = extDetails.SipUACEndpoint.Domain;
                                                                        }

                                                                        backendFactory.getBackendHandler().getContextPreferences(context, extDetails.SipUACEndpoint.ContextId, companyId, tenantId).then(function(codecPrefs)
                                                                        {
                                                                            var tempCodecPref = null;
                                                                            if(codecPrefs)
                                                                            {
                                                                                tempCodecPref = codecPrefs.Codecs;
                                                                            }
                                                                            var xml = xmlBuilder.CreateRouteUserDialplan(reqId, ep, context, profile, '[^\\s]*', false, undefined, attTransInfo, dvpCallDirection, tempCodecPref);

                                                                            callback(undefined, xml);

                                                                        }).catch(function(err)
                                                                        {
                                                                            logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                                            callback(err, xmlBuilder.createRejectResponse());
                                                                        });


                                                                    }
                                                                    else
                                                                    {
                                                                        callback(err, xmlBuilder.createRejectResponse());
                                                                    }
                                                                });
                                                            }
                                                            else if(pbxObj.OperationType === 'FOLLOW_ME')
                                                            {
                                                                if(pbxDetails.Endpoints && pbxDetails.Endpoints.length > 0)
                                                                {
                                                                    CreateFMEndpointList(reqId, ani, context, companyId, tenantId, pbxDetails.Endpoints, '', false, callerIdNum, callerIdName, csId, appId, cacheData, function(err, epList)
                                                                    {
                                                                        if(err)
                                                                        {
                                                                            callback(err, xmlBuilder.createRejectResponse());
                                                                        }
                                                                        else if(epList && epList.length > 0)
                                                                        {
                                                                            var xml = xmlBuilder.CreateFollowMeDialplan(reqId, epList, context, profile, '[^\\s]*', false, undefined, companyId, tenantId, appId, dvpCallDirection);

                                                                            callback(undefined, xml);
                                                                        }
                                                                        else
                                                                        {
                                                                            callback(err, xmlBuilder.createRejectResponse());
                                                                        }
                                                                    })
                                                                }
                                                            }
                                                            else if(pbxObj.OperationType === 'FORWARD')
                                                            {
                                                                if(pbxDetails.Endpoints)
                                                                {
                                                                    var ep =
                                                                    {
                                                                        Profile: profile,
                                                                        Type: 'USER',
                                                                        LegStartDelay: 0,
                                                                        BypassMedia: bypassMedia,
                                                                        LegTimeout: ringTime,
                                                                        Origination: callerIdName,
                                                                        OriginationCallerIdNumber: callerIdNum,
                                                                        Destination: dnis,
                                                                        Domain: toUsrDomain,
                                                                        Group: grp,
                                                                        CompanyId: companyId,
                                                                        TenantId: tenantId,
                                                                        AppId: appId
                                                                    };

                                                                    if(dodActive && dodNumber)
                                                                    {
                                                                        ep.DodNumber = dodNumber;
                                                                    }

                                                                    var pbxFwdKey = util.format('DVPFORWARDING_%d_%d_%s', companyId, tenantId, pbxDetails.UserRefId);
                                                                    var forwardingInfo = JSON.stringify(pbxDetails.Endpoints);

                                                                    redisHandler.SetObjectWithExpire(pbxFwdKey, forwardingInfo, 360, function(err, redisResp)
                                                                    {
                                                                        if(err)
                                                                        {
                                                                            callback(err, xmlBuilder.createRejectResponse());
                                                                        }
                                                                        else
                                                                        {

                                                                            if(extDetails.SipUACEndpoint.UsePublic)
                                                                            {
                                                                                ep.Profile = 'external';
                                                                                ep.Type = 'PUBLIC_USER';
                                                                                ep.Destination = extDetails.SipUACEndpoint.SipUsername;
                                                                                ep.Domain = extDetails.SipUACEndpoint.Domain;
                                                                                ep.BypassMedia = false;
                                                                            }

                                                                            var attTransInfo = AttendantTransferLegInfoHandler(reqId, null, extDetails.SipUACEndpoint);

                                                                            backendFactory.getBackendHandler().getContextPreferences(context, extDetails.SipUACEndpoint.ContextId, companyId, tenantId).then(function(codecPrefs)
                                                                            {
                                                                                var tempCodecPref = null;
                                                                                if(codecPrefs)
                                                                                {
                                                                                    tempCodecPref = codecPrefs.Codecs;
                                                                                }

                                                                                var xml = xmlBuilder.CreateForwardingDialplan(reqId, ep, context, profile, '[^\\s]*', false, pbxFwdKey, null, attTransInfo, dvpCallDirection, tempCodecPref);

                                                                                callback(undefined, xml);

                                                                            }).catch(function(err)
                                                                            {
                                                                                logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                                                callback(err, xmlBuilder.createRejectResponse());
                                                                            });

                                                                        }
                                                                    });
                                                                }
                                                                else
                                                                {
                                                                    var recEnabled = false;

                                                                    //Do Normal User Dial
                                                                    var ep =
                                                                    {
                                                                        Profile: profile,
                                                                        Type: 'USER',
                                                                        LegStartDelay: 0,
                                                                        BypassMedia: bypassMedia,
                                                                        LegTimeout: ringTime,
                                                                        Origination: callerIdName,
                                                                        OriginationCallerIdNumber: callerIdNum,
                                                                        Destination: extDetails.Extension,
                                                                        Domain: toUsrDomain,
                                                                        Group: grp,
                                                                        IsVoicemailEnabled: voicemailEnabled,
                                                                        PersonalGreeting: personalGreeting,
                                                                        CompanyId: companyId,
                                                                        TenantId: tenantId,
                                                                        AppId: appId,
                                                                        Action: 'DEFAULT',
                                                                        RecordEnabled: recEnabled
                                                                    };

                                                                    var customStr = tenantId + '_' + extDetails.Extension + '_PBXUSERCALL';

                                                                    redisHandler.SetObjectWithExpire(customStr, uuid, 60, function(err, redisResult)
                                                                    {
                                                                        if(!err && redisResult)
                                                                        {
                                                                            var attTransInfo = AttendantTransferLegInfoHandler(reqId, null, extDetails.SipUACEndpoint);

                                                                            if(extDetails.SipUACEndpoint.UsePublic)
                                                                            {
                                                                                ep.Profile = 'external';
                                                                                ep.Type = 'PUBLIC_USER';
                                                                                ep.Destination = extDetails.SipUACEndpoint.SipUsername;
                                                                                ep.Domain = extDetails.SipUACEndpoint.Domain;
                                                                            }

                                                                            backendFactory.getBackendHandler().getContextPreferences(context, extDetails.SipUACEndpoint.ContextId, companyId, tenantId).then(function(codecPrefs)
                                                                            {
                                                                                var tempCodecPref = null;
                                                                                if(codecPrefs)
                                                                                {
                                                                                    tempCodecPref = codecPrefs.Codecs;
                                                                                }
                                                                                var xml = xmlBuilder.CreateRouteUserDialplan(reqId, ep, context, profile, '[^\\s]*', false, undefined, attTransInfo, dvpCallDirection, tempCodecPref);

                                                                                callback(undefined, xml);

                                                                            }).catch(function(err)
                                                                            {
                                                                                logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                                                callback(err, xmlBuilder.createRejectResponse());
                                                                            });


                                                                        }
                                                                        else
                                                                        {
                                                                            callback(err, xmlBuilder.createRejectResponse());
                                                                        }
                                                                    });
                                                                }

                                                            }
                                                            else if(pbxObj.OperationType === 'CALL_DIVERT')
                                                            {
                                                                if (pbxObj.Endpoints && pbxObj.Endpoints.ObjCategory === 'GATEWAY')
                                                                {
                                                                    //pick outbound rule
                                                                    backendFactory.getRuleHandler().PickCallRuleOutboundComplete(reqId, ani, pbxObj.Endpoints.DestinationNumber, '', context, companyId, tenantId, false, cacheData, function (err, rule)
                                                                    {
                                                                        if (!err && rule)
                                                                        {
                                                                            var ep =
                                                                            {
                                                                                Profile: rule.GatewayCode,
                                                                                Type: 'GATEWAY',
                                                                                LegStartDelay: 0,
                                                                                BypassMedia: false,
                                                                                LegTimeout: 60,
                                                                                Destination: rule.DNIS,
                                                                                Domain: rule.IpUrl,
                                                                                TrunkNumber: rule.TrunkNumber,
                                                                                NumberType: rule.NumberType,
                                                                                CompanyId: rule.CompanyId,
                                                                                TenantId: rule.TenantId,
                                                                                Action: 'CALL_DIVERT',
                                                                                AppId: appId,
                                                                                Operator: rule.Operator
                                                                            };


                                                                            if(dodActive && dodNumber)
                                                                            {
                                                                                ep.Origination = dodNumber;
                                                                                ep.OriginationCallerIdNumber = dodNumber;
                                                                            }
                                                                            else
                                                                            {
                                                                                ep.Origination = rule.ANI;
                                                                                ep.OriginationCallerIdNumber = rule.ANI;
                                                                            }

                                                                            var attTransInfo = AttendantTransferLegInfoHandler(reqId, null, null);

                                                                            extApi.CheckBalance(reqId, uuid, ep.Origination, ep.Destination, 'minute', ep.Operator, ep.CompanyId, ep.TenantId)
                                                                                .then(function(balanceRes)
                                                                                {
                                                                                    if (balanceRes && balanceRes.IsSuccess)
                                                                                    {
                                                                                        backendFactory.getBackendHandler().getContextPreferences(context, 'public', companyId, tenantId).then(function(codecPrefs)
                                                                                        {
                                                                                            var tempCodecPref = null;
                                                                                            if(codecPrefs)
                                                                                            {
                                                                                                tempCodecPref = codecPrefs.Codecs;
                                                                                            }

                                                                                            backendFactory.getBackendHandler().GetCompanyLimits(companyId, tenantId).then(function(compLimits)
                                                                                            {
                                                                                                var limits = {
                                                                                                    NumberOutboundLimit: rule.OutLimit,
                                                                                                    NumberBothLimit: rule.BothLimit,
                                                                                                    CompanyOutboundLimit: compLimits.OutboundLimit,
                                                                                                    CompanyBothLimit: compLimits.BothLimit
                                                                                                };

                                                                                                var NumLimitInfo = LimitValidator(limits, rule.TrunkNumber, 'outbound');

                                                                                                if(NumLimitInfo)
                                                                                                {
                                                                                                    ep.Limits = NumLimitInfo;
                                                                                                    var xml = xmlBuilder.CreateRouteGatewayDialplan(reqId, ep, context, profile, '[^\\s]*', false, attTransInfo, dvpCallDirection, tempCodecPref, null);

                                                                                                    callback(null, xml);
                                                                                                }
                                                                                                else
                                                                                                {
                                                                                                    logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Limits not defined', reqId);
                                                                                                    callback(err, xmlBuilder.createRejectResponse());
                                                                                                }



                                                                                            }).catch(function(err)
                                                                                            {
                                                                                                logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error getting company limits', reqId);
                                                                                                callback(err, xmlBuilder.createRejectResponse());

                                                                                            });





                                                                                        }).catch(function(err)
                                                                                        {
                                                                                            logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                                                            callback(err, xmlBuilder.createRejectResponse());
                                                                                        });


                                                                                    }
                                                                                    else
                                                                                    {
                                                                                        callback(new Error('insufficient balance'), xmlBuilder.createRejectResponse());
                                                                                    }

                                                                                })
                                                                                .catch(function(err)
                                                                                {
                                                                                    callback(err, xmlBuilder.createRejectResponse());
                                                                                });


                                                                        }
                                                                        else
                                                                        {
                                                                            callback(undefined, xmlBuilder.createRejectResponse());
                                                                        }
                                                                    })
                                                                }
                                                                else if(pbxObj.Endpoints && (pbxObj.Endpoints.ObjCategory === 'PBXUSER' || pbxObj.Endpoints.ObjCategory === 'USER'))
                                                                {
                                                                    backendFactory.getBackendHandler().GetAllDataForExt(reqId, pbxObj.Endpoints.DestinationNumber, companyId, tenantId, 'USER', csId, cacheData, function (err, extDetails)
                                                                    {

                                                                        if (!err && extDetails)
                                                                        {
                                                                            if (extDetails.SipUACEndpoint && extDetails.SipUACEndpoint.CloudEndUser)
                                                                            {
                                                                                var ep =
                                                                                {
                                                                                    Profile: '',
                                                                                    Type: 'USER',
                                                                                    LegStartDelay: 0,
                                                                                    BypassMedia: false,
                                                                                    LegTimeout: 60,
                                                                                    Origination: callerIdName,
                                                                                    OriginationCallerIdNumber: callerIdNum,
                                                                                    Destination: extDetails.Extension,
                                                                                    Domain: extDetails.SipUACEndpoint.CloudEndUser.Domain,
                                                                                    CompanyId: companyId,
                                                                                    TenantId: tenantId,
                                                                                    AppId: appId,
                                                                                    Action: 'DEFAULT'
                                                                                };

                                                                                var attTransInfo = AttendantTransferLegInfoHandler(reqId, null, extDetails.SipUACEndpoint);

                                                                                if(extDetails.SipUACEndpoint.UsePublic)
                                                                                {
                                                                                    ep.Profile = 'external';
                                                                                    ep.Type = 'PUBLIC_USER';
                                                                                    ep.Destination = extDetails.SipUACEndpoint.SipUsername;
                                                                                    ep.Domain = extDetails.SipUACEndpoint.Domain;
                                                                                }

                                                                                backendFactory.getBackendHandler().getContextPreferences(context, extDetails.SipUACEndpoint.ContextId, companyId, tenantId).then(function(codecPrefs)
                                                                                {
                                                                                    var tempCodecPref = null;
                                                                                    if(codecPrefs)
                                                                                    {
                                                                                        tempCodecPref = codecPrefs.Codecs;
                                                                                    }
                                                                                    var xml = xmlBuilder.CreateRouteUserDialplan(reqId, ep, context, profile, '[^\\s]*', false, numLimitInfo, attTransInfo, dvpCallDirection, tempCodecPref);

                                                                                    callback(undefined, xml);

                                                                                }).catch(function(err)
                                                                                {
                                                                                    logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                                                    callback(err, xmlBuilder.createRejectResponse());
                                                                                });



                                                                            }
                                                                            else
                                                                            {
                                                                                callback(undefined, xmlBuilder.createRejectResponse());
                                                                            }
                                                                        }
                                                                        else
                                                                        {
                                                                            callback(undefined, xmlBuilder.createRejectResponse());
                                                                        }

                                                                    });
                                                                }
                                                                else
                                                                {
                                                                    callback(undefined, xmlBuilder.createRejectResponse());
                                                                }
                                                            }
                                                            else
                                                            {

                                                                var recEnabled = false;


                                                                var ep =
                                                                {
                                                                    Profile: profile,
                                                                    Type: 'USER',
                                                                    LegStartDelay: 0,
                                                                    BypassMedia: bypassMedia,
                                                                    LegTimeout: ringTime,
                                                                    Origination: callerIdName,
                                                                    OriginationCallerIdNumber: callerIdNum,
                                                                    Destination: dnis,
                                                                    Domain: toUsrDomain,
                                                                    Group: grp,
                                                                    IsVoicemailEnabled: voicemailEnabled,
                                                                    PersonalGreeting: personalGreeting,
                                                                    CompanyId: companyId,
                                                                    TenantId: tenantId,
                                                                    AppId: appId,
                                                                    Action: 'DEFAULT',
                                                                    RecordEnabled: recEnabled
                                                                };

                                                                var customStr = tenantId + '_' + extDetails.Extension + '_PBXUSERCALL';

                                                                redisHandler.SetObjectWithExpire(customStr, uuid, 60, function(err, redisResult)
                                                                {
                                                                    if(!err && redisResult)
                                                                    {
                                                                        var attTransInfo = AttendantTransferLegInfoHandler(reqId, null, extDetails.SipUACEndpoint);

                                                                        if(extDetails.SipUACEndpoint.UsePublic)
                                                                        {
                                                                            ep.Profile = 'external';
                                                                            ep.Type = 'PUBLIC_USER';
                                                                            ep.Destination = extDetails.SipUACEndpoint.SipUsername;
                                                                            ep.Domain = extDetails.SipUACEndpoint.Domain;
                                                                        }

                                                                        backendFactory.getBackendHandler().getContextPreferences(context, extDetails.SipUACEndpoint.ContextId, companyId, tenantId).then(function(codecPrefs)
                                                                        {
                                                                            var tempCodecPref = null;
                                                                            if(codecPrefs)
                                                                            {
                                                                                tempCodecPref = codecPrefs.Codecs;
                                                                            }
                                                                            var xml = xmlBuilder.CreateRouteUserDialplan(reqId, ep, context, profile, '[^\\s]*', false, undefined, attTransInfo, dvpCallDirection, tempCodecPref);

                                                                            callback(undefined, xml);

                                                                        }).catch(function(err)
                                                                        {
                                                                            logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                                            callback(err, xmlBuilder.createRejectResponse());
                                                                        });


                                                                    }
                                                                    else
                                                                    {
                                                                        callback(err, xmlBuilder.createRejectResponse());
                                                                    }
                                                                });
                                                            }
                                                        }

                                                    }
                                                })
                                            }
                                            else
                                            {
                                                if(fromUserData && fromUserData.DenyOutboundFor === 'ALL')
                                                {
                                                    callback(null, xmlBuilder.CreateOutboundDeniedMessageDialplan(reqId, '[^\\s]*', context, companyId, tenantId, appId, dvpCallDirection));
                                                }
                                                else
                                                {
                                                    var recEnabled = false;

                                                    var ep =
                                                    {
                                                        Profile: profile,
                                                        Type: 'USER',
                                                        LegStartDelay: 0,
                                                        BypassMedia: false,
                                                        LegTimeout: 60,
                                                        Origination: callerIdName,
                                                        OriginationCallerIdNumber: callerIdNum,
                                                        Destination: extDetails.Extension,
                                                        Domain: toUsrDomain,
                                                        Group: grp,
                                                        IsVoicemailEnabled: false,
                                                        PersonalGreeting: undefined,
                                                        CompanyId: companyId,
                                                        TenantId: tenantId,
                                                        AppId: appId,
                                                        Action: 'DEFAULT',
                                                        RecordEnabled: recEnabled
                                                    };

                                                    var customStr = tenantId + '_' + extDetails.Extension + '_PBXUSERCALL';

                                                    redisHandler.SetObjectWithExpire(customStr, uuid, 60, function(err, redisResult)
                                                    {
                                                        if(!err && redisResult)
                                                        {
                                                            var attTransInfo = AttendantTransferLegInfoHandler(reqId, null, extDetails.SipUACEndpoint);

                                                            if(extDetails.SipUACEndpoint.UsePublic)
                                                            {
                                                                ep.Profile = 'external';
                                                                ep.Type = 'PUBLIC_USER';
                                                                ep.Destination = extDetails.SipUACEndpoint.SipUsername;
                                                                ep.Domain = extDetails.SipUACEndpoint.Domain;
                                                            }

                                                            backendFactory.getBackendHandler().getContextPreferences(context, extDetails.SipUACEndpoint.ContextId, companyId, tenantId).then(function(codecPrefs)
                                                            {
                                                                var tempCodecPref = null;
                                                                if(codecPrefs)
                                                                {
                                                                    tempCodecPref = codecPrefs.Codecs;
                                                                }
                                                                var xml = xmlBuilder.CreateRouteUserDialplan(reqId, ep, context, profile, '[^\\s]*', false, undefined, attTransInfo, dvpCallDirection, tempCodecPref);

                                                                callback(undefined, xml);

                                                            }).catch(function(err)
                                                            {
                                                                logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                                callback(err, xmlBuilder.createRejectResponse());
                                                            });


                                                        }
                                                        else
                                                        {
                                                            callback(err, xmlBuilder.createRejectResponse());
                                                        }
                                                    });
                                                }

                                            }

                                        }
                                        else
                                        {
                                            callback(err, xmlBuilder.createRejectResponse());
                                        }

                                    }
                                    else if(extDetails.ObjCategory === 'FAX')
                                    {
                                        if(fromFaxType && toFaxType)
                                        {
                                            //process fax dialplan
                                        }
                                        else
                                        {
                                            callback(new Error('fax types not set'), xmlBuilder.createRejectResponse());
                                        }
                                    }
                                    else if(extDetails.ObjCategory === 'GROUP')
                                    {
                                        if(fromUserData && fromUserData.DenyOutboundFor === 'ALL')
                                        {
                                            callback(null, xmlBuilder.CreateOutboundDeniedMessageDialplan(reqId, '[^\\s]*', context, companyId, tenantId, appId, dvpCallDirection));
                                        }
                                        else
                                        {
                                            if(extDetails.UserGroup)
                                            {
                                                var ep =
                                                {
                                                    Profile: profile,
                                                    Type: 'GROUP',
                                                    LegStartDelay: 0,
                                                    BypassMedia: false,
                                                    LegTimeout: 60,
                                                    Origination: callerIdName,
                                                    OriginationCallerIdNumber: callerIdNum,
                                                    Destination: extDetails.Extension,
                                                    Domain: extDetails.UserGroup.Domain,
                                                    Group: extDetails.Extension,
                                                    CompanyId: companyId,
                                                    TenantId: tenantId,
                                                    AppId: appId,
                                                    Action: 'DEFAULT'
                                                };

                                                var customStr = tenantId + '_' + extDetails.Extension + '_PBXUSERCALL';

                                                redisHandler.SetObjectWithExpire(customStr, uuid, 60, function(err, redisResult)
                                                {
                                                    if (!err && redisResult)
                                                    {
                                                        var attTransInfo = AttendantTransferLegInfoHandler(reqId, null, null);
                                                        var xml = xmlBuilder.CreateRouteUserDialplan(reqId, ep, context, profile, '[^\\s]*', false, undefined, attTransInfo, dvpCallDirection, null);
                                                        callback(undefined, xml);
                                                    }
                                                    else
                                                    {
                                                        callback(err, xmlBuilder.createRejectResponse());
                                                    }
                                                });


                                            }
                                            else
                                            {
                                                callback(new Error('Extension has no group configurations'), xmlBuilder.createRejectResponse());
                                            }
                                        }



                                    }
                                    else if(extDetails.ObjCategory === 'CONFERENCE')
                                    {
                                        if(fromUserData && fromUserData.DenyOutboundFor === 'ALL')
                                        {
                                            callback(null, xmlBuilder.CreateOutboundDeniedMessageDialplan(reqId, '[^\\s]*', context, companyId, tenantId, appId, dvpCallDirection));
                                        }
                                        else
                                        {
                                            conferenceHandler.ConferenceHandlerOperation(reqId, extDetails, direction, fromUserUuid, context, profile, companyId, tenantId, appId, dvpCallDirection, cacheData, function(err, confXml)
                                            {
                                                callback(err, confXml);
                                            })
                                        }

                                    }
                                    else if(extDetails.ObjCategory === 'VOICE_PORTAL')
                                    {
                                        extApi.RemoteGetDialplanConfig(reqId, ani, dnis, context, direction, undefined, fromUserUuid, extDetails.ObjCategory, extDetails.ExtraData, appId, url, companyId, tenantId, securityToken, function(err, pbxDetails)
                                        {
                                            if(err)
                                            {
                                                callback(err, xmlBuilder.createRejectResponse());
                                            }
                                            else if(pbxDetails)
                                            {
                                                if(pbxDetails.OperationType === 'DIALPLAN')
                                                {
                                                    callback(undefined, pbxDetails.Dialplan);
                                                }
                                            }
                                            else
                                            {
                                                callback(new Error('PBX app returned empty value'), xmlBuilder.createRejectResponse());
                                            }

                                        });

                                    }
                                    else if(extDetails.ObjCategory === 'AUTO_ATTENDANT')
                                    {

                                        var ep =
                                        {
                                            Profile: profile,
                                            Type: 'AUTO_ATTENDANT',
                                            LegStartDelay: 0,
                                            BypassMedia: false,
                                            LegTimeout: 60,
                                            Origination: callerIdName,
                                            OriginationCallerIdNumber: callerIdNum,
                                            Destination: extDetails.Extension,
                                            CompanyId: companyId,
                                            TenantId: tenantId,
                                            AppId: appId,
                                            Action: 'AUTO_ATTENDANT'
                                        };

                                        var toContext = '';

                                        if(extDetails.Context)
                                        {
                                            toContext = extDetails.Context.Context;
                                        }

                                        var xml = xmlBuilder.CreateAutoAttendantDialplan(reqId, ep, context, toContext, '[^\\s]*', false, dvpCallDirection, null);

                                        callback(undefined, xml);

                                    }
                                    else if(extDetails.ObjCategory === 'IVR' || extDetails.ObjCategory === 'CAMPAIGN')
                                    {

                                        handleIVRExt(reqId, companyId, tenantId, uuid, context, extDetails, true, null)
                                            .then(function(ivrResp)
                                            {
                                                callback(null, ivrResp);

                                            })
                                            .catch(function(err)
                                            {
                                                callback(err, xmlBuilder.createRejectResponse());
                                            });

                                    }
                                    else
                                    {
                                        callback(new Error('Unsupported extension category'), xmlBuilder.createRejectResponse());
                                    }

                                }
                                else
                                {
                                    callback(new Error('Unsupported extension'), xmlBuilder.createRejectResponse());

                                }
                            });
                        }
                        else
                        {
                            logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Out call DNIS is not an extension', reqId);

                            if(fromUserData && (fromUserData.DenyOutboundFor === 'ALL' || fromUserData.DenyOutboundFor === 'GATEWAY'))
                            {
                                callback(null, xmlBuilder.CreateOutboundDeniedMessageDialplan(reqId, '[^\\s]*', context, companyId, tenantId, appId, dvpCallDirection));
                            }
                            else
                            {
                                backendFactory.getRuleHandler().PickCallRuleOutboundComplete(reqId, ani, dnis, '', context, companyId, tenantId, true, cacheData, function(err, rule)
                                {
                                    if(err)
                                    {
                                        callback(err, xmlBuilder.createRejectResponse());
                                    }
                                    else if(rule)
                                    {
                                        if(rule.FaxType)
                                        {
                                            toFaxType = rule.FaxType;
                                        }

                                        var recEnabled = false;

                                        if(ctxtRecordingEnabled)
                                        {
                                            recEnabled = true;
                                        }
                                        else
                                        {
                                            if(fromUserData && fromUserData.RecordingEnabled)
                                            {
                                                recEnabled = true;
                                            }
                                            else
                                            {
                                                recEnabled = false;
                                            }
                                        }
                                        var ep =
                                        {
                                            Profile: rule.GatewayCode,
                                            Type: 'GATEWAY',
                                            LegStartDelay: 0,
                                            BypassMedia: false,
                                            LegTimeout: 60,
                                            Origination: rule.ANI,
                                            OriginationCallerIdNumber: rule.ANI,
                                            Destination: rule.DNIS,
                                            Domain: rule.IpUrl,
                                            TrunkNumber: rule.TrunkNumber,
                                            NumberType: rule.NumberType,
                                            CompanyId: rule.CompanyId,
                                            TenantId: rule.TenantId,
                                            Action: 'DEFAULT',
                                            AppId: appId,
                                            RecordEnable: recEnabled,
                                            Operator: rule.Operator
                                        };

                                        if(dodActive && dodNumber)
                                        {
                                            ep.Origination = dodNumber;
                                            ep.OriginationCallerIdNumber = dodNumber;
                                        }

                                        if(toFaxType)
                                        {
                                            //gateway fax dialplan
                                            var xml = xmlBuilder.CreateRouteFaxGatewayDialplan(reqId, ep, context, profile, '[^\\s]*', false, fromFaxType, toFaxType);
                                            callback(undefined, xml);
                                        }
                                        else
                                        {
                                            var attTransInfo = AttendantTransferLegInfoHandler(reqId, fromUserData, null);

                                            extApi.CheckBalance(reqId, uuid, ep.Origination, ep.Destination, 'minute', ep.Operator, ep.CompanyId, ep.TenantId)
                                                .then(function(balanceRes)
                                                {
                                                    if (balanceRes && balanceRes.IsSuccess)
                                                    {
                                                        backendFactory.getBackendHandler().getContextPreferences(context, 'public', companyId, tenantId).then(function(codecPrefs)
                                                        {
                                                            var tempCodecPref = null;
                                                            if(codecPrefs)
                                                            {
                                                                tempCodecPref = codecPrefs.Codecs;
                                                            }

                                                            backendFactory.getBackendHandler().GetCompanyLimits(companyId, tenantId).then(function(compLimits)
                                                            {
                                                                var limits = {
                                                                    NumberOutboundLimit: rule.OutLimit,
                                                                    NumberBothLimit: rule.BothLimit,
                                                                    CompanyOutboundLimit: compLimits.OutboundLimit,
                                                                    CompanyBothLimit: compLimits.BothLimit
                                                                };

                                                                var NumLimitInfo = LimitValidator(limits, rule.TrunkNumber, 'outbound');

                                                                if(NumLimitInfo)
                                                                {
                                                                    ep.Limits = NumLimitInfo;
                                                                    var xml = xmlBuilder.CreateRouteGatewayDialplan(reqId, ep, context, profile, '[^\\s]*', false, attTransInfo, dvpCallDirection, tempCodecPref, null);

                                                                    callback(null, xml);
                                                                }
                                                                else
                                                                {
                                                                    logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Limits not defined', reqId);
                                                                    callback(err, xmlBuilder.createRejectResponse());
                                                                }



                                                            }).catch(function(err)
                                                            {
                                                                logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error getting company limits', reqId);
                                                                callback(err, xmlBuilder.createRejectResponse());

                                                            });





                                                        }).catch(function(err)
                                                        {
                                                            logger.debug('DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Error Occurred getting context prefs', reqId);
                                                            callback(err, xmlBuilder.createRejectResponse());
                                                        });


                                                    }
                                                    else
                                                    {
                                                        callback(new Error('insufficient balance'), xmlBuilder.createRejectResponse());
                                                    }

                                                })
                                                .catch(function(err)
                                                {
                                                    callback(err, xmlBuilder.createRejectResponse());
                                                });

                                        }

                                    }
                                    else
                                    {
                                        callback(undefined, xmlBuilder.createRejectResponse());
                                    }
                                })
                            }

                        }
                    })

                }
                else
                {
                    callback(new Error('From User Not Found'), xmlBuilder.createRejectResponse());
                }

            }





        }


        //Call SIP UAC Service and pass dnis and security token to get sip uac info
        //if uac record found get the relevant pbx configuration
        //if uac record
    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - Exception Occurred', reqId, ex);
        var jsonString = messageFormatter.FormatMessage(ex, "Exception occurred", false, false);
        logger.debug('[DVP-DynamicConfigurationGenerator.ProcessExtendedDialplan] - [%s] - API RESPONSE : %s', reqId, jsonString);
        res.end(jsonString);

    }
};

module.exports.ProcessExtendedDialplan = ProcessExtendedDialplan;
module.exports.ProcessCallForwarding = ProcessCallForwarding;
module.exports.AttendantTransferLegInfoHandler = AttendantTransferLegInfoHandler;