var restify = require('restify');
var stringify = require('stringify');
var config = require('config');
var nodeUuid = require('node-uuid');
var fsMediaFormatter = require('./FreeSwitchMediaFormatter.js');
var backendHandler = require('./SipExtBackendOperations.js');
var xmlGen = require('./XmlResponseGenerator.js');
var jsonFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');
var ruleHandler = require('dvp-ruleservice/CallRuleBackendOperations.js');
var redisHandler = require('./RedisHandler.js');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var extDialplanEngine = require('./ExtendedDialplanEngine.js');
var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');


var hostIp = config.Host.Ip;
var hostPort = config.Host.Port;
var hostVersion = config.Host.Version;

var server = restify.createServer({
    name: 'DVP-DynamicConfigurationGenerator',
    formatters : {
        'application/x-www-form-urlencoded' : function(req, res, body)
        {
            return body;
        }
    }
});

server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser());


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
        var dvpOriginationType = data["DVP-ORIGINATION-TYPE"];
        var csId = parseInt(hostname);

        if (cdnum && callerContext && hostname)
        {
            //Dialplan

            var destNum = (huntDestNum) ? huntDestNum:cdnum;

            //Get Context
            logger.debug('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Trying to get context : %s', reqId, callerContext);

            backendHandler.GetContext(callerContext, function(err, ctxt)
            {
                if(err)
                {
                    logger.error('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Error occurred getting context', reqId, err);
                    var xml = xmlGen.createNotFoundResponse();

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

                        extDialplanEngine.ProcessCallForwarding(reqId, callerIdNum, destNum, domain, context, direction, data, companyId, tenantId, disconReason, fwdId, dodNumber, '', origination, origCallerIdNum, csId, function(err, xml)
                        {
                            if(err)
                            {
                                logger.error('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Error occurred while processing call forwarding lua equest', reqId, err);
                                var xml = xmlGen.createNotFoundResponse();

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
                    else
                    {
                        if(direction === 'IN')
                        {
                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Call Direction IN', reqId);

                            logger.debug('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Validating trunk number for inbound call - TrunkNumber : %s', reqId, destNum);

                            backendHandler.GetPhoneNumberDetails(destNum, function(err, num)
                            {
                                if(err)
                                {
                                    logger.error('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Error occurred while validating incoming number', reqId, err);
                                    var xml = xmlGen.createNotFoundResponse();

                                    res.end(xml);

                                }
                                else if(num)
                                {
                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - TrunkNumber found', reqId);
                                    if((num.ObjCategory === 'INBOUND' && num.LimitInfoInbound && num.LimitInfoInbound.Enable && typeof num.LimitInfoInbound.MaxCount != 'undefined') || (num.ObjCategory === 'BOTH' && ((num.LimitInfoInbound && num.LimitInfoInbound.Enable && typeof num.LimitInfoInbound.MaxCount != 'undefined') || (num.LimitInfoBoth && num.LimitInfoBoth.Enable && typeof num.LimitInfoBoth.MaxCount != 'undefined'))))
                                    {
                                        var bothLim = undefined;
                                        var inbLim = undefined;
                                        if(num.LimitInfoInbound)
                                        {
                                            inbLim = num.LimitInfoInbound.MaxCount;
                                        }

                                        if(num.LimitInfoBoth)
                                        {
                                            bothLim = num.LimitInfoBoth.MaxCount;
                                        }

                                        var NumLimitInfo =
                                        {
                                            CallType : num.ObjType,
                                            NumType : num.ObjCategory,
                                            TrunkNumber : num.PhoneNumber,
                                            InboundLimit : inbLim,
                                            BothLimit : bothLim,
                                            CompanyId : num.CompanyId,
                                            TenantId : num.TenantId,
                                            CheckLimit : true
                                        };

                                        var faxType = undefined;
                                        if(num.Trunk)
                                        {
                                            if(num.Trunk.LoadBalancerId)
                                            {
                                                NumLimitInfo.CheckLimit = false;
                                            }
                                            faxType = num.Trunk.FaxType;

                                            data['TrunkFaxType'] = faxType;
                                        }

                                        //logger.debug('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - GetPhoneNumberDetails returned num obj : %j', reqId, JSON.stringify(num));

                                        logger.debug('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Trying to pick inbound rule - Params - aniNum : %s, destNum : %s, domain : %s, companyId : %s, tenantId : %s', reqId, aniNum, destNum, domain, num.CompanyId, num.TenantId);
                                        ruleHandler.PickCallRuleInbound(reqId, callerIdNum, destNum, domain, callerContext, num.CompanyId, num.TenantId, function(err, rule)
                                        {
                                            if(err)
                                            {
                                                logger.error('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - PickCallRuleInbound returned exception', reqId, err);
                                                var xml = xmlGen.createNotFoundResponse();

                                                res.end(xml);
                                            }
                                            else if(rule)
                                            {
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
                                                                    var xml = xmlGen.createNotFoundResponse();

                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                    res.end(xml);
                                                                }
                                                                else
                                                                {
                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Session data added to redis successfully - Key : %s_data', reqId, varUuid);

                                                                    var xml = xmlGen.CreateHttpApiDialplan('[^\\s]*', callerContext, masterUrl, reqId, NumLimitInfo);

                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);
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
                                                                    var xml = xmlGen.createNotFoundResponse();

                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                    res.end(xml);
                                                                }
                                                                else
                                                                {
                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Session data added to redis successfully - Key : : %s_data', reqId, varUuid);

                                                                    var xml = xmlGen.CreateSocketApiDialplan('[^\\s]*', callerContext, app.Url, reqId, NumLimitInfo);

                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                    res.end(xml);
                                                                }

                                                            });
                                                        }
                                                        else if(masterApp.ObjType === 'EXTENDED')
                                                        {
                                                            data.DVPAppUrl = masterApp.Url;
                                                            data.AppId = masterApp.id;
                                                            extDialplanEngine.ProcessExtendedDialplan(reqId, decodedSipFromUri, decodedSipToUri, callerContext, direction, data, undefined, rule.CompanyId, rule.TenantId, 'test', NumLimitInfo, function(err, extDialplan)
                                                            {
                                                                if(err)
                                                                {
                                                                    logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Extended dialplan Error', reqId, err);
                                                                }
                                                                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, extDialplan);
                                                                res.end(extDialplan);
                                                            })
                                                        }
                                                        else
                                                        {
                                                            logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Master App Type Undefined - Terminating', reqId);
                                                            var xml = xmlGen.createNotFoundResponse();

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

                                                            var xml = xmlGen.CreateHttpApiDialplan('[^\\s]*', callerContext, app.Url, reqId, NumLimitInfo);

                                                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);
                                                            res.end(xml);


                                                        }
                                                        else if(app.ObjType === "SOCKET")
                                                        {
                                                            logger.info('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - App Type is SOCKET', reqId);

                                                            var xml = xmlGen.CreateSocketApiDialplan('[^\\s]*', callerContext, app.Url, reqId, NumLimitInfo);

                                                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                            res.end(xml);
                                                        }
                                                        else if(app.ObjType === 'EXTENDED')
                                                        {
                                                            data.DVPAppUrl = app.Url;
                                                            data.AppId = app.id;
                                                            extDialplanEngine.ProcessExtendedDialplan(reqId, decodedSipFromUri, decodedSipToUri, callerContext, direction, data, undefined, rule.CompanyId, rule.TenantId, 'test', NumLimitInfo, function(err, extDialplan)
                                                            {
                                                                if(err)
                                                                {
                                                                    logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Extended dialplan Error', reqId, err);
                                                                }
                                                                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, extDialplan);
                                                                res.end(extDialplan);
                                                            })
                                                        }
                                                        else
                                                        {
                                                            logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Call rule developer app doesnt have a master app or master app url not set', reqId);
                                                            var xml = xmlGen.createNotFoundResponse();

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
                                                    var xml = xmlGen.createNotFoundResponse();

                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                    res.end(xml);
                                                }


                                            }
                                            else
                                            {
                                                logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Call rule not found', reqId);

                                                var xml = xmlGen.createNotFoundResponse();

                                                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                res.end(xml);
                                            }
                                        })
                                    }
                                    else
                                    {
                                        logger.debug('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Trunk number is not an inbound number or limit exceeded or limit not set', reqId);
                                        var xml = xmlGen.createNotFoundResponse();

                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                        res.end(xml);
                                    }


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
                                            ruleHandler.PickClickToCallRuleInbound(reqId, callerIdNum, splitVals[3], callerContext, splitVals[2], splitVals[1], function(err, rule)
                                            {
                                                if(err)
                                                {
                                                    logger.error('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - PickCallRuleInbound returned exception', reqId, err);
                                                    var xml = xmlGen.createNotFoundResponse();

                                                    res.end(xml);
                                                }
                                                else if(rule)
                                                {
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
                                                                        var xml = xmlGen.createNotFoundResponse();

                                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                        res.end(xml);
                                                                    }
                                                                    else
                                                                    {
                                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Session data added to redis successfully - Key : %s_data', reqId, varUuid);

                                                                        var xml = xmlGen.CreateHttpApiDialplan('[^\\s]*', callerContext, masterUrl, reqId, NumLimitInfo);

                                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);
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
                                                                        var xml = xmlGen.createNotFoundResponse();

                                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                        res.end(xml);
                                                                    }
                                                                    else
                                                                    {
                                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Session data added to redis successfully - Key : : %s_data', reqId, varUuid);

                                                                        var xml = xmlGen.CreateSocketApiDialplan('[^\\s]*', callerContext, app.Url, reqId, NumLimitInfo);

                                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                        res.end(xml);
                                                                    }

                                                                });
                                                            }
                                                            else if(masterApp.ObjType === 'EXTENDED')
                                                            {
                                                                data.DVPAppUrl = masterApp.Url;
                                                                data.AppId = masterApp.id;
                                                                extDialplanEngine.ProcessExtendedDialplan(reqId, decodedSipFromUri, decodedSipToUri, callerContext, direction, data, undefined, rule.CompanyId, rule.TenantId, 'test', NumLimitInfo, function(err, extDialplan)
                                                                {
                                                                    if(err)
                                                                    {
                                                                        logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Extended dialplan Error', reqId, err);
                                                                    }
                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, extDialplan);
                                                                    res.end(extDialplan);
                                                                })
                                                            }
                                                            else
                                                            {
                                                                logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Master App Type Undefined - Terminating', reqId);
                                                                var xml = xmlGen.createNotFoundResponse();

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

                                                                var xml = xmlGen.CreateHttpApiDialplan('[^\\s]*', callerContext, app.Url, reqId, NumLimitInfo);

                                                                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);
                                                                res.end(xml);


                                                            }
                                                            else if(app.ObjType === "SOCKET")
                                                            {
                                                                logger.info('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - App Type is SOCKET', reqId);

                                                                var xml = xmlGen.CreateSocketApiDialplan('[^\\s]*', callerContext, app.Url, reqId, NumLimitInfo);

                                                                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                res.end(xml);
                                                            }
                                                            else if(app.ObjType === 'EXTENDED')
                                                            {
                                                                data.DVPAppUrl = app.Url;
                                                                data.AppId = app.id;
                                                                extDialplanEngine.ProcessExtendedDialplan(reqId, decodedSipFromUri, decodedSipToUri, callerContext, direction, data, undefined, rule.CompanyId, rule.TenantId, 'test', NumLimitInfo, function(err, extDialplan)
                                                                {
                                                                    if(err)
                                                                    {
                                                                        logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Extended dialplan Error', reqId, err);
                                                                    }
                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, extDialplan);
                                                                    res.end(extDialplan);
                                                                })
                                                            }
                                                            else
                                                            {
                                                                logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Call rule developer app doesnt have a master app or master app url not set', reqId);
                                                                var xml = xmlGen.createNotFoundResponse();

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
                                                        var xml = xmlGen.createNotFoundResponse();

                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                        res.end(xml);
                                                    }


                                                }
                                                else
                                                {
                                                    logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Call rule not found', reqId);

                                                    var xml = xmlGen.createNotFoundResponse();

                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                    res.end(xml);
                                                }
                                            })
                                        }
                                    }
                                    else
                                    {
                                        logger.debug('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - GetPhoneNumberDetails returned num obj : EMPTY', reqId);
                                        var xml = xmlGen.createNotFoundResponse();

                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                        res.end(xml);
                                    }


                                }
                            });
                        }
                        else
                        {
                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Call Direction OUT', reqId);
                            //Get from user

                            var ignoreTenant = false;

                            if(dvpOriginationType && dvpOriginationType === 'PUBLIC_USER')
                            {
                                ignoreTenant = true;
                            }

                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Trying to find from user for outbound call', reqId);
                            backendHandler.GatherFromUserDetails(reqId, callerIdNum, contextTenant, ignoreTenant, function(err, fromUsr)
                            {
                                var dodActive = false;
                                var dodNumber = '';
                                var fromUserUuid = '';
                                if(fromUsr && fromUsr.Extension)
                                {
                                    //Check transfer capability and get transfer details

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

                                logger.debug('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Trying to pick inbound rule - Params - aniNum : %s, destNum : %s, domain : %s, companyId : %s, tenantId : %s', reqId, aniNum, destNum, domain, contextCompany, contextTenant);
                                ruleHandler.PickCallRuleInbound(reqId, callerIdNum, destNum, domain, tempCallerContext, contextCompany, contextTenant, function(err, rule)
                                {
                                    if(err)
                                    {
                                        logger.error('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - PickCallRuleInbound returned exception', reqId, err);
                                        var xml = xmlGen.createNotFoundResponse();

                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                        res.end(xml);
                                    }
                                    else if(rule)
                                    {
                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - PickCallRuleInbound returned rule : %s', reqId, JSON.stringify(rule));

                                        backendHandler.GetEmergencyNumber(destNum, rule.TenantId, function(err, emNum)
                                        {
                                            if(emNum)
                                            {
                                                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Emergency number detected - Trying to pick outbound rule', reqId, xml);
                                                //pick outbound rule and route to gateway
                                                ruleBackendHandler.PickCallRuleOutboundComplete(callerIdNum, destNum, '', callerContext, rule.CompanyId, rule.TenantId, true, function (err, rule)
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
                                                            Domain: rule.IpUrl
                                                        };

                                                        if(dodActive && dodNumber)
                                                        {
                                                            ep.Origination = dodNum;
                                                            ep.OriginationCallerIdNumber = dodNum;
                                                        }
                                                        else
                                                        {
                                                            ep.Origination = rule.ANI;
                                                            ep.OriginationCallerIdNumber = rule.ANI;
                                                        }

                                                        var xml = xmlBuilder.CreateRouteGatewayDialplan(reqId, ep, callerContext, profile, '[^\\s]*', false);

                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                        res.end(xml);
                                                    }
                                                    else
                                                    {
                                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Outbound rule not found for Emergency Number', reqId);
                                                        var xml = xmlGen.createNotFoundResponse();

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
                                                                    var xml = xmlGen.createNotFoundResponse();

                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                    res.end(xml);
                                                                }
                                                                else
                                                                {
                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Session data added to redis successfully - Key : %s_data', reqId, varUuid);

                                                                    var xml = xmlGen.CreateHttpApiDialplan('[^\\s]*', callerContext, masterUrl, reqId, undefined);

                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);
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
                                                                    var xml = xmlGen.createNotFoundResponse();

                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                    res.end(xml);
                                                                }
                                                                else
                                                                {
                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Session data added to redis successfully - Key : : %s_data', reqId, varUuid);

                                                                    var xml = xmlGen.CreateSocketApiDialplan('[^\\s]*', callerContext, masterUrl, reqId, undefined);

                                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                                    res.end(xml);
                                                                }

                                                            });
                                                        }
                                                        else if(masterApp.ObjType === 'EXTENDED')
                                                        {
                                                            data.DVPAppUrl = masterApp.Url;
                                                            data.AppId = masterApp.id;
                                                            extDialplanEngine.ProcessExtendedDialplan(reqId, decodedSipFromUri, decodedSipToUri, callerContext, direction, data, fromUsr, rule.CompanyId, rule.TenantId, 'test', undefined, function(err, extDialplan)
                                                            {
                                                                if(err)
                                                                {
                                                                    logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Error occurred processing extended dialplan for out call', reqId, err);
                                                                }

                                                                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, extDialplan);
                                                                res.end(extDialplan);
                                                            })
                                                        }
                                                        else
                                                        {
                                                            logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Master app object type invalid for out call', reqId);
                                                            var xml = xmlGen.createNotFoundResponse();

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
                                                            var xml = xmlGen.CreateHttpApiDialplan('[^\\s]*', callerContext, app.Url, reqId, undefined);

                                                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);
                                                            res.end(xml);

                                                        }
                                                        else if(app.ObjType === "SOCKET")
                                                        {
                                                            logger.info('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Master App Type is SOCKET', reqId);

                                                            var xml = xmlGen.CreateSocketApiDialplan('[^\\s]*', callerContext, app.Url, reqId, undefined);

                                                            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                            res.end(xml);
                                                        }
                                                        else if(app.ObjType === 'EXTENDED')
                                                        {
                                                            data.DVPAppUrl = app.Url;
                                                            data.AppId = app.id;
                                                            extDialplanEngine.ProcessExtendedDialplan(reqId, decodedSipFromUri, decodedSipToUri, callerContext, direction, data, fromUsr, rule.CompanyId, rule.TenantId, 'test', undefined, function(err, extDialplan)
                                                            {
                                                                if(err)
                                                                {
                                                                    logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Extended dialplan Error', reqId, err);
                                                                }

                                                                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, extDialplan);
                                                                res.end(extDialplan);
                                                            })
                                                        }
                                                        else
                                                        {
                                                            logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Master App Type Undefined - Terminating', reqId);
                                                            var xml = xmlGen.createNotFoundResponse();

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
                                                    var xml = xmlGen.createNotFoundResponse();

                                                    logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                                    res.end(xml);
                                                }

                                            }
                                        })


                                    }
                                    else
                                    {
                                        logger.error('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Call rule not found', reqId);
                                        var xml = xmlGen.createNotFoundResponse();

                                        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                                        res.end(xml);
                                    }
                                })
                            })


                        }


                    }
                }

            })



        }
        else
        {
            logger.error('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - cdnum OR callerContext OR hostname not found in request - Terminating', reqId);
            var xml = xmlGen.createNotFoundResponse();

            logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

            res.end(xml);
        }
    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.CallApp] - [%s] - Exception occurred on CallApp Api Method - Error : ', reqId, ex);
        var xml = xmlGen.createNotFoundResponse();

        logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

        res.end(xml);
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

        logger.debug('[DVP-DynamicConfigurationGenerator.LbRequestController] - [%s] - Request Params - direction : %s, number : %s', reqId, direction, number);

        if(direction === "in")
        {
            logger.info('[DVP-DynamicConfigurationGenerator.LbRequestController] - [%s] - call direction is IN', reqId);
            backendHandler.GetCloudForIncomingRequest(number, 0, function(err, cb)
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
                    res.end(",,");
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
            backendHandler.GetGatewayForOutgoingRequest(number, 0, function(err, cb)
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

                    res.end(",");
                }
                else
                {
                    var returnMessage = cb.InboundLimit + "," + cb.BothLimit + "," + cb.GwIpUrl;

                    logger.debug('[DVP-DynamicConfigurationGenerator.LbRequestController] - [%s] - GetGatewayForOutgoingRequest object found - Returning Gateway Details : %s', reqId, returnMessage);

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

        backendHandler.GetCallServersForEndUserDB(reqId, companyId, tenantId, function(err, csList)
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

            backendHandler.GetGroupBy_Name_Domain(group, tempAuthRealm, function(err, result)
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

            backendHandler.GetUserBy_Name_Domain(user, tempAuthRealm, function(err, usr)
            {
                if(err)
                {
                    logger.error('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - backendHandler.GetUserBy_Name_Domain threw an exception', reqId, err);
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

                        var xml = xmlGen.createDirectoryProfile(usr.SipUsername, usr.SipExtension, usr.CloudEndUser.Domain, usr.EmailAddress, usr.Password, usr.ContextId, reqId);

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

            backendHandler.GetUserBy_Ext_Domain(user, tempAuthRealm, function(err, usr){

                if(!err && usr)
                {
                    logger.debug('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - backendHandler.GetUserBy_Ext_Domain returned user : %s', reqId, JSON.stringify(usr));
                    //create xml
                    if(usr.CloudEndUser)
                    {
                        logger.debug('[DVP-DynamicConfigurationGenerator.DirectoryProfile] - [%s] - User Has a Cloud End User', reqId);
                        var xml = xmlGen.createDirectoryProfile(usr.SipUsername, usr.SipExtension, usr.CloudEndUser.Domain, usr.EmailAddress, usr.Password, usr.ContextId, reqId);

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
            backendHandler.GetGatewayListForCallServerProfile(profile, csId, reqId, function(err, result)
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


server.listen(hostPort, hostIp, function () {
    console.log('%s listening at %s', server.name, server.url);
});