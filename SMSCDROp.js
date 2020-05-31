/**
 * Created by dinusha on 6/14/2016.
 */
var logger = require('dvp-common-lite/LogHandler/CommonLogHandler.js').logger;
var dbModel = require('dvp-dbmodels');

var SaveSmsCdr = function(reqId, fromNumber, toNumber, errorReason, isSuccess, direction, appId, message, companyId, tenantId)
{
    try
    {
        var smsCdr = dbModel.SMSCDR.build({

            FromNumber: fromNumber,
            ToNumber: toNumber,
            ErrorReason: errorReason,
            IsSuccess: isSuccess,
            Direction: direction,
            HandledTime: new Date(),
            AppId: appId,
            Message: message,
            CompanyId: companyId,
            TenantId: tenantId
        });

        smsCdr
            .save()
            .then(function (resp)
            {
                logger.debug('[DVP-DynamicConfigurationGenerator.SaveSmsCdr] - [%s] - Save Success', reqId);

            }).catch(function(err)
            {
                logger.error('[DVP-DynamicConfigurationGenerator.SaveSmsCdr] - [%s] - Save Failed', reqId, err);
            })
    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.SaveSmsCdr] - [%s] - Save Failed', reqId, ex);
    }


};


module.exports.SaveSmsCdr = SaveSmsCdr;