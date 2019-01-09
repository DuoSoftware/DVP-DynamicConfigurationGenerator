var restify = require('restify');
var config = require('config');
var nodeUuid = require('node-uuid');
var fsMediaFormatter = require('./FreeSwitchMediaFormatter.js');
var xmlGen = require('./XmlResponseGenerator.js');
var redisHandler = require('./RedisHandler.js');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var extDialplanEngine = require('./ExtendedDialplanEngine.js');
var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');
var Buffer = require('buffer');
var util = require('util');
var xmlBuilder = require('./XmlExtendedDialplanBuilder.js');
var ipValidator = require('./IpValidator');
var smsCdrOp = require('./SMSCDROp.js');
var backendFactory = require('./BackendFactory.js');
var translationHandler = require('dvp-ruleservice/TranslationHandler.js');
var underscore = require('underscore');
var extApi = require('./ExternalApiAccess.js');
var LimitValidator = require('./LimitValidator.js').LimitValidator;
var dashboardEvtHandler = require('./DashboardEventHandler.js');
var dialerOperations = require('./DialerOperations.js');

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

var hostIp = config.Host.Ip;
var hostPort = config.Host.Port;
var hostVersion = config.Host.Version;

var securityToken = config.Token;

var server = restify.createServer({
    name: 'DVP-DynamicConfigurationGenerator',
    formatters : {
        'application/x-www-form-urlencoded' : function(req, res, body, cb)
        {
            if (body instanceof Error)
                return body.stack;

            if (Buffer.isBuffer(body))
                return cb(null, body.toString('base64'));

            return cb(null, util.inspect(body));
        }
    }
});

server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser());



var RedisOperations = function(callUuid, companyId, tenantId, appId, appType, isDialplanGiven, callDirection, timestamp, bUnit)
{
    try
    {
        if(!isDialplanGiven)
        {
            var tempBUnit = bUnit;
            if(!bUnit)
            {
                bUnit = 'default';
            }
            var setName = 'CHANNELS:' + tenantId + ':' + companyId;

            redisHandler.AddChannelIdToSet(callUuid, setName, function(err, redisRes){});

            redisHandler.SetObject('CHANNELMAP:' + callUuid, setName, function(err, redisRes){
                redisHandler.ExpireKey('CHANNELMAP:' + callUuid, 86400);
            });

            var chanIncrKey = 'DVP_CHANNEL_COUNT_COMPANY:' + tenantId + ':' + companyId;

            redisHandler.IncrementKey(chanIncrKey, function(err, redisResp){});

            if(appId)
            {
                var setNameApp = 'CHANNELS_APP:' + appId;

                redisHandler.AddChannelIdToSet(callUuid, setNameApp, function(err, redisRes){});
            }

            if(appType)
            {
                redisHandler.AddToHash(callUuid, 'Application-Type', appType, function(err, redisRes){
                    redisHandler.ExpireKey(callUuid, 86400);
                });
            }

            if(timestamp)
            {
                var utcSeconds = parseInt(timestamp)/1000000;
                var d = new Date(0); // The 0 there is the key, which sets the date to the epoch
                d.setUTCSeconds(utcSeconds);
                var eventTime = d.toISOString();

                dashboardEvtHandler.PublishDashboardMessage(tenantId, companyId, "CALLSERVER", "CHANNEL", "CREATE", callUuid, '', '', eventTime, tempBUnit);

                dashboardEvtHandler.PublishDashboardMessage(tenantId, companyId, "CALLSERVER", "CALL", "CREATE", callUuid, callDirection, '', eventTime, tempBUnit);
            }


            /*var pubMessage = util.format("EVENT:%s:%s:%s:%s:%s:%s:%s:%s:YYYY", tenantId, companyId, "CALLSERVER", "CHANNEL", "CREATE", "", "", callUuid);

            redisHandler.PublishToRedis('events', pubMessage, function(err, redisRes){
                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - Trying to find from user for outbound call');

            });

            var pubMessageCalls = util.format("EVENT:%s:%s:%s:%s:%s:%s:%s:%s:YYYY", tenantId, companyId, "CALLSERVER", "CALL", "CREATE", callDirection, "", callUuid);

            redisHandler.PublishToRedis('events', pubMessageCalls, function(err, redisRes){
                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - Trying to find from user for outbound call');
            });*/
        }


    }
    catch(ex)
    {
        //Do nothing
    }


};


var HandleOutRequest = function(reqId, data, callerIdNum, contextTenant, appType, contextCompany, dvpOriginationType, destNum, domain, callerContext, profile, varUuid, isDialPlanGiven, ctxt, cacheData, eventTime, bUnit, isDialerIVR, res)
{
    try
    {
        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Trying to find from user for outbound call', reqId);
        backendFactory.getBackendHandler().GatherFromUserDetails(reqId, callerIdNum, contextCompany, contextTenant, false, cacheData, function(err, fromUsr)
        {
            var dodActive = false;
            var dodNumber = '';
            var fromUserUuid = '';
            if(fromUsr && fromUsr.Extension)
            {

                if(fromUsr.Extension.DodActive)
                {
                    dodActive = true;
                    dodNumber = fromUsr.Extension.DodNumber;
                }

                if(fromUsr && fromUsr.SipUserUuid)
                {
                    fromUserUuid = fromUsr.SipUserUuid;
                }
            }

            var tempCallerContext = callerContext;

            if(dvpOriginationType && dvpOriginationType === 'PUBLIC_USER')
            {

                tempCallerContext = fromUsr.ContextId;
                contextCompany = fromUsr.CompanyId;
                contextTenant = fromUsr.TenantId;
            }

            if(contextCompany && contextTenant)
            {
                backendFactory.getBackendHandler().GetCacheObject(contextTenant, contextCompany, function(err, cacheInfo)
                {
                    if(err)
                    {
                        var xml = xmlGen.createRejectResponse(callerContext);

                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                        res.end(xml);
                    }
                    else
                    {
                        cacheData = cacheInfo;

                        if(appType && appType === 'HTTAPI')
                        {
                            extDialplanEngine.ProcessExtendedDialplan(reqId, callerIdNum, destNum, callerContext, 'OUT', data, null, contextCompany, contextTenant, securityToken, null, 'inbound', ctxt, cacheData, bUnit, isDialerIVR, function(err, extDialplan)
                            {
                                if(err)
                                {
                                    logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Error occurred processing extended dialplan for out call', reqId, err);

                                    var xml = xmlGen.createRejectResponse(callerContext);

                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);
                                    res.end(xml);
                                }
                                else
                                {
                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, extDialplan);

                                    if(!isDialPlanGiven)
                                    {
                                        var setName = 'CHANNELS:' + contextTenant + ':' + contextCompany;

                                        redisHandler.AddChannelIdToSet(varUuid, setName, function(err, redisRes){});

                                        redisHandler.SetObject('CHANNELMAP:' + varUuid, setName, function(err, redisRes){
                                            redisHandler.ExpireKey('CHANNELMAP:' + varUuid, 86400);
                                        });


                                    }

                                    res.end(extDialplan);

                                }


                            })
                        }
                        else
                        {
                            backendFactory.getBackendHandler().GetTransferCodesForTenantDB(reqId, contextCompany, contextTenant, data, function(err, resTrans)
                            {
                                if(resTrans)
                                {
                                    if(fromUsr)
                                    {
                                        fromUsr.TransferCode = resTrans;
                                    }

                                }

                                logger.debug('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Trying to pick inbound rule - Params - aniNum : %s, destNum : %s, domain : %s, companyId : %s, tenantId : %s', reqId, callerIdNum, destNum, domain, contextCompany, contextTenant);
                                backendFactory.getRuleHandler().PickCallRuleInbound(reqId, callerIdNum, destNum, '', domain, tempCallerContext, 'CALL', contextCompany, contextTenant, cacheData, function(err, rule)
                                {
                                    if(err)
                                    {
                                        logger.error('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - PickCallRuleInbound returned exception', reqId, err);
                                        var xml = xmlGen.createRejectResponse(callerContext);

                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                        res.end(xml);
                                    }
                                    else if(rule)
                                    {
                                        var tempAni = data["Caller-Caller-ID-Number"];
                                        if(rule.ANITranslation)
                                        {
                                            tempAni = translationHandler.TranslateHandler(rule.ANITranslation, data["Caller-Caller-ID-Number"]);
                                            data["Caller-Caller-ID-Number"] = tempAni;
                                        }
                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - PickCallRuleInbound returned rule : %s', reqId, JSON.stringify(rule));

                                        backendFactory.getBackendHandler().GetEmergencyNumber(destNum, rule.CompanyId, rule.TenantId, cacheData, function(err, emNum)
                                        {
                                            if(emNum)
                                            {
                                                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Emergency number detected - Trying to pick outbound rule', reqId, xml);
                                                //pick outbound rule and route to gateway
                                                ruleBackendHandler.PickCallRuleOutboundComplete(reqId, callerIdNum, destNum, '', callerContext, rule.CompanyId, rule.TenantId, true, cacheData, function (err, rule)
                                                {
                                                    if (!err && rule)
                                                    {
                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Outbound rule found for emergency number', reqId);
                                                        var ep =
                                                        {
                                                            Profile: rule.GatewayCode,
                                                            Type: 'GATEWAY',
                                                            LegStartDelay: 0,
                                                            BypassMedia: false,
                                                            LegTimeout: 60,
                                                            Destination: rule.DNIS,
                                                            Domain: rule.IpUrl,
                                                            Action: 'DEFAULT',
                                                            RecordEnabled: fromUsr.RecordingEnabled,
                                                            Operator: rule.Operator,
                                                            OutLimit: rule.OutLimit,
                                                            BothLimit: rule.BothLimit,
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
                                                        externalApi.CheckBalance(reqId, varUuid, ep.Origination, ep.Destination, 'minute', ep.Operator, rule.CompanyId, rule.TenantId)
                                                            .then(function(balanceRes)
                                                            {
                                                                if (balanceRes && balanceRes.IsSuccess)
                                                                {
                                                                    var xml = xmlBuilder.CreateRouteGatewayDialplan(reqId, ep, callerContext, profile, '[^\\s]*', false, null, 'outbound', rule.Codecs, null, bUnit);

                                                                    RedisOperations(varUuid, rule.CompanyId, rule.TenantId, null, 'EMERGENCY', isDialPlanGiven, 'outbound', eventTime, bUnit);

                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                    res.end(xml);


                                                                }
                                                                else
                                                                {
                                                                    var xml = xmlGen.createRejectResponse(callerContext);

                                                                    logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, new Error('insufficient balance'));

                                                                    res.end(xml);
                                                                }

                                                            })
                                                            .catch(function(err)
                                                            {
                                                                var xml = xmlGen.createRejectResponse(callerContext);

                                                                logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, err);

                                                                res.end(xml);
                                                            });


                                                    }
                                                    else
                                                    {
                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Outbound rule not found for Emergency Number', reqId);
                                                        var xml = xmlGen.createRejectResponse(callerContext);

                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                        res.end(xml);
                                                    }
                                                })
                                            }
                                            else
                                            {
                                                //do normal op
                                                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Checking for inbound rule app for outgoing call', reqId);
                                                if(rule.Application && rule.Application.Availability)
                                                {
                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Call rule has an application - out call', reqId);
                                                    var app = rule.Application;

                                                    var masterUrl = '';
                                                    if(app.MasterApplication && app.MasterApplication.Availability && app.MasterApplication.Url)
                                                    {
                                                        var masterApp = app.MasterApplication;

                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Master application found for out call', reqId);

                                                        if(masterApp.ObjType === "HTTAPI")
                                                        {
                                                            logger.info('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Master App Type is HTTAPI', reqId);
                                                            //add to redis
                                                            masterUrl = masterApp.Url;
                                                            var sessionData =
                                                            {
                                                                path: app.Url,
                                                                company: rule.CompanyId,
                                                                tenant: rule.TenantId,
                                                                app: app.AppName,
                                                                appid: app.id
                                                            };

                                                            var jsonString = JSON.stringify(sessionData);

                                                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Session Data Object created for HTTAPI : %s', reqId, jsonString);

                                                            redisHandler.SetObject(varUuid + "_data", jsonString, function(err, result)
                                                            {
                                                                if(err)
                                                                {
                                                                    logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Exception in setting sessionData on backend - Key : %s_data', reqId, varUuid, err);
                                                                    var xml = xmlGen.createRejectResponse(callerContext);

                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                    res.end(xml);
                                                                }
                                                                else
                                                                {
                                                                    redisHandler.ExpireKey(varUuid + "_data", 86400);
                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Session data added to redis successfully - Key : %s_data', reqId, varUuid);

                                                                    var xml = xmlGen.CreateHttpApiDialplan('[^\\s]*', callerContext, masterUrl, reqId, null, app.id, rule.CompanyId, rule.TenantId, 'outbound', tempAni, rule.BusinessUnit);

                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                    RedisOperations(varUuid, rule.CompanyId, rule.TenantId, rule.Application.id, app.ObjType, isDialPlanGiven, 'outbound', eventTime, rule.BusinessUnit);
                                                                    res.end(xml);
                                                                }

                                                            });

                                                        }
                                                        else if(masterApp.ObjType === "SOCKET")
                                                        {
                                                            logger.info('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Master App Type is SOCKET', reqId);

                                                            var sessionData =
                                                            {
                                                                path: app.Url,
                                                                company: rule.CompanyId,
                                                                tenant: rule.TenantId,
                                                                app: app.AppName,
                                                                appid: app.id
                                                            };

                                                            var jsonString = JSON.stringify(sessionData);

                                                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Session Data Object created for SOCKET : %s', reqId, jsonString);

                                                            redisHandler.SetObject(varUuid + "_data", jsonString, function(err, result)
                                                            {
                                                                if(err)
                                                                {
                                                                    logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Exception in setting sessionData on backend - Key : : %s_data', reqId, varUuid, err);
                                                                    var xml = xmlGen.createRejectResponse(callerContext);

                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                    res.end(xml);
                                                                }
                                                                else
                                                                {
                                                                    redisHandler.ExpireKey(varUuid + "_data", 86400);
                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Session data added to redis successfully - Key : : %s_data', reqId, varUuid);

                                                                    var xml = xmlGen.CreateSocketApiDialplan('[^\\s]*', callerContext, masterUrl, reqId, null, app.id, rule.CompanyId, rule.TenantId, 'outbound', rule.BusinessUnit);

                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                    RedisOperations(varUuid, rule.CompanyId, rule.TenantId, rule.Application.id, app.ObjType, isDialPlanGiven, 'outbound', eventTime, rule.BusinessUnit);

                                                                    res.end(xml);
                                                                }

                                                            });
                                                        }
                                                        else if(masterApp.ObjType === 'EXTENDED')
                                                        {
                                                            data.DVPAppUrl = masterApp.Url;
                                                            data.AppId = masterApp.id;
                                                            extDialplanEngine.ProcessExtendedDialplan(reqId, callerIdNum, destNum, callerContext, 'OUT', data, fromUsr, rule.CompanyId, rule.TenantId, securityToken, null, 'outbound', ctxt, cacheData, rule.BusinessUnit, isDialerIVR, function(err, extDialplan)
                                                            {
                                                                if(err)
                                                                {
                                                                    logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Error occurred processing extended dialplan for out call', reqId, err);

                                                                    var xml = xmlGen.createRejectResponse(callerContext);

                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);
                                                                    res.end(xml);
                                                                }
                                                                else
                                                                {
                                                                    RedisOperations(varUuid, rule.CompanyId, rule.TenantId, rule.Application.id, app.ObjType, isDialPlanGiven, 'outbound', eventTime, rule.BusinessUnit);

                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, extDialplan);
                                                                    res.end(extDialplan);
                                                                }


                                                            })
                                                        }
                                                        else
                                                        {
                                                            logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Master app object type invalid for out call', reqId);
                                                            var xml = xmlGen.createRejectResponse(callerContext);

                                                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                            res.end(xml);
                                                        }

                                                    }
                                                    else
                                                    {
                                                        if(app.ObjType === "HTTAPI")
                                                        {
                                                            logger.info('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Master App Type is HTTAPI', reqId);
                                                            //add to redis
                                                            var xml = xmlGen.CreateHttpApiDialplan('[^\\s]*', callerContext, app.Url, reqId, undefined, app.id, rule.CompanyId, rule.TenantId, 'outbound', tempAni, rule.BusinessUnit);

                                                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                            RedisOperations(varUuid, rule.CompanyId, rule.TenantId, rule.Application.id, app.ObjType, isDialPlanGiven, 'outbound', eventTime, rule.BusinessUnit);

                                                            res.end(xml);

                                                        }
                                                        else if(app.ObjType === "SOCKET")
                                                        {
                                                            logger.info('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Master App Type is SOCKET', reqId);

                                                            var xml = xmlGen.CreateSocketApiDialplan('[^\\s]*', callerContext, app.Url, reqId, null, app.id, rule.CompanyId, rule.TenantId, 'outbound', rule.BusinessUnit);

                                                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                            RedisOperations(varUuid, rule.CompanyId, rule.TenantId, rule.Application.id, app.ObjType, isDialPlanGiven, 'outbound', eventTime, rule.BusinessUnit);

                                                            res.end(xml);
                                                        }
                                                        else if(app.ObjType === 'EXTENDED')
                                                        {
                                                            data.DVPAppUrl = app.Url;
                                                            data.AppId = app.id;
                                                            extDialplanEngine.ProcessExtendedDialplan(reqId, callerIdNum, destNum, callerContext, 'OUT', data, fromUsr, rule.CompanyId, rule.TenantId, securityToken, null, 'outbound', ctxt, cacheData, rule.BusinessUnit, isDialerIVR, function(err, extDialplan)
                                                            {
                                                                if(err)
                                                                {
                                                                    logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Extended dialplan Error', reqId, err);

                                                                    var xml = xmlGen.createRejectResponse(callerContext);

                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);
                                                                    res.end(xml);
                                                                }
                                                                else
                                                                {
                                                                    RedisOperations(varUuid, rule.CompanyId, rule.TenantId, rule.Application.id, app.ObjType, isDialPlanGiven, 'outbound', eventTime, rule.BusinessUnit);
                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, extDialplan);
                                                                    res.end(extDialplan);
                                                                }


                                                            })
                                                        }
                                                        else
                                                        {
                                                            logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Master App Type Undefined - Terminating', reqId);
                                                            var xml = xmlGen.createRejectResponse(callerContext);

                                                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                            res.end(xml);
                                                        }
                                                    }


                                                    var evtData =
                                                    {
                                                        SessionId: varUuid,
                                                        EventClass: "CALL",
                                                        EventType : "CALL_RULE",
                                                        EventCategory: "INBOUND_RULE",
                                                        EventTime : new Date(),
                                                        EventName : "Call Rule Picked",
                                                        EventData : destNum,
                                                        EventParams : rule
                                                    };

                                                    var jsonStr = JSON.stringify(evtData);
                                                    redisHandler.PublishToRedis('DVPEVENTS', jsonStr, function(err, redisResult){});


                                                }
                                                else
                                                {
                                                    logger.warn('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Call rule has no application, terminating outbound call operation', reqId);
                                                    var xml = xmlGen.createRejectResponse(callerContext);

                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                    res.end(xml);
                                                }

                                            }
                                        })


                                    }
                                    else
                                    {
                                        logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Call rule not found', reqId);
                                        var xml = xmlGen.createRejectResponse(callerContext);

                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                        res.end(xml);
                                    }
                                })



                            });


                        }
                    }

                })
            }
            else
            {
                logger.error("DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Company not set", reqId, new Error('Company Not Set'));
                var xml = xmlGen.createRejectResponse(callerContext);

                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                res.end(xml);
            }




        })
    }
    catch(ex)
    {
        var xml = xmlGen.createRejectResponse(callerContext);

        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

        res.end(xml);
    }

};

/*var LimitValidator = function(num, compLimits)
{
    if((num.LimitInfoInbound && num.LimitInfoInbound.Enable && typeof num.LimitInfoInbound.MaxCount != 'undefined') || (num.LimitInfoBoth && num.LimitInfoBoth.Enable && typeof num.LimitInfoBoth.MaxCount != 'undefined')
        || (compLimits.InboundLimit && compLimits.InboundLimit.Enable && typeof compLimits.InboundLimit.MaxCount != 'undefined') || (compLimits.BothLimit && compLimits.BothLimit.Enable && typeof compLimits.BothLimit.MaxCount != 'undefined'))
    {
        var bothLim = null;
        var inbLim = null;
        var inbCompLim = null;
        var bothCompLim = null;

        if(num.LimitInfoInbound)
        {
            inbLim = num.LimitInfoInbound.MaxCount;
        }

        if(num.LimitInfoBoth)
        {
            bothLim = num.LimitInfoBoth.MaxCount;
        }

        if(compLimits.InboundLimit)
        {
            inbCompLim = compLimits.InboundLimit.MaxCount;
        }

        if(compLimits.BothLimit)
        {
            bothCompLim = compLimits.BothLimit.MaxCount;
        }

        var NumLimitInfo =
        {
            CallType : num.ObjType,
            NumType : num.ObjCategory,
            TrunkNumber : num.PhoneNumber,
            InboundLimit : inbLim,
            BothLimit : bothLim,
            CompInboundLimit: inbCompLim,
            CompBothLimit: bothCompLim,
            CompanyId : num.CompanyId,
            TenantId : num.TenantId,
            CheckLimit : true
        };

        return NumLimitInfo;

    }
    else
    {
        return null;
    }

}*/

server.post('/DVP/API/:version/DynamicConfigGenerator/Factory/:factory', function(req,res,next)
{

    try
    {
        var factory = req.params.factory;

        if(factory === 'CACHE' || factory === 'DB')
        {
            backendFactory.changeBackendHandler(factory);

            res.end('SUCCESS');
        }
        else
        {
            res.end('FAIL');
        }


    }
    catch(ex)
    {
        res.end('FAIL');
    }

    return next();

});

server.post('/DVP/API/:version/DynamicConfigGenerator/CallApp', function(req,res,next)
{

    var reqId = nodeUuid.v1();

    try
    {
        logger.debug('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - HTTP FS DIALPLAN Request Received ------------------------->>>', reqId);

        logger.debug('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Request Body : %s', reqId, req.body);

        var data = fsMediaFormatter.convertUrlEncoded(req.body);

        var hostname = data["hostname"];
        var cdnum = data["Caller-Destination-Number"];
        var callerContext = data["Caller-Context"];
        var huntDestNum = data["Hunt-Destination-Number"];
        var huntContext = data["Hunt-Context"];
        var varDomain = data["variable_domain"];
        var varUserId = data["Caller-ANI"];
        var profile = data["variable_sofia_profile_name"];
        var varUuid = data["variable_uuid"];//check whether to get uuid or var uuid
        var varSipFromUri = data["variable_sip_from_uri"];
        var varSipToUri = data["variable_sip_to_uri"];
        var varUsrContext = data["variable_user_context"];
        var varFromNumber = data["variable_FromNumber"];
        var callerIdNum = data["Caller-Caller-ID-Number"];
        var varSipFromHost = data["variable_sip_from_host"];
        var dvpOriginationType = data["variable_sip_h_X-DVP-ORIGINATION-TYPE"];
        var dvpDestinationType = data["variable_sip_h_X-DVP-DESTINATION-TYPE"];
        var appType = data["variable_dvp_app_type"];
        var opCat = data["variable_DVP_OPERATION_CAT"];
        var actionCat = data["variable_DVP_ACTION_CAT"];
        var isDialplanGiven = data["variable_companyid"];
        var ardsClientUuid = data['variable_ards_client_uuid'];
        var transferCallerName = data['variable_user_id'];
        var preTransCaller = data['variable_origination_caller_id_number'];
        var eventTime = data['Event-Date-Timestamp'];
        var businessUnit = data['variable_business_unit'];
        var transAgentSkill = decodeURIComponent(data['variable_ards_skill_display']);


        if(!ardsClientUuid && data['variable_my_uuid']){
            ardsClientUuid = data['variable_my_uuid'];
        }

        if(data['variable_dvp_trans_orig_caller'])
        {
            preTransCaller = data['variable_dvp_trans_orig_caller'];
        }

        var isDialerIVR = false;

        if(actionCat === 'DIALER')
        {
            isDialerIVR = true;
        }



        var csId = parseInt(hostname);

        if (csId && cdnum && callerContext && hostname)
        {
            //Dialplan

            var ardsFeaturesPattern = new RegExp('^(ARDSFeatures)[^\s]*');

            var pabxFeaturesPattern = new RegExp('^(PBXFeatures)[^\s]*');

            huntDestNum = decodeURIComponent(huntDestNum);

            huntContext = decodeURIComponent(huntContext);

            cdnum = decodeURIComponent(cdnum);

            var destNum = (huntDestNum) ? huntDestNum:cdnum;

            if(!destNum || destNum === '' || destNum === 'undefined')
            {
                var xml = xmlGen.createRejectResponse(callerContext);

                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                res.end(xml);
            }
            else
            {
                if ((ardsFeaturesPattern.test(huntContext) || huntContext == 'PBXFeatures') && huntDestNum == 'att_xfer')
                {
                    logger.debug('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Attendant Transfer User ------------', reqId);

                    var tempHuntCtxt = decodeURIComponent(huntContext);

                    var xml = xmlBuilder.CreateAttendantTransferUser(reqId, huntDestNum, tempHuntCtxt);
                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);
                    res.end(xml);

                    /*backendFactory.getBackendHandler().GetContext(varUsrContext, function(err, ctxt)
                     {
                     if(ctxt)
                     {
                     backendFactory.getBackendHandler().GetCacheObject(ctxt.TenantId, ctxt.CompanyId, function(err, cacheInfo)
                     {
                     var tempHuntCtxt = decodeURIComponent(huntContext);

                     var xml = xmlBuilder.CreateAttendantTransferUser(reqId, huntDestNum, tempHuntCtxt);
                     logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);
                     res.end(xml);

                     /!*if(err)
                     {
                     var xml = xmlBuilder.CreatePbxFeatures(reqId, huntDestNum, 'user', varDomain, null, null, ctxt.CompanyId, ctxt.TenantId, null, huntContext, null, ardsClientUuid);

                     logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                     res.end(xml);
                     }
                     else
                     {
                     /!*backendFactory.getBackendHandler().GetTransferCodesForTenantDB(reqId, ctxt.CompanyId, ctxt.TenantId, cacheInfo, function(err, transCodes)
                     {
                     var xml = xmlBuilder.CreatePbxFeatures(reqId, huntDestNum, 'user', varDomain, null, null, ctxt.CompanyId, ctxt.TenantId, null, huntContext, transCodes, ardsClientUuid);

                     logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                     res.end(xml);

                     })*!/

                     }*!/

                     });

                     }
                     else
                     {
                     var xml = xmlBuilder.CreatePbxFeatures(reqId, huntDestNum, 'user', varDomain, null, null, null, null, null, huntContext, null, ardsClientUuid);

                     logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                     res.end(xml);

                     }

                     });*/

                }
                else if (huntContext == 'PBXFeatures' && huntDestNum == 'att_xfer_ivr')
                {
                    logger.debug('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Attendant Transfer IVR ------------', reqId);

                    backendFactory.getBackendHandler().GetContext(varUsrContext, function(err, ctxt)
                    {
                        if(ctxt)
                        {
                            var xml = xmlBuilder.CreatePbxFeatures(reqId, huntDestNum, 'ivr', varDomain, null, null, ctxt.CompanyId, ctxt.TenantId, null, huntContext, null, ardsClientUuid);

                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                            res.end(xml);

                        }
                        else
                        {
                            var xml = xmlBuilder.CreatePbxFeatures(reqId, huntDestNum, 'ivr', varDomain, null, null, null, null, null, huntContext, null, ardsClientUuid);

                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                            res.end(xml);

                        }

                    });

                }
                else if (ardsFeaturesPattern.test(huntContext) && huntDestNum == 'att_xfer_ivr')
                {
                    logger.debug('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - ARDS Attendant Transfer User ------------', reqId);

                    var tempHuntCtxt = decodeURIComponent(huntContext);

                    var huntCtxtSplit = tempHuntCtxt.split('|');

                    if(huntCtxtSplit.length === 3)
                    {
                        var xml = xmlBuilder.CreatePbxFeatures(reqId, huntDestNum, 'ivr', varDomain, null, null, huntCtxtSplit[2], huntCtxtSplit[1], null, tempHuntCtxt, null, ardsClientUuid);

                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                        res.end(xml);


                    }
                    else
                    {
                        var xml = xmlGen.createRejectResponse(callerContext);

                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                        res.end(xml);
                    }


                }
                /*else if (ardsFeaturesPattern.test(huntContext) && huntDestNum == 'att_xfer')
                 {
                 logger.debug('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - ARDS Attendant Transfer User ------------', reqId);

                 var tempHuntCtxt = decodeURIComponent(huntContext);

                 var huntCtxtSplit = tempHuntCtxt.split('|');

                 if(huntCtxtSplit.length === 3)
                 {
                 backendFactory.getBackendHandler().GetCacheObject(huntCtxtSplit[1], huntCtxtSplit[2], function(err, cacheInfo)
                 {
                 if(err)
                 {
                 var xml = xmlBuilder.CreatePbxFeatures(reqId, huntDestNum, 'user', varDomain, null, null, huntCtxtSplit[2], huntCtxtSplit[1], null, tempHuntCtxt, null, ardsClientUuid);

                 logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                 res.end(xml);
                 }
                 else
                 {
                 backendFactory.getBackendHandler().GetTransferCodesForTenantDB(reqId, huntCtxtSplit[2], huntCtxtSplit[1], cacheInfo, function(err, transCodes)
                 {
                 var xml = xmlBuilder.CreatePbxFeatures(reqId, huntDestNum, 'user', varDomain, null, null, huntCtxtSplit[2], huntCtxtSplit[1], null, tempHuntCtxt, transCodes, ardsClientUuid);

                 logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                 res.end(xml);

                 })
                 }

                 });


                 }
                 else
                 {
                 var xml = xmlGen.createRejectResponse(callerContext);

                 logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                 res.end(xml);
                 }


                 }*/
                else if ((ardsFeaturesPattern.test(huntContext) || huntContext == 'PBXFeatures') && huntDestNum == 'att_xfer_outbound')
                {
                    logger.debug('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Attendant Transfer Gateway ------------', reqId);

                    logger.debug('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Trying to get context : %s', reqId, varUsrContext);

                    var tempHuntCtxt = decodeURIComponent(huntContext);

                    backendFactory.getBackendHandler().GetContext(varUsrContext, function(err, ctxt)
                    {
                        if(ctxt)
                        {
                            backendFactory.getBackendHandler().GetCacheObject(ctxt.TenantId, ctxt.CompanyId, function(err, cacheInfo)
                            {
                                if(err)
                                {
                                    var xml = xmlGen.createRejectResponse(tempHuntCtxt);

                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                    res.end(xml);
                                }
                                else
                                {
                                    var xml = xmlBuilder.CreateAttendantTransferGW(reqId, huntDestNum, tempHuntCtxt);
                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);
                                    res.end(xml);
                                }

                            });

                        }
                        else
                        {
                            logger.error('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Context not found', reqId, err);
                            var xml = xmlGen.createRejectResponse(tempHuntCtxt);

                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                            res.end(xml);
                        }

                    });

                }
                else if(huntDestNum === 'usertransfer')
                {
                    logger.debug('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - ARDS Attendant Transfer User ------------', reqId);

                    if(data['variable_DVP_CALL_DIRECTION'] === 'outbound')
                    {
                        if(!data['variable_dvp_trans_orig_caller'] && (data['variable_DVP_OPERATION_CAT'] === 'GATEWAY' || data['variable_DVP_OPERATION_CAT'] === 'ATT_XFER_USER'))
                        {
                            preTransCaller = data['Other-Leg-Destination-Number'];
                        }

                    }

                    destNum = data["variable_digits"];

                    destNum = decodeURIComponent(destNum);

                    if(ardsFeaturesPattern.test(huntContext))
                    {
                        var tempHuntCtxt = decodeURIComponent(huntContext);

                        var huntCtxtSplit = tempHuntCtxt.split('|');

                        if(huntCtxtSplit.length === 3)
                        {
                            backendFactory.getBackendHandler().GetCacheObject(huntCtxtSplit[1], huntCtxtSplit[2], function(err, cacheInfo)
                            {
                                if(err)
                                {
                                    var xml = xmlBuilder.createTransferRejectResponse(tempHuntCtxt, transferCallerName, huntCtxtSplit[2], huntCtxtSplit[1], destNum);

                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                    res.end(xml);
                                }
                                else
                                {
                                    backendFactory.getBackendHandler().GetTransferCodesForTenantDB(reqId, huntCtxtSplit[2], huntCtxtSplit[1], cacheInfo, function(err, transCodes)
                                    {
                                        backendFactory.getBackendHandler().GetAllDataForExt(reqId, destNum, huntCtxtSplit[2], huntCtxtSplit[1], 'USER', null, null, function(err, ext)
                                        {
                                            if(ext && ext.SipUACEndpoint && ext.SipUACEndpoint.CloudEndUser && ext.SipUACEndpoint.CloudEndUser.Domain)
                                            {
                                                backendFactory.getBackendHandler().getContextPreferences(varUsrContext, ext.SipUACEndpoint.ContextId, huntCtxtSplit[2], huntCtxtSplit[1]).then(function(codecPrefs)
                                                {
                                                    var tempCodecPref = null;
                                                    if(codecPrefs)
                                                    {
                                                        tempCodecPref = codecPrefs.Codecs;
                                                    }
                                                    var xml = xmlBuilder.CreatePbxFeaturesUser(reqId, huntDestNum, 'user', ext.SipUACEndpoint.CloudEndUser.Domain, huntCtxtSplit[2], huntCtxtSplit[1], null, tempHuntCtxt, transCodes, ardsClientUuid, destNum, tempCodecPref, transferCallerName, ext.SipUACEndpoint.SipUsername, preTransCaller, businessUnit, transAgentSkill);

                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                    res.end(xml);

                                                }).catch(function(err)
                                                {
                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - error getting codec preferences', reqId);
                                                    res.end(xmlBuilder.createTransferRejectResponse(tempHuntCtxt, transferCallerName, huntCtxtSplit[2], huntCtxtSplit[1], ext.SipUACEndpoint.SipUsername));
                                                });
                                            }
                                            else
                                            {
                                                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - User not not found', reqId);
                                                res.end(xmlBuilder.createTransferRejectResponse(tempHuntCtxt, transferCallerName, huntCtxtSplit[2], huntCtxtSplit[1], destNum));
                                            }

                                        })


                                    })
                                }

                            });


                        }
                        else
                        {
                            var xml = xmlBuilder.createTransferRejectResponse(tempHuntCtxt, transferCallerName, huntCtxtSplit[2], huntCtxtSplit[1], destNum);

                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                            res.end(xml);
                        }
                    }
                    else
                    {
                        var tempHuntCtxt = decodeURIComponent(huntContext);


                        backendFactory.getBackendHandler().GetContext(varUsrContext, function (err, ctxt)
                        {
                            if (ctxt)
                            {
                                backendFactory.getBackendHandler().GetCacheObject(ctxt.TenantId, ctxt.CompanyId, function (err, cacheInfo)
                                {

                                    if (err)
                                    {
                                        var xml = xmlBuilder.createTransferRejectResponse(tempHuntCtxt, transferCallerName, ctxt.CompanyId, ctxt.TenantId, destNum);

                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                        res.end(xml);
                                    }
                                    else
                                    {
                                        backendFactory.getBackendHandler().GetTransferCodesForTenantDB(reqId, ctxt.CompanyId, ctxt.TenantId, cacheInfo, function (err, transCodes)
                                        {
                                            backendFactory.getBackendHandler().GetAllDataForExt(reqId, destNum, ctxt.CompanyId, ctxt.TenantId, 'USER', null, null, function(err, ext)
                                            {
                                                if(ext && ext.SipUACEndpoint && ext.SipUACEndpoint.CloudEndUser && ext.SipUACEndpoint.CloudEndUser.Domain)
                                                {
                                                    backendFactory.getBackendHandler().getContextPreferences(varUsrContext, ext.SipUACEndpoint.ContextId, ctxt.CompanyId, ctxt.TenantId).then(function(codecPrefs)
                                                    {
                                                        var tempCodecPref = null;
                                                        if(codecPrefs)
                                                        {
                                                            tempCodecPref = codecPrefs.Codecs;
                                                        }
                                                        var xml = xmlBuilder.CreatePbxFeaturesUser(reqId, huntDestNum, 'user', ext.SipUACEndpoint.CloudEndUser.Domain, ctxt.CompanyId, ctxt.TenantId, null, tempHuntCtxt, transCodes, ardsClientUuid, destNum, tempCodecPref, transferCallerName, ext.SipUACEndpoint.SipUsername, preTransCaller, businessUnit, transAgentSkill);

                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                        res.end(xml);

                                                    }).catch(function(err)
                                                    {
                                                        var xml = xmlBuilder.createTransferRejectResponse(tempHuntCtxt, transferCallerName, ctxt.CompanyId, ctxt.TenantId, ext.SipUACEndpoint.SipUsername);

                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                        res.end(xml);
                                                    });
                                                }
                                                else
                                                {
                                                    var xml = xmlBuilder.createTransferRejectResponse(tempHuntCtxt, transferCallerName, ctxt.CompanyId, ctxt.TenantId, destNum);

                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                    res.end(xml);
                                                }

                                            })


                                        })

                                    }

                                });

                            }
                            else
                            {
                                var xml = xmlBuilder.createTransferRejectResponse(tempHuntCtxt, transferCallerName, null, null, destNum);

                                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                res.end(xml);

                            }

                        });
                    }



                }
                else if(huntDestNum === 'gwtransfer')
                {
                    destNum = data["variable_digits"];
                    var transferer = data["variable_dialed_user"];

                    destNum = decodeURIComponent(destNum);

                    logger.debug('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Attendant Transfer Gateway ------------', reqId);

                    logger.debug('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Trying to get context : %s', reqId, varUsrContext);

                    backendFactory.getBackendHandler().GetContext(varUsrContext, function(err, ctxt)
                    {
                        if(ctxt)
                        {
                            backendFactory.getBackendHandler().GetCacheObject(ctxt.TenantId, ctxt.CompanyId, function(err, cacheInfo)
                            {
                                if(err)
                                {
                                    var xml = xmlBuilder.createTransferRejectResponse(huntContext, transferCallerName, ctxt.CompanyId, ctxt.TenantId, destNum);

                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                    res.end(xml);
                                }
                                else
                                {
                                    backendFactory.getBackendHandler().GatherFromUserDetails(reqId, transferer, ctxt.CompanyId, ctxt.TenantId, false, null, function(err, frmUser)
                                    {
                                        var tempDodNumber = null;

                                        if(frmUser && frmUser.Extension && frmUser.Extension.DodActive && frmUser.Extension.DodNumber)
                                        {
                                            tempDodNumber = frmUser.Extension.DodNumber;
                                        }

                                        backendFactory.getRuleHandler().PickCallRuleOutboundComplete(reqId, transferer, destNum, '', varUsrContext, ctxt.CompanyId, ctxt.TenantId, true, cacheInfo, tempDodNumber, function (err, outRule)
                                        {
                                            if(outRule)
                                            {
                                                extApi.CheckBalance(reqId, varUuid, outRule.ANI, outRule.DNIS, 'minute', outRule.Operator, ctxt.CompanyId, ctxt.TenantId)
                                                    .then(function(balanceRes)
                                                    {
                                                        if (balanceRes && balanceRes.IsSuccess)
                                                        {
                                                            //Validate limits

                                                            backendFactory.getBackendHandler().GetCompanyLimits(ctxt.CompanyId, ctxt.TenantId).then(function(compLimits)
                                                            {
                                                                var limits = {
                                                                    NumberOutboundLimit: outRule.OutLimit,
                                                                    NumberBothLimit: outRule.BothLimit
                                                                };

                                                                if(compLimits)
                                                                {
                                                                    limits.CompanyOutboundLimit = compLimits.OutboundLimit;
                                                                    limits.CompanyBothLimit = compLimits.BothLimit;
                                                                }

                                                                var NumLimitInfo = LimitValidator(limits, outRule.TrunkNumber, 'outbound');

                                                                if(NumLimitInfo)
                                                                {
                                                                    //Get Caller Information to Set DOD Number

                                                                    var xml = xmlBuilder.CreatePbxFeaturesGateway(reqId, huntDestNum, outRule.ANI, outRule.GatewayCode, ctxt.CompanyId, ctxt.TenantId, null, huntContext, ardsClientUuid,outRule.DNIS, outRule.Operator, outRule.IpUrl, NumLimitInfo, outRule.Codecs, transferCallerName, outRule.BusinessUnit);

                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                    res.end(xml);

                                                                }
                                                                else
                                                                {
                                                                    var xml = xmlBuilder.createTransferRejectResponse(huntContext, transferCallerName, ctxt.CompanyId, ctxt.TenantId, destNum);

                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                    res.end(xml);
                                                                }



                                                            }).catch(function(err)
                                                            {
                                                                var xml = xmlBuilder.createTransferRejectResponse(huntContext, transferCallerName, ctxt.CompanyId, ctxt.TenantId, destNum);

                                                                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                res.end(xml);

                                                            });


                                                        }
                                                        else
                                                        {
                                                            logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Insufficient balance', reqId);

                                                            var xml = xmlBuilder.createTransferRejectResponse(huntContext, transferCallerName, ctxt.CompanyId, ctxt.TenantId, destNum);

                                                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                            res.end(xml);
                                                        }

                                                    })
                                                    .catch(function(err)
                                                    {
                                                        logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Insufficient balance', reqId, err);

                                                        var xml = xmlBuilder.createTransferRejectResponse(huntContext, transferCallerName, ctxt.CompanyId, ctxt.TenantId, destNum);

                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                        res.end(xml);
                                                    });


                                            }
                                            else
                                            {
                                                logger.error('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Outbound Rule Not Found', reqId, err);
                                                var xml = xmlBuilder.createTransferRejectResponse(huntContext, transferCallerName, ctxt.CompanyId, ctxt.TenantId, destNum);

                                                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                res.end(xml);
                                            }

                                        });

                                    });


                                }

                            });

                        }
                        else
                        {
                            logger.error('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Context not found', reqId, err);
                            var xml = xmlBuilder.createTransferRejectResponse(huntContext, transferCallerName, null, null, destNum);

                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                            res.end(xml);
                        }

                    });
                }
                else if(pabxFeaturesPattern.test(huntContext) || ardsFeaturesPattern.test(huntContext))
                {
                    var tempDirection = data['variable_DVP_CALL_DIRECTION'];

                    if(!tempDirection)
                    {
                        tempDirection = 'outbound';
                    }

                    var tempHuntCtxt = decodeURIComponent(huntContext);

                    data['IsIVRTransfer'] = true;

                    var huntCtxtSplit = tempHuntCtxt.split('|');

                    if(huntCtxtSplit.length === 3)
                    {
                        extDialplanEngine.ProcessExtendedDialplan(reqId, callerIdNum, destNum, tempHuntCtxt, 'OUT', data, null, huntCtxtSplit[2], huntCtxtSplit[1], null, null, tempDirection, null, null, null, isDialerIVR, function(err, extDialplan)
                        {
                            if(err)
                            {
                                logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Extended dialplan Error', reqId, err);

                                var xml = xmlGen.createRejectResponse(tempHuntCtxt);

                                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);
                                res.end(xml);
                            }
                            else
                            {
                                //No need to do redis op

                                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, extDialplan);
                                res.end(extDialplan);
                            }

                        })


                    }
                    else
                    {
                        var xml = xmlGen.createRejectResponse(callerContext);

                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                        res.end(xml);
                    }




                }
                else
                {
                    logger.debug('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Trying to get context : %s', reqId, callerContext);

                    var cacheData = null;

                    backendFactory.getBackendHandler().GetContext(callerContext, function(err, ctxt)
                    {
                        if(err)
                        {
                            logger.error('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Error occurred getting context', reqId, err);
                            var xml = xmlGen.createRejectResponse(callerContext);

                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                            res.end(xml);
                        }
                        else //Same dialplan for all - only use context to find direction
                        {
                            var direction = 'IN';
                            var contextCompany = undefined;
                            var contextTenant = undefined;


                            if(ctxt && ctxt.ContextCat && ctxt.ContextCat.toUpperCase() === "INTERNAL")
                            {

                                direction = 'OUT';
                                contextCompany = ctxt.CompanyId;
                                contextTenant = ctxt.TenantId;

                                logger.info('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - context found category INTERNAL', reqId);
                            }
                            else
                            {
                                logger.info('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - context found category PUBLIC', reqId);

                                if(dvpOriginationType && dvpOriginationType === 'PUBLIC_USER')
                                {
                                    //Don't Check Phone number
                                    direction = 'OUT';
                                }
                            }

                            var decodedSipFromUri = decodeURIComponent(varSipFromUri);
                            var decodedSipToUri = decodeURIComponent(varSipToUri);

                            var fromSplitArr = decodedSipFromUri.split("@");

                            var toSplitArr = decodedSipToUri.split("@");

                            var aniNum = "";
                            var dnisNum = "";
                            var domain = "";

                            if(fromSplitArr.length == 2)
                            {
                                var domainS = fromSplitArr[1];

                                var domainAndPort = domainS.split(":");

                                if(domainAndPort.length == 2)
                                {
                                    domain = domainAndPort[0];
                                }

                                aniNum = fromSplitArr[0];

                            }

                            if(toSplitArr.length == 2)
                            {
                                dnisNum = toSplitArr[0];
                            }

                            if(actionCat === 'DIALER' && opCat === "AGENT")
                            {
                                //VALIDATE EXTENTION AND ROUTE TO AGENT
                                dialerOperations.AgentDial(reqId, callerContext, callerContext.RecordEnabled, dnisNum, data["variable_sip_to_uri"], contextCompany, contextTenant, csId, res);
                            }
                            else
                            {
                                //Find
                                var dnisRegExPattern = new RegExp('^(CF/)[^\s]*');
                                if(dnisRegExPattern.test(destNum))
                                {
                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Call Forwarding Lua Response Detected : %s', reqId, destNum);
                                    //Call Forwarding
                                    var dnisSplitArr = destNum.split('/');
                                    var fwdId = dnisSplitArr[1];
                                    var companyId = dnisSplitArr[2];
                                    var tenantId = dnisSplitArr[3];
                                    var disconReason = dnisSplitArr[4];
                                    var dodNumber = dnisSplitArr[5];
                                    var context = dnisSplitArr[6];
                                    var origination = dnisSplitArr[7];
                                    var origCallerIdNum = dnisSplitArr[8];

                                    if(!dodNumber)
                                    {
                                        dodNumber = '';
                                    }

                                    backendFactory.getBackendHandler().GetCacheObject(tenantId, companyId, function(err, cacheInfo)
                                    {
                                        if(err)
                                        {
                                            var xml = xmlGen.createRejectResponse(callerContext);

                                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                            res.end(xml);
                                        }
                                        else
                                        {
                                            cacheData = cacheInfo;
                                            extDialplanEngine.ProcessCallForwarding(reqId, callerIdNum, destNum, domain, context, direction, data, companyId, tenantId, disconReason, fwdId, dodNumber, '', origination, origCallerIdNum, csId, cacheData, function(err, xml)
                                            {
                                                if(err)
                                                {
                                                    logger.error('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Error occurred while processing call forwarding lua equest', reqId, err);
                                                    var xml = xmlGen.createRejectResponse(callerContext);

                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                    res.end(xml);
                                                }
                                                else
                                                {
                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);
                                                    res.end(xml);
                                                }
                                            })
                                        }

                                    });


                                }
                                else
                                {
                                    if(direction === 'IN')
                                    {
                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Call Direction IN', reqId);

                                        var varCompanyId = data["variable_companyid"];
                                        var varTenantId = data["variable_tenantid"];


                                        if(appType === 'HTTAPI' && varCompanyId && varTenantId)
                                        {
                                            HandleOutRequest(reqId, data, callerIdNum, varTenantId, appType, varCompanyId, dvpOriginationType, destNum, domain, callerContext, profile, varUuid, isDialplanGiven, ctxt, cacheData, eventTime, null, isDialerIVR, res);
                                        }
                                        else
                                        {
                                            logger.debug('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Validating trunk number for inbound call - TrunkNumber : %s', reqId, destNum);

                                            backendFactory.getBackendHandler().GetPhoneNumberDetails(destNum, function(err, num, cacheInfo)
                                            {
                                                cacheData = cacheInfo;
                                                if(err)
                                                {
                                                    logger.error('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Error occurred while validating incoming number', reqId, err);
                                                    var xml = xmlGen.createRejectResponse(callerContext);

                                                    res.end(xml);

                                                }
                                                else if(num)
                                                {
                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - TrunkNumber found', reqId);

                                                    backendFactory.getBackendHandler().ValidateBlacklistNumber(callerIdNum, num.CompanyId, num.TenantId, cacheData, function(err, blackListNum)
                                                    {

                                                        if(err || blackListNum)
                                                        {
                                                            logger.error('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Error occurred while validating black list number or number is in black list', reqId, err);
                                                            var xml = xmlGen.createRejectResponse(callerContext);

                                                            res.end(xml);
                                                        }
                                                        else
                                                        {
                                                            if(!num.Trunk || !num.Trunk.TrunkIpAddress)
                                                            {
                                                                logger.error('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] -  No trunk or ip addresses associated to number', reqId);
                                                                var xml = xmlGen.createRejectResponse(callerContext);

                                                                res.end(xml);
                                                            }
                                                            else
                                                            {
                                                                var isValidIp = ipValidator.ValidateRange(varSipFromHost, num.Trunk.TrunkIpAddress);

                                                                if(!isValidIp)
                                                                {
                                                                    logger.error('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Incoming IP validation failed', reqId);
                                                                    var xml = xmlGen.createRejectResponse(callerContext);

                                                                    res.end(xml);
                                                                }
                                                                else
                                                                {
                                                                    //Get company limits

                                                                    backendFactory.getBackendHandler().GetCompanyLimits(num.CompanyId, num.TenantId).then(function(compLimits)
                                                                    {
                                                                        var limits = {
                                                                            NumberInboundLimit: num.LimitInfoInbound,
                                                                            NumberBothLimit: num.LimitInfoBoth,
                                                                            CompanyInboundLimit: null,
                                                                            CompanyBothLimit: null
                                                                        };

                                                                        if(compLimits)
                                                                        {
                                                                            limits.CompanyInboundLimit = compLimits.InboundLimit;
                                                                            limits.CompanyBothLimit = compLimits.BothLimit;
                                                                        }

                                                                        var NumLimitInfo = LimitValidator(limits, num.PhoneNumber, 'inbound');

                                                                        if(NumLimitInfo)
                                                                        {
                                                                            var faxType = undefined;
                                                                            if(num.Trunk)
                                                                            {
                                                                                faxType = num.Trunk.FaxType;

                                                                                data['TrunkFaxType'] = faxType;
                                                                            }

                                                                            //Check number is a fax number - if true upload it to media gallery

                                                                            if(num.ObjCategory === 'FAX')
                                                                            {
                                                                                var xml = xmlBuilder.FaxReceiveUpload(reqId, callerContext, '[^\\s]*', NumLimitInfo, 'inbound', num.CompanyId, num.TenantId, num.PhoneNumber, null);
                                                                                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                                res.end(xml);
                                                                            }
                                                                            else
                                                                            {
                                                                                logger.debug('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Trying to pick inbound rule - Params - aniNum : %s, destNum : %s, domain : %s, companyId : %s, tenantId : %s', reqId, aniNum, destNum, domain, num.CompanyId, num.TenantId);

                                                                                backendFactory.getRuleHandler().PickCallRuleInbound(reqId, callerIdNum, destNum, '', domain, callerContext, 'CALL', num.CompanyId, num.TenantId, cacheData, function(err, rule)
                                                                                {
                                                                                    if(err)
                                                                                    {
                                                                                        logger.error('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - PickCallRuleInbound returned exception', reqId, err);
                                                                                        var xml = xmlGen.createRejectResponse(callerContext);

                                                                                        res.end(xml);
                                                                                    }
                                                                                    else if(rule)
                                                                                    {
                                                                                        var tempAni = data["Caller-Caller-ID-Number"];
                                                                                        if(rule.ANITranslation)
                                                                                        {
                                                                                            tempAni = translationHandler.TranslateHandler(rule.ANITranslation, data["Caller-Caller-ID-Number"]);
                                                                                            data["Caller-Caller-ID-Number"] = tempAni;
                                                                                        }

                                                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - PickCallRuleInbound returned rule : %s', reqId, JSON.stringify(rule));

                                                                                        //check dnis is a emergency number

                                                                                        if(rule.Application && rule.Application.Availability)
                                                                                        {
                                                                                            var app = rule.Application;

                                                                                            logger.info('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Call rule has a app', reqId);

                                                                                            if(rule.Application.MasterApplication && rule.Application.MasterApplication.Availability && rule.Application.MasterApplication.Url)
                                                                                            {
                                                                                                var masterUrl = '';
                                                                                                var masterApp = rule.Application.MasterApplication;

                                                                                                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Master application found : ', reqId, JSON.stringify(masterApp));

                                                                                                if(masterApp.ObjType === "HTTAPI")
                                                                                                {
                                                                                                    logger.info('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Master App Type is HTTAPI', reqId);
                                                                                                    //add to redis
                                                                                                    masterUrl = masterApp.Url;
                                                                                                    var sessionData =
                                                                                                        {
                                                                                                            path: app.Url,
                                                                                                            company: rule.CompanyId,
                                                                                                            tenant: rule.TenantId,
                                                                                                            app: app.AppName,
                                                                                                            appid: app.id
                                                                                                        };

                                                                                                    var jsonString = JSON.stringify(sessionData);

                                                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Session Data Object created for HTTAPI : %s', reqId, jsonString);

                                                                                                    redisHandler.SetObject(varUuid + "_data", jsonString, function(err, result)
                                                                                                    {
                                                                                                        if(err)
                                                                                                        {
                                                                                                            logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Exception in setting sessionData on backend - Key : %s_data', reqId, varUuid, err);
                                                                                                            var xml = xmlGen.createRejectResponse(callerContext);

                                                                                                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                                                            res.end(xml);
                                                                                                        }
                                                                                                        else
                                                                                                        {
                                                                                                            redisHandler.ExpireKey(varUuid + "_data", 86400);
                                                                                                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Session data added to redis successfully - Key : %s_data', reqId, varUuid);

                                                                                                            var xml = xmlGen.CreateHttpApiDialplan('[^\\s]*', callerContext, masterUrl, reqId, NumLimitInfo, app.id, rule.CompanyId, rule.TenantId, 'inbound', tempAni, rule.BusinessUnit);

                                                                                                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                                                            RedisOperations(varUuid, rule.CompanyId, rule.TenantId, rule.Application.id, app.ObjType, isDialplanGiven, 'inbound', eventTime, rule.BusinessUnit);

                                                                                                            res.end(xml);
                                                                                                        }

                                                                                                    });

                                                                                                }
                                                                                                else if(masterApp.ObjType === "SOCKET")
                                                                                                {
                                                                                                    logger.info('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Master App Type is SOCKET', reqId);

                                                                                                    var sessionData =
                                                                                                        {
                                                                                                            path: app.Url,
                                                                                                            company: rule.CompanyId,
                                                                                                            tenant: rule.TenantId,
                                                                                                            app: app.AppName,
                                                                                                            appid: app.id
                                                                                                        };

                                                                                                    var jsonString = JSON.stringify(sessionData);

                                                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Session Data Object created for SOCKET : %s', reqId, jsonString);

                                                                                                    redisHandler.SetObject(varUuid + "_data", jsonString, function(err, result)
                                                                                                    {
                                                                                                        if(err)
                                                                                                        {
                                                                                                            logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Exception in setting sessionData on backend - Key : : %s_data', reqId, varUuid, err);
                                                                                                            var xml = xmlGen.createRejectResponse(callerContext);

                                                                                                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                                                            res.end(xml);
                                                                                                        }
                                                                                                        else
                                                                                                        {
                                                                                                            redisHandler.ExpireKey(varUuid + "_data", 86400);
                                                                                                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Session data added to redis successfully - Key : : %s_data', reqId, varUuid);

                                                                                                            var xml = xmlGen.CreateSocketApiDialplan('[^\\s]*', callerContext, app.Url, reqId, NumLimitInfo, app.id, rule.CompanyId, rule.TenantId, 'inbound', rule.BusinessUnit);

                                                                                                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                                                            RedisOperations(varUuid, rule.CompanyId, rule.TenantId, rule.Application.id, app.ObjType, isDialplanGiven, 'inbound', eventTime, rule.BusinessUnit);

                                                                                                            res.end(xml);
                                                                                                        }

                                                                                                    });
                                                                                                }
                                                                                                else if(masterApp.ObjType === 'EXTENDED')
                                                                                                {
                                                                                                    data.DVPAppUrl = masterApp.Url;
                                                                                                    data.AppId = masterApp.id;
                                                                                                    extDialplanEngine.ProcessExtendedDialplan(reqId, callerIdNum, destNum, callerContext, direction, data, undefined, rule.CompanyId, rule.TenantId, securityToken, NumLimitInfo, 'inbound', ctxt, null, rule.BusinessUnit, isDialerIVR, function(err, extDialplan)
                                                                                                    {
                                                                                                        if(err)
                                                                                                        {
                                                                                                            logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Extended dialplan Error', reqId, err);

                                                                                                            var xml = xmlGen.createRejectResponse(callerContext);

                                                                                                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);
                                                                                                            res.end(xml);
                                                                                                        }
                                                                                                        else
                                                                                                        {
                                                                                                            RedisOperations(varUuid, rule.CompanyId, rule.TenantId, rule.Application.id, app.ObjType, isDialplanGiven, 'inbound', eventTime, rule.BusinessUnit);

                                                                                                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, extDialplan);
                                                                                                            res.end(extDialplan);
                                                                                                        }

                                                                                                    })
                                                                                                }
                                                                                                else
                                                                                                {
                                                                                                    logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Master App Type Undefined - Terminating', reqId);
                                                                                                    var xml = xmlGen.createRejectResponse(callerContext);

                                                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                                                    res.end(xml);
                                                                                                }

                                                                                            }
                                                                                            else
                                                                                            {
                                                                                                if(app.ObjType === "HTTAPI")
                                                                                                {
                                                                                                    logger.info('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Master App Type is HTTAPI', reqId);
                                                                                                    //add to redis

                                                                                                    var xml = xmlGen.CreateHttpApiDialplan('[^\\s]*', callerContext, app.Url, reqId, NumLimitInfo, app.id, rule.CompanyId, rule.TenantId, 'inbound', tempAni, rule.BusinessUnit);

                                                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);
                                                                                                    RedisOperations(varUuid, rule.CompanyId, rule.TenantId, rule.Application.id, app.ObjType, isDialplanGiven, 'inbound', eventTime, rule.BusinessUnit);
                                                                                                    res.end(xml);


                                                                                                }
                                                                                                else if(app.ObjType === "SOCKET")
                                                                                                {
                                                                                                    logger.info('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - App Type is SOCKET', reqId);

                                                                                                    var xml = xmlGen.CreateSocketApiDialplan('[^\\s]*', callerContext, app.Url, reqId, NumLimitInfo, app.id, rule.CompanyId, rule.TenantId, 'inbound', rule.BusinessUnit);

                                                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                                                    RedisOperations(varUuid, rule.CompanyId, rule.TenantId, rule.Application.id, app.ObjType, isDialplanGiven, 'inbound', eventTime, rule.BusinessUnit);

                                                                                                    res.end(xml);
                                                                                                }
                                                                                                else if(app.ObjType === 'EXTENDED')
                                                                                                {
                                                                                                    data.DVPAppUrl = app.Url;
                                                                                                    data.AppId = app.id;

                                                                                                    extDialplanEngine.ProcessExtendedDialplan(reqId, callerIdNum, destNum, callerContext, direction, data, undefined, rule.CompanyId, rule.TenantId, securityToken, NumLimitInfo, 'inbound', ctxt, cacheData, rule.BusinessUnit, isDialerIVR, function(err, extDialplan)
                                                                                                    {

                                                                                                        if(err)
                                                                                                        {
                                                                                                            logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Extended dialplan Error', reqId, err);

                                                                                                            var xml = xmlGen.createRejectResponse(callerContext);

                                                                                                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);
                                                                                                            res.end(xml);
                                                                                                        }
                                                                                                        else
                                                                                                        {
                                                                                                            RedisOperations(varUuid, rule.CompanyId, rule.TenantId, rule.Application.id, app.ObjType, isDialplanGiven, 'inbound', eventTime, rule.BusinessUnit);
                                                                                                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, extDialplan);
                                                                                                            res.end(extDialplan);
                                                                                                        }



                                                                                                    })
                                                                                                }
                                                                                                else
                                                                                                {
                                                                                                    logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Call rule developer app doesnt have a master app or master app url not set', reqId);
                                                                                                    var xml = xmlGen.createRejectResponse(callerContext);

                                                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                                                    res.end(xml);
                                                                                                }

                                                                                            }

                                                                                            var evtData =
                                                                                                {
                                                                                                    SessionId: varUuid,
                                                                                                    EventClass: "CALL",
                                                                                                    EventType : "CALL_RULE",
                                                                                                    EventCategory: "INBOUND_RULE",
                                                                                                    EventTime : new Date(),
                                                                                                    EventName : "Call Rule Picked",
                                                                                                    EventData : destNum,
                                                                                                    EventParams : rule
                                                                                                };

                                                                                            var jsonStr = JSON.stringify(evtData);
                                                                                            redisHandler.PublishToRedis('DVPEVENTS', jsonStr, function(err, redisRes)
                                                                                            {

                                                                                            });

                                                                                        }
                                                                                        else
                                                                                        {
                                                                                            logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Call rule has no application or application availability not set', reqId);
                                                                                            var xml = xmlGen.createRejectResponse(callerContext);

                                                                                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                                            res.end(xml);
                                                                                        }




                                                                                    }
                                                                                    else
                                                                                    {
                                                                                        logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Call rule not found', reqId);

                                                                                        var xml = xmlGen.createRejectResponse(callerContext);

                                                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                                        res.end(xml);
                                                                                    }
                                                                                })
                                                                            }


                                                                        }
                                                                        else
                                                                        {
                                                                            logger.debug('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Trunk number is not an inbound number or limit exceeded or limit not set', reqId);
                                                                            var xml = xmlGen.createRejectResponse(callerContext);

                                                                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                            res.end(xml);
                                                                        }



                                                                    }).catch(function(err)
                                                                    {
                                                                        logger.error('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Error occurred while getting company limits', reqId, err);
                                                                        var xml = xmlGen.createRejectResponse(callerContext);

                                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                        res.end(xml);

                                                                    })

                                                                }
                                                            }


                                                        }
                                                    })


                                                }
                                                else
                                                {
                                                    //check for click to call feature

                                                    var c2cRegExPattern = new RegExp('^(clicktocall_)[^\s]*');
                                                    if(c2cRegExPattern.test(destNum))
                                                    {
                                                        var splitVals = destNum.split('_');

                                                        if(splitVals.length === 4)
                                                        {
                                                            backendFactory.getRuleHandler().PickCallRuleInbound(reqId, callerIdNum, splitVals[3], '', callerContext, 'C2C', splitVals[2], splitVals[1], function(err, rule)
                                                            {
                                                                if(err)
                                                                {
                                                                    logger.error('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - PickCallRuleInbound returned exception', reqId, err);
                                                                    var xml = xmlGen.createRejectResponse(callerContext);

                                                                    res.end(xml);
                                                                }
                                                                else if(rule)
                                                                {
                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - PickCallRuleInbound returned rule : %s', reqId, JSON.stringify(rule));

                                                                    //check dnis is a emergency number

                                                                    var tempAni = data["Caller-Caller-ID-Number"];
                                                                    if(rule.ANITranslation)
                                                                    {
                                                                        tempAni = translationHandler.TranslateHandler(rule.ANITranslation, data["Caller-Caller-ID-Number"]);
                                                                        data["Caller-Caller-ID-Number"] = tempAni;
                                                                    }

                                                                    if(rule.Application && rule.Application.Availability)
                                                                    {
                                                                        var app = rule.Application;

                                                                        logger.info('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Call rule has a app', reqId);

                                                                        if(rule.Application.MasterApplication && rule.Application.MasterApplication.Availability && rule.Application.MasterApplication.Url)
                                                                        {
                                                                            var masterUrl = '';
                                                                            var masterApp = rule.Application.MasterApplication;

                                                                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Master application found : ', reqId, JSON.stringify(masterApp));

                                                                            if(masterApp.ObjType === "HTTAPI")
                                                                            {
                                                                                logger.info('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Master App Type is HTTAPI', reqId);
                                                                                //add to redis
                                                                                masterUrl = masterApp.Url;
                                                                                var sessionData =
                                                                                    {
                                                                                        path: app.Url,
                                                                                        company: rule.CompanyId,
                                                                                        tenant: rule.TenantId,
                                                                                        app: app.AppName,
                                                                                        appid: app.id
                                                                                    };

                                                                                var jsonString = JSON.stringify(sessionData);

                                                                                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Session Data Object created for HTTAPI : %s', reqId, jsonString);

                                                                                redisHandler.SetObject(varUuid + "_data", jsonString, function(err, result)
                                                                                {
                                                                                    if(err)
                                                                                    {
                                                                                        logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Exception in setting sessionData on backend - Key : %s_data', reqId, varUuid, err);
                                                                                        var xml = xmlGen.createRejectResponse(callerContext);

                                                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                                        res.end(xml);
                                                                                    }
                                                                                    else
                                                                                    {
                                                                                        redisHandler.ExpireKey(varUuid + "_data", 86400);
                                                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Session data added to redis successfully - Key : %s_data', reqId, varUuid);

                                                                                        var xml = xmlGen.CreateHttpApiDialplan('[^\\s]*', callerContext, masterUrl, reqId, null, app.id, rule.CompanyId, rule.TenantId, 'inbound', tempAni, rule.BusinessUnit);

                                                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                                        RedisOperations(varUuid, rule.CompanyId, rule.TenantId, rule.Application.id, app.ObjType, isDialplanGiven, 'inbound', eventTime, rule.BusinessUnit);

                                                                                        res.end(xml);
                                                                                    }

                                                                                });

                                                                            }
                                                                            else if(masterApp.ObjType === "SOCKET")
                                                                            {
                                                                                logger.info('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Master App Type is SOCKET', reqId);

                                                                                var sessionData =
                                                                                    {
                                                                                        path: app.Url,
                                                                                        company: rule.CompanyId,
                                                                                        tenant: rule.TenantId,
                                                                                        app: app.AppName,
                                                                                        appid: app.id
                                                                                    };

                                                                                var jsonString = JSON.stringify(sessionData);

                                                                                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Session Data Object created for SOCKET : %s', reqId, jsonString);

                                                                                redisHandler.SetObject(varUuid + "_data", jsonString, function(err, result)
                                                                                {
                                                                                    if(err)
                                                                                    {
                                                                                        logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Exception in setting sessionData on backend - Key : : %s_data', reqId, varUuid, err);
                                                                                        var xml = xmlGen.createRejectResponse(callerContext);

                                                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                                        res.end(xml);
                                                                                    }
                                                                                    else
                                                                                    {
                                                                                        redisHandler.ExpireKey(varUuid + "_data", 86400);
                                                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Session data added to redis successfully - Key : : %s_data', reqId, varUuid);

                                                                                        var xml = xmlGen.CreateSocketApiDialplan('[^\\s]*', callerContext, app.Url, reqId, null, app.id, rule.CompanyId, rule.TenantId, 'inbound', rule.BusinessUnit);

                                                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                                        RedisOperations(varUuid, rule.CompanyId, rule.TenantId, rule.Application.id, app.ObjType, isDialplanGiven, 'inbound', eventTime, rule.BusinessUnit);

                                                                                        res.end(xml);
                                                                                    }

                                                                                });
                                                                            }
                                                                            else if(masterApp.ObjType === 'EXTENDED')
                                                                            {
                                                                                data.DVPAppUrl = masterApp.Url;
                                                                                data.AppId = masterApp.id;
                                                                                extDialplanEngine.ProcessExtendedDialplan(reqId, callerIdNum, destNum, callerContext, direction, data, undefined, rule.CompanyId, rule.TenantId, securityToken, NumLimitInfo, 'inbound', ctxt, null, rule.BusinessUnit, isDialerIVR, function(err, extDialplan)
                                                                                {
                                                                                    if(err)
                                                                                    {
                                                                                        logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Extended dialplan Error', reqId, err);

                                                                                        var xml = xmlGen.createRejectResponse(callerContext);

                                                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);
                                                                                        res.end(xml);
                                                                                    }
                                                                                    else
                                                                                    {
                                                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, extDialplan);
                                                                                        RedisOperations(varUuid, rule.CompanyId, rule.TenantId, rule.Application.id, app.ObjType, isDialplanGiven, 'inbound', eventTime, rule.BusinessUnit);
                                                                                        res.end(extDialplan);
                                                                                    }

                                                                                })
                                                                            }
                                                                            else
                                                                            {
                                                                                logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Master App Type Undefined - Terminating', reqId);
                                                                                var xml = xmlGen.createRejectResponse(callerContext);

                                                                                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                                res.end(xml);
                                                                            }

                                                                        }
                                                                        else
                                                                        {
                                                                            if(app.ObjType === "HTTAPI")
                                                                            {
                                                                                logger.info('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Master App Type is HTTAPI', reqId);
                                                                                //add to redis

                                                                                var xml = xmlGen.CreateHttpApiDialplan('[^\\s]*', callerContext, app.Url, reqId, null, app.id, rule.CompanyId, rule.TenantId, 'inbound', tempAni, rule.BusinessUnit);

                                                                                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);
                                                                                RedisOperations(varUuid, rule.CompanyId, rule.TenantId, rule.Application.id, app.ObjType, isDialplanGiven, 'inbound', eventTime, rule.BusinessUnit);
                                                                                res.end(xml);

                                                                            }
                                                                            else if(app.ObjType === "SOCKET")
                                                                            {
                                                                                logger.info('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - App Type is SOCKET', reqId);

                                                                                var xml = xmlGen.CreateSocketApiDialplan('[^\\s]*', callerContext, app.Url, reqId, null, app.id, rule.CompanyId, rule.TenantId, 'inbound', rule.BusinessUnit);

                                                                                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                                RedisOperations(varUuid, rule.CompanyId, rule.TenantId, rule.Application.id, app.ObjType, isDialplanGiven, 'inbound', eventTime, rule.BusinessUnit);

                                                                                res.end(xml);
                                                                            }
                                                                            else if(app.ObjType === 'EXTENDED')
                                                                            {
                                                                                data.DVPAppUrl = app.Url;
                                                                                data.AppId = app.id;
                                                                                extDialplanEngine.ProcessExtendedDialplan(reqId, callerIdNum, destNum, callerContext, direction, data, undefined, rule.CompanyId, rule.TenantId, securityToken, NumLimitInfo, 'inbound', ctxt, null, rule.BusinessUnit, isDialerIVR, function(err, extDialplan)
                                                                                {
                                                                                    if(err)
                                                                                    {
                                                                                        logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Extended dialplan Error', reqId, err);

                                                                                        var xml = xmlGen.createRejectResponse(callerContext);

                                                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);
                                                                                        res.end(xml);
                                                                                    }
                                                                                    else
                                                                                    {
                                                                                        RedisOperations(varUuid, rule.CompanyId, rule.TenantId, rule.Application.id, app.ObjType, isDialplanGiven, 'inbound', eventTime, rule.BusinessUnit);

                                                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, extDialplan);
                                                                                        res.end(extDialplan);
                                                                                    }

                                                                                })
                                                                            }
                                                                            else
                                                                            {
                                                                                logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Call rule developer app doesnt have a master app or master app url not set', reqId);
                                                                                var xml = xmlGen.createRejectResponse(callerContext);

                                                                                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                                res.end(xml);
                                                                            }

                                                                        }

                                                                        var evtData =
                                                                            {
                                                                                SessionId: varUuid,
                                                                                EventClass: "CALL",
                                                                                EventType : "CALL_RULE",
                                                                                EventCategory: "INBOUND_RULE",
                                                                                EventTime : new Date(),
                                                                                EventName : "Call Rule Picked",
                                                                                EventData : destNum,
                                                                                EventParams : rule
                                                                            };

                                                                        var jsonStr = JSON.stringify(evtData);
                                                                        redisHandler.PublishToRedis('DVPEVENTS', jsonStr, function(err, redisRes)
                                                                        {

                                                                        });

                                                                    }
                                                                    else
                                                                    {
                                                                        logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Call rule has no application or application availability not set', reqId);
                                                                        var xml = xmlGen.createRejectResponse(callerContext);

                                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                        res.end(xml);
                                                                    }


                                                                }
                                                                else
                                                                {
                                                                    logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Call rule not found', reqId);

                                                                    var xml = xmlGen.createRejectResponse(callerContext);

                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                    res.end(xml);
                                                                }
                                                            })
                                                        }
                                                    }
                                                    else
                                                    {
                                                        logger.debug('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - GetPhoneNumberDetails returned num obj : EMPTY', reqId);
                                                        var xml = xmlGen.createRejectResponse(callerContext);

                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                        res.end(xml);
                                                    }


                                                }
                                            });
                                        }


                                    }
                                    else
                                    {
                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Call Direction OUT', reqId);

                                        HandleOutRequest(reqId, data, callerIdNum, contextTenant, appType, contextCompany, dvpOriginationType, destNum, domain, callerContext, profile, varUuid, isDialplanGiven, ctxt, cacheData, eventTime, null, isDialerIVR, res);

                                    }


                                }
                            }


                        }

                    })
                }
            }



        }
        else
        {
            logger.error('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - cdnum OR callerContext OR hostname not found in request - Terminating', reqId);
            var xml = xmlGen.createRejectResponse(callerContext);

            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

            res.end(xml);
        }
    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Exception occurred on CallApp Api Method - Error : ', reqId, ex);
        var xml = xmlGen.createRejectResponse(callerContext);

        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

        res.end(xml);
    }

    return next();

});

server.post('/DVP/API/:version/DynamicConfigGenerator/SMS/Routing', function(req,res,next)
{

    var reqId = nodeUuid.v1();

    logger.debug('[DVP-DynamicConfigurationGenerator.SMSRouting] - [%s] - SMS ROUTE Request Received -------------------------', reqId);

    logger.debug('[DVP-DynamicConfigurationGenerator.SMSRouting] - [%s] - Request Body : %s', reqId, req.body);

    var destNumber = req.body.destination_number;
    var fromNumber = req.body.from_number;
    var message = req.body.short_message;
    var direction = req.body.direction;

    try
    {

        backendFactory.getBackendHandler().GetPhoneNumberDetails(destNumber, function(err, num, cacheInfo)
        {
            var cacheData = cacheInfo;
            if(err)
            {
                smsCdrOp.SaveSmsCdr(reqId, fromNumber, destNumber, 'SERVER ERROR', false, direction, -1, message, -1, -1);
                logger.error('[DVP-DynamicConfigurationGenerator.SMSRouting] - [%s] - ERROR OCCURRED', reqId, err);
                res.send(500, new Error('Error getting phone number'));
                res.end();

            }
            else if(num)
            {
                logger.debug('DVP-DynamicConfigurationGenerator.SMSRouting] - [%s] - TrunkNumber found', reqId);

                logger.debug('[DVP-DynamicConfigurationGenerator.SMSRouting] - [%s] - Trying to pick inbound rule - Params - aniNum : %s, destNum : %s, domain : %s, companyId : %s, tenantId : %s', reqId, fromNumber, destNumber, '', num.CompanyId, num.TenantId);

                backendFactory.getRuleHandler().PickCallRuleInbound(reqId, fromNumber, destNumber, message, '', '', 'SMS', num.CompanyId, num.TenantId, cacheData, function(err, rule)
                {
                    if(err)
                    {
                        smsCdrOp.SaveSmsCdr(reqId, fromNumber, destNumber, 'SERVER ERROR', false, direction, -1, message, num.CompanyId, num.TenantId);

                        logger.error('[DVP-DynamicConfigurationGenerator.SMSRouting] - [%s] - ERROR OCCURRED', reqId, err);
                        res.send(500, new Error('Error getting sms call rule'));
                        res.end();
                    }
                    else if(rule)
                    {

                        logger.debug('DVP-DynamicConfigurationGenerator.SMSRouting] - [%s] - PickCallRuleInbound returned rule : %s', reqId, JSON.stringify(rule));

                        //check dnis is a emergency number
                        var respData =
                        {
                            DestinationNumber: destNumber,
                            FromNumber: fromNumber,
                            Message: message,
                            Direction: direction,
                            CompanyId: num.CompanyId,
                            TenantId: num.TenantId
                        };

                        var appId = -1;

                        if(rule.Application && rule.Application.Availability && rule.Application.Url)
                        {
                            respData.Url = rule.Application.Url;
                            appId = rule.Application.id;
                        }

                        logger.info('[DVP-DynamicConfigurationGenerator.SMSRouting] - [%s] - OPERATION SUCCESS - API RESPONSE : %s', reqId, reqId);



                        //Add CDR
                        smsCdrOp.SaveSmsCdr(reqId, fromNumber, destNumber, null, true, direction, appId, message, num.CompanyId, num.TenantId);

                        redisHandler.SetObject('SMS:' + reqId, JSON.stringify(respData), function(err, redisRes){
                            redisHandler.ExpireKey('SMS:' + reqId, 86400);
                        });

                        res.end(reqId);

                    }
                    else
                    {
                        smsCdrOp.SaveSmsCdr(reqId, fromNumber, destNumber, "Rule not found", true, direction, -1, message, num.CompanyId, num.TenantId);

                        logger.error('[DVP-DynamicConfigurationGenerator.SMSRouting] - [%s] - ERROR OCCURRED', reqId, new Error('Rule not found'));

                        res.send(404, new Error('Rule not found'));
                        res.end();

                    }
                })


            }
            else
            {
                smsCdrOp.SaveSmsCdr(reqId, fromNumber, destNumber, "Trunk number not found", true, direction, -1, message, -1, -1);
                logger.error('[DVP-DynamicConfigurationGenerator.SMSRouting] - [%s] - ERROR OCCURRED', reqId, new Error('Trunk number not found'));
                res.send(404, new Error('Trunk number not found'));
                res.end();
            }
        });


    }
    catch(ex)
    {
        smsCdrOp.SaveSmsCdr(reqId, fromNumber, destNumber, "SERVER ERROR", true, direction, -1, message, -1, -1);
        logger.error('[DVP-DynamicConfigurationGenerator.SMSRouting] - [%s] - ERROR OCCURRED', reqId, ex);
        res.send(500, new Error('Exception occurred'));
        res.end();
    }

    return next();

});

server.get('/DVP/API/:version/DynamicConfigGenerator/PublicUserRequestController/:username/:clusterId', function(req,res,next)
{
    var reqId = nodeUuid.v1();

    try
    {
        logger.info('[DVP-DynamicConfigurationGenerator.PublicUserRequestController] - [%s] - HTTP SIPLB Request Received', reqId);

        var username = req.params.username;
        var clusterId = req.params.clusterId;

        logger.debug('[DVP-DynamicConfigurationGenerator.PublicUserRequestController] - [%s] - Request Params - username : %s , clusterId : %s', reqId, username, clusterId);

        logger.info('[DVP-DynamicConfigurationGenerator.PublicUserRequestController] - [%s] - call direction is IN', reqId);
        backendFactory.getBackendHandler().GetCloudForUser(username, clusterId, null, function(err, cb)
        {
            if(err || !cb)
            {
                if(err)
                {
                    logger.error('[DVP-DynamicConfigurationGenerator.PublicUserRequestController] - [%s] - Exception occurred while executing GetCloudForIncomingRequest', reqId, err);
                }
                else
                {
                    logger.error('[DVP-DynamicConfigurationGenerator.PublicUserRequestController] - [%s] - GetCloudForIncomingRequest returned empty object', reqId);
                }
                res.end(",");
            }
            else
            {
                var returnMessage = cb.LoadBalanceType + "," + cb.IpCode;

                logger.debug('[DVP-DynamicConfigurationGenerator.PublicUserRequestController] - [%s] - GetCloudForIncomingRequest object found - Returning LB Details : %s', reqId, returnMessage);

                res.end(returnMessage);
            }

        });

    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.LbRequestController] - [%s] - Exception occurred on LbRequestController Api Method - Error : ', reqId, ex);
        res.end(",");
    }

    return next();
});

server.get('/DVP/API/:version/DynamicConfigGenerator/LbRequestController/:direction/:number/:ip', function(req,res,next)
{
    var reqId = nodeUuid.v1();

    try
    {
        logger.info('[DVP-DynamicConfigurationGenerator.LbRequestController] - [%s] - HTTP SIPLB Request Received [LbRequestController]', reqId);

        var direction = req.params.direction;
        var number = req.params.number;
        var ip = req.params.ip;

        logger.debug('[DVP-DynamicConfigurationGenerator.LbRequestController] - [%s] - Request Params - direction : %s, number : %s, ip: %s', reqId, direction, number, ip);

        if(direction === "in")
        {
            logger.info('[DVP-DynamicConfigurationGenerator.LbRequestController] - [%s] - call direction is IN', reqId);
            backendFactory.getBackendHandler().GetCloudForIncomingRequest(number, ip, null, function(err, cb)
            {
                if(err || !cb)
                {
                    if(err)
                    {
                        logger.error('[DVP-DynamicConfigurationGenerator.LbRequestController] - [%s] - Exception occurred while executing GetCloudForIncomingRequest', reqId, err);
                    }
                    else
                    {
                        logger.error('[DVP-DynamicConfigurationGenerator.LbRequestController] - [%s] - GetCloudForIncomingRequest returned empty object', reqId);
                    }
                    res.end(",,,");
                }
                else
                {
                    var returnMessage = cb.InboundLimit + "," + cb.BothLimit + "," + cb.LoadBalanceType + "," + cb.IpCode;

                    logger.debug('[DVP-DynamicConfigurationGenerator.LbRequestController] - [%s] - GetCloudForIncomingRequest object found - Returning LB Details : %s', reqId, returnMessage);

                    res.end(returnMessage);
                }

            });
        }
        else if(direction === "out")
        {
            logger.info('[DVP-DynamicConfigurationGenerator.LbRequestController] - [%s] - call direction is OUT', reqId);
            backendFactory.getBackendHandler().GetGatewayForOutgoingRequest(number, 0, null, function(err, cb)
            {
                if(err || !cb)
                {
                    if(err)
                    {
                        logger.error('[DVP-DynamicConfigurationGenerator.LbRequestController] - [%s] - Exception occurred while executing GetGatewayForOutgoingRequest', reqId, err);
                    }
                    else
                    {
                        logger.error('[DVP-DynamicConfigurationGenerator.LbRequestController] - [%s] - GetGatewayForOutgoingRequest returned empty object', reqId);
                    }

                    res.end(",,,");
                }
                else
                {
                    var returnMessage = cb.OutboundLimit + "," + cb.BothLimit + "," + cb.GwIpUrl;

                    logger.debug('[DVP-DynamicConfigurationGenerator.LbRequestController] - [%s] - GetGatewayForOutgoingRequest object found - Returning Gateway Details : %s', reqId, returnMessage);

                    res.end(returnMessage);
                }

            });
        }
        else if(direction === "public_user")
        {
            logger.info('[DVP-DynamicConfigurationGenerator.LbRequestController] - [%s] - call direction is public_user', reqId);
            backendFactory.getBackendHandler().GetCloudForIncomingRequest(number, ip, null, function(err, cb)
            {
                if(err || !cb)
                {
                    if(err)
                    {
                        logger.error('[DVP-DynamicConfigurationGenerator.LbRequestController] - [%s] - Exception occurred while executing GetCloudForIncomingRequest', reqId, err);
                    }
                    else
                    {
                        logger.error('[DVP-DynamicConfigurationGenerator.LbRequestController] - [%s] - GetCloudForIncomingRequest returned empty object', reqId);
                    }
                    res.end(",");
                }
                else
                {
                    var returnMessage = cb.LoadBalanceType + "," + cb.IpCode;

                    logger.debug('[DVP-DynamicConfigurationGenerator.LbRequestController] - [%s] - GetCloudForIncomingRequest object found - Returning LB Details : %s', reqId, returnMessage);

                    res.end(returnMessage);
                }

            });

        }
        else
        {
            logger.error('[DVP-DynamicConfigurationGenerator.LbRequestController] - [%s] - call direction is NOT DEFINED - Terminating', reqId);

            res.end(",");
        }

    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.LbRequestController] - [%s] - Exception occurred on LbRequestController Api Method - Error : ', reqId, ex);
        res.end(",");
    }

    return next();
});

server.get('/DVP/API/:version/DynamicConfigGenerator/CallServers/:companyId/:tenantId', function(req,res,next)
{
    var reqId = nodeUuid.v1();

    var emptyArr = [];

    try
    {
        logger.info('[DVP-DynamicConfigurationGenerator.CallServers] - [%s] - HTTP CS List Request Received [CallServers]', reqId);

        var companyId = req.params.companyId;
        var tenantId = req.params.tenantId;

        logger.debug('[DVP-DynamicConfigurationGenerator.CallServers] - [%s] - Request Params - companyId : %s, tenantId : %s', reqId, companyId, tenantId);

        backendFactory.getBackendHandler().GetCallServersForEndUserDB(reqId, companyId, tenantId, null, function(err, csList)
        {
            var state = true;
            if(err)
            {
                state = false;
            }
            var jsonString = messageFormatter.FormatMessage(err, "", state, csList);
            res.end(jsonString);
        })

    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.CallServers] - [%s] - Exception occurred on CallServers Api Method - Error : ', reqId, ex);
        var jsonString = messageFormatter.FormatMessage(ex, "", false, emptyArr);
        res.end(jsonString);
    }

    return next();
});

server.post('/DVP/API/:version/DynamicConfigGenerator/DirectoryProfile', function(req, res, next)
{
    var reqId = nodeUuid.v1();

    try
    {
        logger.info('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - HTTP FS DIRECTORY_PROFILE Request Received [DirectoryProfile]', reqId);

        logger.debug('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - Request Body : %s', reqId, req.body);

        var data = fsMediaFormatter.convertUrlEncoded(req.body);

        var hostname = data["hostname"];
        var fsHostName = data["FreeSWITCH-Hostname"];
        var user = data["user"];
        var domain = data["domain"];
        var action = data["action"];
        var purpose = data["purpose"];
        var group = data["group"];
        var sipAuthRealm = data["sip_auth_realm"];
        var profile = data["profile"];

        if(action && group && hostname && domain && action === "group_call")
        {
            logger.info('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - ACTION TYPE GROUP_CALL', reqId);

            var tempAuthRealm = domain;
            if(sipAuthRealm != undefined)
            {
                tempAuthRealm = sipAuthRealm;
            }


            logger.debug('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - Sip Auth Realm Set to : %s', reqId, tempAuthRealm);

            backendFactory.getBackendHandler().GetGroupBy_Name_Domain(group, tempAuthRealm, null, function(err, result)
            {
                if(err)
                {
                    logger.error('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - backendHandler.GetGroupBy_Name_Domain threw an exception', reqId, err);
                    var xml = xmlGen.createNotFoundResponse();

                    logger.info('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - API RESPONSE - %s', reqId, xml);

                    res.end(xml);
                }
                else if(result)
                {
                    logger.debug('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - backendHandler.GetGroupBy_Name_Domain returned group details : %s', reqId, JSON.stringify(result));
                    var xml = xmlGen.CreateUserGroupDirectoryProfile(result, reqId);

                    logger.info('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - API RESPONSE - %s', reqId, xml);

                    res.end(xml);

                }
                else
                {
                    logger.error('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - backendHandler.GetGroupBy_Name_Domain returned empty object', reqId);
                    var xml = xmlGen.createNotFoundResponse();

                    logger.info('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - API RESPONSE - %s', reqId, xml);

                    res.end(xml);
                }
            })

        }
        else if(action && user && hostname && domain && (action === 'sip_auth' || action === 'message-count'))
        {
            logger.info('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - ACTION TYPE SIP_AUTH', reqId);

            var tempAuthRealm = domain;
            if(sipAuthRealm != undefined)
            {
                tempAuthRealm = sipAuthRealm;
            }

            logger.debug('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - Sip Auth Realm Set to : %s', tempAuthRealm);

            backendFactory.getBackendHandler().GetUserBy_Name_Domain(user, tempAuthRealm, null, function(err, usr)
            {
                if(err)
                {
                    logger.error('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - GetUserBy_Name_Domain threw an exception', reqId, err);
                    var xml = xmlGen.createNotFoundResponse();

                    logger.info('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - API RESPONSE - %s', reqId, xml);

                    res.end(xml);
                }
                else if(usr)
                {
                    //create xml
                    logger.debug('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - backendHandler.GetUserBy_Name_Domain returned user : %s', reqId, JSON.stringify(usr));
                    if(usr.CloudEndUser)
                    {
                        logger.debug('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - User Has a Cloud End User', reqId);

                        var xml = xmlGen.createDirectoryProfile(usr.SipUsername, usr.SipExtension, usr.CloudEndUser.Domain, usr.EmailAddress, usr.Password, usr.ContextId, usr.VoicemailAsEmail, reqId, usr.Pin);

                        logger.info('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - API RESPONSE - %s', reqId, xml);

                        res.end(xml);
                    }
                    else
                    {
                        logger.error('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - User Has NO Cloud End User', reqId);
                        var xml = xmlGen.createNotFoundResponse();
                        logger.info('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - API RESPONSE - %s', reqId, xml);
                        res.end(xml);
                    }
                }
                else
                {
                    logger.error('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - backendHandler.GetUserBy_Name_Domain returned empty object', reqId);
                    var xml = xmlGen.createNotFoundResponse();

                    logger.info('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - API RESPONSE - %s', reqId, xml);

                    res.end(xml);
                }
            })
        }
        else if(action && user && hostname && domain && (action === 'user_call' || action === 'voicemail-lookup'))
        {
            if(action === 'user_call')
            {
                logger.info('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - ACTION TYPE USER_CALL', reqId);
            }
            else
            {
                logger.info('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - ACTION TYPE VOICEMAIL_LOOKUP', reqId);
            }

            var tempAuthRealm = domain;
            if(sipAuthRealm != undefined)
            {
                tempAuthRealm = sipAuthRealm;
            }

            logger.debug('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - Sip Auth Realm Set to : %s', tempAuthRealm);

            backendFactory.getBackendHandler().GetUserBy_Ext_Domain(user, tempAuthRealm, null, function(err, usr){

                if(!err && usr)
                {
                    logger.debug('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - backendHandler.GetUserBy_Ext_Domain returned user : %s', reqId, JSON.stringify(usr));
                    //create xml
                    if(usr.CloudEndUser)
                    {
                        logger.debug('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - User Has a Cloud End User', reqId);
                        var xml = xmlGen.createDirectoryProfile(usr.SipUsername, usr.SipExtension, usr.CloudEndUser.Domain, usr.EmailAddress, usr.Password, usr.ContextId, usr.VoicemailAsEmail, reqId);

                        logger.info('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - API RESPONSE - %s', reqId, xml);

                        res.end(xml);
                    }
                    else
                    {
                        logger.error('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - User Has NO Cloud End User', reqId);

                        var xml = xmlGen.createNotFoundResponse();

                        logger.info('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - API RESPONSE - %s', reqId, xml);

                        res.end(xml);
                    }
                }
                else
                {
                    logger.error('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - User not found', reqId, err);

                    var xml = xmlGen.createNotFoundResponse();

                    logger.info('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - API RESPONSE - %s', reqId, xml);

                    res.end(xml);
                }
            })
        }
        else if(purpose && profile && hostname && purpose === 'gateways')
        {
            logger.info('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - ACTION TYPE GATEWAYS', reqId);
            var csId = parseInt(hostname);
            backendFactory.getBackendHandler().GetGatewayListForCallServerProfile(profile, fsHostName, reqId, null, function(err, result)
            {
                if (!err && result && result.length > 0)
                {
                    logger.debug('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - backendHandler.GetGatewayListForCallServerProfile returned gw result - list count : %d', reqId, result.length);

                    var xml = xmlGen.CreateGatewayProfile(result, reqId);

                    logger.info('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - API RESPONSE - %s', reqId, xml);

                    res.end(xml);
                }
                else
                {
                    logger.error('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - Gateways not found', reqId, err);
                    var xml = xmlGen.createNotFoundResponse();

                    logger.info('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - API RESPONSE - %s', reqId, xml);

                    res.end(xml);
                }

            })
        }
        else
        {
            var xml = xmlGen.createNotFoundResponse();
            logger.info('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - API RESPONSE - %s', reqId, xml);
            res.end(xml);
        }

    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - Exception occurred on DirectoryProfile Api Method - Error : ', reqId, ex);
        var xml = xmlGen.createNotFoundResponse();
        logger.info('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - API RESPONSE - %s', reqId, xml);
    }

    return next();

});

server.opts('/DynamicConfigGenerator/HealthCheck', function(req,res,next)
{
    res.end('OK');

    return next();

});

server.get('/DynamicConfigGenerator/HealthCheck', function(req,res,next)
{
    res.end('OK');

    return next();

})


server.listen(hostPort, hostIp, function () {
    console.log('%s listening at %s', server.name, server.url);
});
