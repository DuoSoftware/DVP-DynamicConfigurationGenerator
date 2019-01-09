var dialplanBuilder = require('./XmlExtendedDialplanBuilder.js');
var backendFactory = require('./BackendFactory.js');

var AgentDial = function(reqId, context, recordingEnabled, extension, customerNumber, companyId, tenantId, csId, res)
{
    backendFactory.getBackendHandler().GetAllDataForExt(reqId, extension, companyId, tenantId, 'USER', csId, null, function(err, extDetails)
    {
        if(err || !extDetails)
        {
            var xml = xmlBuilder.createRejectDefault(context);
            res.end(xml);
        }
        else
        {
            if (extDetails.SipUACEndpoint && extDetails.SipUACEndpoint.CloudEndUser)
            {
                logger.debug('DVP-DynamicConfigurationGenerator.AgentDial] - [%s] - Cloud enduser is set', reqId);

                var domain = '';

                if(extDetails.SipUACEndpoint && extDetails.SipUACEndpoint.CloudEndUser)
                {
                    domain = extDetails.SipUACEndpoint.CloudEndUser.Domain;
                }

                var attTransInfo = AttendantTransferLegInfoHandler(reqId, null, extDetails.SipUACEndpoint);

                var xml = dialplanBuilder.CreateRouteDialerAgentDialplan(reqId, context, '[^\\s]*', attTransInfo, 60, customerNumber, extension, domain, recordingEnabled, tenantId, companyId);

                res.end(xml);


            }
            else
            {
                logger.debug('DVP-DynamicConfigurationGenerator.ProcessCallForwarding] - [%s] - Cloud enduser not set', reqId);
                callback(undefined, xmlBuilder.createRejectResponse());
            }

        }

    });


};

module.exports.AgentDial = AgentDial;