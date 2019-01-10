var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var dialplanBuilder = require('./XmlExtendedDialplanBuilder.js');
var extDialplanEngine = require('./ExtendedDialplanEngine.js');
var backendFactory = require('./BackendFactory.js');

var AgentDial = function(reqId, context, recordingEnabled, extension, customerNumber, companyId, tenantId, csId, agentPubKey, campaignId, skill, res)
{
    backendFactory.getBackendHandler().GetAllDataForExt(reqId, extension, companyId, tenantId, 'USER', csId, null, function(err, extDetails)
    {
        if(err || !extDetails)
        {
            var xml = dialplanBuilder.createRejectDefault(context);
            res.end(xml);
        }
        else
        {
            if (extDetails.SipUACEndpoint && extDetails.SipUACEndpoint.CloudEndUser)
            {

                var domain = '';

                if(extDetails.SipUACEndpoint && extDetails.SipUACEndpoint.CloudEndUser)
                {
                    domain = extDetails.SipUACEndpoint.CloudEndUser.Domain;
                }

                var attTransInfo = extDialplanEngine.AttendantTransferLegInfoHandler(reqId, null, extDetails.SipUACEndpoint);

                var xml = dialplanBuilder.CreateRouteDialerAgentDialplan(reqId, context, '[^\\s]*', attTransInfo, 60, customerNumber, extension, domain, recordingEnabled, tenantId, companyId, agentPubKey, campaignId, skill);

                logger.debug('DVP-DynamicConfigurationGenerator.CallApp] - [%s] - API RESPONSE : %s', reqId, xml);

                res.end(xml);


            }
            else
            {
                logger.debug('DVP-DynamicConfigurationGenerator.ProcessCallForwarding] - [%s] - Cloud enduser not set', reqId);
                callback(undefined, dialplanBuilder.createRejectResponse());
            }

        }

    });


};

module.exports.AgentDial = AgentDial;