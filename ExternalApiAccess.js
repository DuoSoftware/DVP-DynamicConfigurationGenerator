'use strict';

var httpReq = require('request');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var config = require('config');
var Promise = require('bluebird');
var util = require('util');
var validator = require('validator');

var token = config.Token;

var dccaclientHost = config.Services.dccaclientHost;
var dccaclientPort = config.Services.dccaclientPort;
var dccaclientVersion = config.Services.dccaclientVersion;
var billingEnabled = config.billingEnabled;

var RemoteGetDialplanConfig = function(reqId, ani, dnis, context, direction, userUuid, fromUserUuid, opType, extExtraData, appId, url, companyId, tenantId, securityToken, callback)
{
    try
    {
            logger.debug('[DVP-PBXService.RemoteGetPBXDialplanConfig] - [%s] -  Trying to get pbx details from pbx app', reqId);

            securityToken = 'bearer ' + securityToken;

            var httpUrl = url;

            var jsonObj = { ANI: ani, DNIS: dnis, Context: context, Direction: direction, ExtraData: {UserUuid: userUuid, FromUserUuid: fromUserUuid, OperationType: opType, ExtExtraData: extExtraData, AppId: appId, CompanyId: companyId, TenantId: tenantId} };

            var compInfo = tenantId + ':' + companyId;

            var jsonStr = JSON.stringify(jsonObj);

            var options = {
                url: httpUrl,
                method: 'POST',
                headers: {
                    'authorization': securityToken,
                    'companyinfo': compInfo,
                    'content-type': 'application/json'
                },
                body: jsonStr
            };

            logger.debug('[DVP-PBXService.RemoteGetPBXDialplanConfig] - [%s] - Creating Api Url : %s', reqId, httpUrl);


            httpReq.post(options, function (error, response, body)
            {
                if (!error && response.statusCode == 200)
                {
                    var apiResp = JSON.parse(body);

                    logger.debug('[DVP-PBXService.RemoteGetPBXDialplanConfig] - [%s] - Extended Dialplan Api returned : %s', reqId, body);

                    callback(undefined, apiResp);
                }
                else
                {
                    logger.error('[DVP-PBXService.RemoteGetPBXDialplanConfig] - [%s] - Extended Dialplan Api call failed', reqId, error);
                    callback(error, undefined);
                }
            })
    }
    catch(ex)
    {
        logger.error('[DVP-PBXService.RemoteGetPBXDialplanConfig] - [%s] - Exception occurred', reqId, ex);
        callback(ex, undefined);
    }
};

var CheckBalance = function(reqId, uuid, from, to, type, provider, companyId, tenantId)
{
    return new Promise(function(fulfill, reject)
    {
        try
        {
            if(billingEnabled == 'true')
            {
                logger.debug('[DVP-DynamicConfigurationGenerator.CheckBalance] - [%s] -  check balance', reqId);

                var httpUrl = util.format('http://%s/DVP/API/%s/dcca/checkbalance', dccaclientHost, dccaclientVersion);

                if(validator.isIP(dccaclientHost))
                {
                    httpUrl = util.format('http://%s:%s/DVP/API/%s/dcca/checkbalance', dccaclientHost, dccaclientPort, dccaclientVersion);
                }

                var jsonObj = { csid: uuid, to: to, from: from, type: type, provider: provider };

                var compInfo = tenantId + ':' + companyId;

                var jsonStr = JSON.stringify(jsonObj);

                var options = {
                    url: httpUrl,
                    method: 'POST',
                    headers: {
                        'authorization': 'bearer ' + token,
                        'companyinfo': compInfo,
                        'content-type': 'application/json'
                    },
                    body: jsonStr
                };

                logger.debug('[DVP-DynamicConfigurationGenerator.CheckBalance] - [%s] - Creating Api Url : %s', reqId, httpUrl);


                httpReq.post(options, function (error, response, body)
                {
                    if (!error && response.statusCode == 200)
                    {
                        var apiResp = JSON.parse(body);

                        logger.debug('[DVP-DynamicConfigurationGenerator.CheckBalance] - [%s] - Check balance Api returned : %s', reqId, body);

                        fulfill(apiResp);
                    }
                    else
                    {
                        logger.error('[DVP-DynamicConfigurationGenerator.CheckBalance] - [%s] - Check balance Api call failed', reqId, error);
                        reject(error);
                    }
                })
            }
            else
            {
                var tempObj = {
                    IsSuccess: true
                };

                fulfill(tempObj);
            }


        }
        catch(ex)
        {
            logger.error('[DVP-DynamicConfigurationGenerator.CheckBalance] - [%s] - Exception occurred', reqId, ex);
            reject(ex);
        }
    })

};

module.exports.RemoteGetDialplanConfig = RemoteGetDialplanConfig;
module.exports.CheckBalance = CheckBalance;