var xmlBuilder = require('xmlbuilder');
var config = require('config');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var util = require('util');
var sf = require('stringformat');
var validator = require('validator');

var fileServiceIp = config.Services.fileServiceHost;
var fileServicePort = config.Services.fileServicePort;
var fileServiceVersion = config.Services.fileServiceVersion;

var allowCodecPref = config.Host.AllowCodecConfigure;

var createRejectResponse = function(context)
{
    try
    {
        var tempContext = 'public';

        if(context)
        {
            tempContext = context;
        }
        var doc = xmlBuilder.create('document');

        var cond = doc.att('type', 'freeswitch/xml')
            .ele('section').att('name', 'dialplan').att('description', 'RE Dial Plan For FreeSwitch')
            .ele('context').att('name', tempContext)
            .ele('extension').att('name', 'test')
            .ele('condition').att('field', 'destination_number').att('expression', '[^\\s]*')

        cond.ele('action').att('application', 'set').att('data', 'DVP_OPERATION_CAT=REJECTED')
            .up()
        cond.ele('action').att('application', 'hangup').att('data', 'CALL_REJECTED')
            .up()

            .end({pretty: true});


        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\r\n" + doc.toString({pretty: true});


    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.CreateSendBusyMessageDialplan] - [%s] - Exception occurred creating xml', ex);
        return createNotFoundResponse();
    }
}

var createNotFoundResponse = function()
{
    try
    {
        var doc = xmlBuilder.create('document');
        doc.att('type', 'freeswitch/xml')
            .ele('section').att('name', 'result')
            .ele('result').att('status', 'not found')
            .up()
            .up()
            .end({pretty: true});

        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\r\n" + doc.toString({pretty: true});
    }
    catch(ex)
    {
        return createNotFoundResponse();
    }

};

var CreatePbxFeatures = function(reqId, destNum, pbxType, domain, trunkNumber, trunkCode, companyId, tenantId, appId, context, transferCodes, ardsClientUuid)
{
    try
    {

        if (!destNum) {
            destNum = "";
        }

        if (!pbxType) {
            pbxType = "";
        }

        if (!domain) {
            domain = "";
        }

        if (!companyId) {
            companyId = -1;
        }

        if (!tenantId) {
            tenantId = -1;
        }

        if (!appId) {
            appId = -1;
        }


        var doc = xmlBuilder.create('document');

        var cond = doc.att('type', 'freeswitch/xml')
            .ele('section').att('name', 'dialplan').att('description', 'RE Dial Plan For FreeSwitch')
            .ele('context').att('name', context)
            .ele('extension').att('name', destNum)
            .ele('condition').att('field', 'destination_number').att('expression', '^' + destNum + '$')


        if(pbxType == 'gateway')
        {
            cond.ele('action').att('application', 'read').att('data', "9 15 'tone_stream://%(10000,0,350,440)' digits 30000 #")
                .up()
                .ele('action').att('application', 'set').att('data', 'origination_cancel_key=#')
                .up()
                .ele('action').att('application', 'set').att('data', 'transfer_ringback=$${us-ring}')
                .up()
                .ele('action').att('application', 'set').att('data', 'sip_h_DVP-DESTINATION-TYPE=GATEWAY')
                .up()
                .ele('action').att('application', 'set').att('data', 'DVP_OPERATION_CAT=ATT_XFER_GATEWAY')
                .up()
                .ele('action').att('application', 'att_xfer').att('data', '{origination_caller_id_number=' + trunkNumber + ',companyid=' + companyId + ',tenantid=' + tenantId + ',dvp_app_id=' + appId + '}sofia/gateway/' + trunkCode + '/${digits}')
                .up()
                .end({pretty: true});
        }
        else if(pbxType === 'ivr')
        {
            cond.ele('action').att('application', 'read').att('data', "3 6 'tone_stream://%(10000,0,350,440)' digits 30000 #")
                .up()
                .ele('action').att('application', 'set').att('data', 'origination_cancel_key=#')
                .up()
                .ele('action').att('application', 'set').att('data', 'DVP_OPERATION_CAT=ATT_XFER_IVR')
                .up()
                .ele('action').att('application', 'transfer').att('data', '-bleg ${digits} XML PBXFeatures|' + tenantId + '|' + companyId)
                .up()
                .end({pretty: true});

        }
        else
        {
            cond.ele('action').att('application', 'read').att('data', "3 6 'tone_stream://%(10000,0,350,440)' digits 30000 #")
                .up()
                .ele('action').att('application', 'set').att('data', 'origination_cancel_key=#')
                .up()
                .ele('action').att('application', 'set').att('data', 'transfer_ringback=$${us-ring}')
                .up()
                .ele('action').att('application', 'set').att('data', 'DVP_OPERATION_CAT=ATT_XFER_USER')
                .up()

            if(transferCodes)
            {
                if(transferCodes.InternalTransfer != null && transferCodes.InternalTransfer != undefined)
                {
                    cond.ele('action').att('application', 'bind_meta_app').att('data', transferCodes.InternalTransfer + ' b s execute_extension::att_xfer XML PBXFeatures')
                        .up()
                }

                if(transferCodes.ExternalTransfer != null && transferCodes.ExternalTransfer != undefined)
                {
                    cond.ele('action').att('application', 'bind_meta_app').att('data', transferCodes.ExternalTransfer + ' b s execute_extension::att_xfer_outbound XML PBXFeatures')
                        .up()
                }

                if(transferCodes.GroupTransfer != null && transferCodes.GroupTransfer != undefined)
                {
                    cond.ele('action').att('application', 'bind_meta_app').att('data', transferCodes.GroupTransfer + ' b s execute_extension::att_xfer_group XML PBXFeatures')
                        .up()
                }

                if(transferCodes.ConferenceTransfer != null && transferCodes.ConferenceTransfer != undefined)
                {
                    cond.ele('action').att('application', 'bind_meta_app').att('data', transferCodes.ConferenceTransfer + ' b s execute_extension::att_xfer_conference XML PBXFeatures')
                        .up()
                }

                if(transferCodes.IVRTransfer != null && transferCodes.IVRTransfer != undefined)
                {
                    cond.ele('action').att('application', 'bind_meta_app').att('data', transferCodes.IVRTransfer + ' b s execute_extension::att_xfer_ivr XML PBXFeatures')
                        .up()
                }

            }

            if(ardsClientUuid)
            {
                cond.ele('action').att('application', 'att_xfer').att('data', '{companyid=' + companyId + ',ards_client_uuid=' + ardsClientUuid + ',tenantid=' + tenantId + ',DVP_OPERATION_CAT=ATT_XFER_USER,dvp_app_id=' + appId + '}' + pbxType + '/${digits}@' + domain)
                    .up()
                    .end({pretty: true});
            }
            else
            {
                cond.ele('action').att('application', 'att_xfer').att('data', '{companyid=' + companyId + ',tenantid=' + tenantId + ',DVP_OPERATION_CAT=ATT_XFER_USER,dvp_app_id=' + appId + '}' + pbxType + '/${digits}@' + domain)
                    .up()
                    .end({pretty: true});
            }




        }


        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\r\n" + doc.toString({pretty: true});

    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.CreatePbxFeatures] - [%s] - Exception occurred creating xml', reqId, ex);
        return createNotFoundResponse();
    }
};

var CreatePbxFeaturesGateway = function(reqId, destNum, trunkNumber, trunkCode, companyId, tenantId, appId, context, digits, operator, trunkIp)
{
    try
    {

        if (!destNum) {
            destNum = "";
        }

        if (!companyId) {
            companyId = -1;
        }

        if (!tenantId) {
            tenantId = -1;
        }

        if (!appId) {
            appId = -1;
        }


        var doc = xmlBuilder.create('document');

        var cond = doc.att('type', 'freeswitch/xml')
            .ele('section').att('name', 'dialplan').att('description', 'RE Dial Plan For FreeSwitch')
            .ele('context').att('name', context)
            .ele('extension').att('name', destNum)
            .ele('condition').att('field', 'destination_number').att('expression', '^' + destNum + '$')

        if(companyId)
        {
            cond.ele('action').att('application', 'export').att('data', 'companyid=' + companyId)
                .up()
        }
        if(tenantId)
        {
            cond.ele('action').att('application', 'export').att('data', 'tenantid=' + tenantId)
                .up()
        }

        if(operator)
        {
            cond.ele('action').att('application', 'export').att('data', 'veeryoperator=' + operator)
                .up()
        }


        cond.ele('action').att('application', 'set').att('data', 'sip_h_DVP-DESTINATION-TYPE=GATEWAY')
            .up()
            .ele('action').att('application', 'export').att('data', 'DVP_OPERATION_CAT=ATT_XFER_GATEWAY')
            .up()
            .ele('action').att('application', 'export').att('data', 'DVP_CALL_DIRECTION=outbound')
            .up()
            .ele('action').att('application', 'att_xfer').att('data', '{origination_caller_id_number=' + trunkNumber + ',dvp_app_id=' + appId + 'sip_h_X-Gateway=' + trunkIp + '}sofia/gateway/' + trunkCode + '/' +digits)
            .up()
            .end({pretty: true});


        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\r\n" + doc.toString({pretty: true});

    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.CreatePbxFeatures] - [%s] - Exception occurred creating xml', reqId, ex);
        return createNotFoundResponse();
    }
};

var CreateAttendantTransferGW = function(reqId, destNum, context)
{
    try
    {

        if (!destNum) {
            destNum = "";
        }


        var doc = xmlBuilder.create('document');

        var cond = doc.att('type', 'freeswitch/xml')
            .ele('section').att('name', 'dialplan').att('description', 'RE Dial Plan For FreeSwitch')
            .ele('context').att('name', context)
            .ele('extension').att('name', destNum)
            .ele('condition').att('field', 'destination_number').att('expression', '^' + destNum + '$');


        cond.ele('action').att('application', 'read').att('data', "9 15 'tone_stream://%(10000,0,350,440)' digits 30000 #")
            .up()
            .ele('action').att('application', 'set').att('data', 'origination_cancel_key=#')
            .up()
            .ele('action').att('application', 'set').att('data', 'transfer_ringback=$${us-ring}')
            .up()
            .ele('action').att('application', 'set').att('data', 'sip_h_DVP-DESTINATION-TYPE=GATEWAY')
            .up()
            .ele('action').att('application', 'execute_extension').att('data', 'gwtransfer XML PBXFeatures')
            .up();


            cond.end({pretty: true});


        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\r\n" + doc.toString({pretty: true});

    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.CreatePbxFeatures] - [%s] - Exception occurred creating xml', reqId, ex);
        return createNotFoundResponse();
    }
};

var CreateSendBusyMessageDialplan = function(reqId, destinationPattern, context, numLimitInfo, companyId, tenantId, appId, dvpCallDirection)
{
    try
    {
        if (!destinationPattern) {
            destinationPattern = "";
        }

        if (!context) {
            context = "";
        }


        var doc = xmlBuilder.create('document');

        var cond = doc.att('type', 'freeswitch/xml')
            .ele('section').att('name', 'dialplan').att('description', 'RE Dial Plan For FreeSwitch')
            .ele('context').att('name', context)
            .ele('extension').att('name', 'test')
            .ele('condition').att('field', 'destination_number').att('expression', destinationPattern)


        if(companyId)
        {
            cond.ele('action').att('application', 'export').att('data', 'companyid=' + companyId)
                .up()
        }
        if(tenantId)
        {
            cond.ele('action').att('application', 'export').att('data', 'tenantid=' + tenantId)
                .up()
        }
        if(appId)
        {
            cond.ele('action').att('application', 'export').att('data', 'dvp_app_id=' + appId)
                .up()
        }

        if(dvpCallDirection)
        {
            cond.ele('action').att('application', 'export').att('data', 'DVP_CALL_DIRECTION=' + dvpCallDirection)
                .up()
        }

        cond.ele('action').att('application', 'set').att('data', 'DVP_ACTION_CAT=DND')
            .up()

        if(numLimitInfo && numLimitInfo.CheckLimit)
        {
            if(numLimitInfo.NumType === 'INBOUND')
            {
                var limitStr = util.format('hash %d_%d_inbound %s %d !USER_BUSY', numLimitInfo.TenantId, numLimitInfo.CompanyId, numLimitInfo.TrunkNumber, numLimitInfo.InboundLimit);
                cond.ele('action').att('application', 'limit').att('data', limitStr)
                    .up()
            }
            else if(numLimitInfo.NumType === 'BOTH')
            {
                if(numLimitInfo.InboundLimit)
                {
                    var limitStr = util.format('hash %d_%d_inbound %s %d !USER_BUSY', numLimitInfo.TenantId, numLimitInfo.CompanyId, numLimitInfo.TrunkNumber, numLimitInfo.InboundLimit);
                    cond.ele('action').att('application', 'limit').att('data', limitStr)
                        .up()
                }

                if(numLimitInfo.BothLimit)
                {
                    var limitStr = util.format('hash %d_%d_both %s %d !USER_BUSY', numLimitInfo.TenantId, numLimitInfo.CompanyId, numLimitInfo.TrunkNumber, numLimitInfo.BothLimit);
                    cond.ele('action').att('application', 'limit').att('data', limitStr)
                        .up()
                }
            }

        }



        cond.ele('action').att('application', 'hangup').att('data', 'USER_BUSY')
            .up()

            .end({pretty: true});


        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\r\n" + doc.toString({pretty: true});


    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.CreateSendBusyMessageDialplan] - [%s] - Exception occurred creating xml', reqId, ex);
        return createNotFoundResponse();
    }

};

var CreateConferenceDialplan = function(reqId, epList, context, destinationPattern, ignoreEarlyMedia, confName, domain, pin, mode, companyId, tenantId, appId, dvpCallDirection, template)
{
    try
    {
        if (!destinationPattern) {
            destinationPattern = "";
        }

        if (!context) {
            context = "";
        }

        var ignoreEarlyM = "ignore_early_media=false";
        if (ignoreEarlyMedia)
        {
            ignoreEarlyM = "ignore_early_media=true";
        }

        var doc = xmlBuilder.create('document');

        var cond = doc.att('type', 'freeswitch/xml')
            .ele('section').att('name', 'dialplan').att('description', 'RE Dial Plan For FreeSwitch')
            .ele('context').att('name', context)
            .ele('extension').att('name', 'test')
            .ele('condition').att('field', 'destination_number').att('expression', destinationPattern)

        cond.ele('action').att('application', 'set').att('data', 'ringback=${us-ring}')
            .up()

        cond.ele('action').att('application', 'set').att('data', 'DVP_ACTION_CAT=CONFERENCE')
            .up()
            .ele('action').att('application', 'set').att('data', 'DVP_OPERATION_CAT=CONFERENCE_DIAL_IN')
            .up()
            .ele('action').att('application', 'set').att('data', 'DVP_CONFERENCE_NAME=' + confName)
            .up()


        if(companyId)
        {
            cond.ele('action').att('application', 'export').att('data', 'companyid=' + companyId)
                .up()
        }
        if(tenantId)
        {
            cond.ele('action').att('application', 'export').att('data', 'tenantid=' + tenantId)
                .up()
        }
        if(appId)
        {
            cond.ele('action').att('application', 'export').att('data', 'dvp_app_id=' + appId)
                .up()
        }
        if(dvpCallDirection)
        {
            cond.ele('action').att('application', 'export').att('data', 'DVP_CALL_DIRECTION=' + dvpCallDirection)
                .up()
        }

        if(epList)
        {
            if(epList && epList.length > 0)
            {
                cond.ele('action').att('application', 'set').att('data', 'conference_auto_outcall_timeout=60')
                    .up()
                    .ele('action').att('application', 'set').att('data', 'conference_auto_outcall_flags=none')
                    .up()
                    //.ele('action').att('application', 'set').att('data', 'conference_auto_outcall_profile=default')
                    //.up()
            }

            epList.forEach(function(ep)
            {
                var option = '';
                var destinationGroup = '';

                if(ep.Type === 'GATEWAY')
                {
                    destinationGroup = util.format('gateway/%s', ep.Profile);

                    if (ep.LegStartDelay > 0)
                        option = util.format("['leg_delay_start=%d,leg_timeout=%d,origination_caller_id_name=%s,origination_caller_id_number=%s,sip_h_X-Gateway=%s,DVP_OPERATION_CAT=%s, DVP_ACTION_CAT=%s, companyid=%s,tenantid=%s,dvp_app_id=%s,DVP_CONFERENCE_NAME=%s,DVP_CALL_DIRECTION=outbound']", ep.LegStartDelay, ep.LegTimeout, ep.Origination, ep.OriginationCallerIdNumber, ep.IpUrl, 'GATEWAY', 'CONFERENCE', companyId, tenantId, appId, confName);
                    else
                        option = util.format("['leg_timeout=%d,origination_caller_id_name=%s,origination_caller_id_number=%s,sip_h_X-Gateway=%s,DVP_OPERATION_CAT=%s, DVP_ACTION_CAT=%s, companyid=%s,tenantid=%s,dvp_app_id=%s,DVP_CONFERENCE_NAME=%s,DVP_CALL_DIRECTION=outbound']", ep.LegTimeout, ep.Origination, ep.OriginationCallerIdNumber, ep.IpUrl, 'GATEWAY', 'CONFERENCE', companyId, tenantId, appId, confName);

                }
                else
                {
                    destinationGroup = 'user';

                    if (ep.LegStartDelay > 0)
                        option = util.format("['leg_delay_start=%d,leg_timeout=%d,origination_caller_id_name=%s,origination_caller_id_number=%s,DVP_OPERATION_CAT=%s, DVP_ACTION_CAT=%s, companyid=%s,tenantid=%s,dvp_app_id=%s,DVP_CONFERENCE_NAME=%s,DVP_CALL_DIRECTION=outbound']", ep.LegStartDelay, ep.LegTimeout, ep.Origination, ep.OriginationCallerIdNumber, 'USER', 'CONFERENCE', companyId, tenantId, appId, confName);
                    else
                        option = util.format("['leg_timeout=%d,origination_caller_id_name=%s,origination_caller_id_number=%s,DVP_OPERATION_CAT=%s, DVP_ACTION_CAT=%s, companyid=%s,tenantid=%s,dvp_app_id=%s,DVP_CONFERENCE_NAME=%s,DVP_CALL_DIRECTION=outbound']", ep.LegTimeout, ep.Origination, ep.OriginationCallerIdNumber, 'USER', 'CONFERENCE', companyId, tenantId, appId, confName);

                }

                var dnis = ep.Destination;

                if (domain)
                {
                    dnis = util.format('%s@%s', ep.Destination, ep.Domain);
                }

                var protocol = 'sofia';
                var calling = '';

                if(ep.Type === 'GATEWAY')
                {
                    calling = util.format('%s%s/%s/%s', option, protocol, destinationGroup, dnis);
                }
                else
                {
                    calling = util.format('%s%s/%s', option, destinationGroup, dnis);
                }


                cond.ele('action').att('application', 'conference_set_auto_outcall').att('data', calling)
                    .up()

            });
        }

        if(mode)
        {

            var confStr = confName + '@' + template + '+' + pin + '+flags{' + mode + '}';
            cond.ele('action').att('application', 'conference').att('data', confStr)
                .up()
        }
        else
        {

            var confStr = confName + '@' + template + '+' + pin;
            cond.ele('action').att('application', 'conference').att('data', confStr)
                .up()
        }



        cond.end({pretty: true});


        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\r\n" + doc.toString({pretty: true});



    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.CreateSendBusyMessageDialplan] - [%s] - Exception occurred creating xml', reqId, ex);
        return createNotFoundResponse();
    }

};

var CreateRouteUserDialplan = function(reqId, ep, context, profile, destinationPattern, ignoreEarlyMedia, numLimitInfo, transferLegInfo, dvpCallDirection, codecList)
{
    try
    {
        if (!destinationPattern) {
            destinationPattern = "";
        }

        if (!context) {
            context = "";
        }

        var bypassMedia = "bypass_media=true";
        if (!ep.BypassMedia)
        {
            bypassMedia = "bypass_media=false";
        }

        var ignoreEarlyM = "ignore_early_media=false";
        if (ignoreEarlyMedia && ep.Type != 'GROUP')
        {
            ignoreEarlyM = "ignore_early_media=true";
        }

        var option = '';

        var codecListString = null;

        if(codecList)
        {
            codecList = JSON.parse(codecList);
        }


        if(codecList && codecList.length > 0)
        {
            codecListString = codecList.join();
        }

        option = util.format('[leg_timeout=%d, origination_caller_id_name=%s,origination_caller_id_number=%s', ep.LegTimeout, ep.Origination, ep.OriginationCallerIdNumber);

        if (ep.LegStartDelay > 0)
        {
            option = option + ', leg_delay_start=' + ep.LegStartDelay;
        }

        if(dvpCallDirection === 'outbound' && ep.Type !== 'GROUP')
        {
            option = option + ', origination_uuid=${my_uuid}';
        }

        if(codecListString && allowCodecPref)
        {
            option = option + ', absolute_codec_string=\'' + codecListString + '\'';
        }

        option = option + ']';

        /*if(dvpCallDirection === 'outbound' && ep.Type !== 'GROUP')
        {
            if (ep.LegStartDelay > 0)
                option = util.format('[leg_delay_start=%d, origination_uuid=${my_uuid}, leg_timeout=%d,origination_caller_id_name=%s,origination_caller_id_number=%s]', ep.LegStartDelay, ep.LegTimeout, ep.Origination, ep.OriginationCallerIdNumber);
            else
                option = util.format('[leg_timeout=%d, origination_uuid=${my_uuid}, origination_caller_id_name=%s,origination_caller_id_number=%s]', ep.LegTimeout, ep.Origination, ep.OriginationCallerIdNumber);
        }
        else
        {
            if (ep.LegStartDelay > 0)
                option = util.format('[leg_delay_start=%d, leg_timeout=%d,origination_caller_id_name=%s,origination_caller_id_number=%s]', ep.LegStartDelay, ep.LegTimeout, ep.Origination, ep.OriginationCallerIdNumber);
            else
                option = util.format('[leg_timeout=%d, origination_caller_id_name=%s,origination_caller_id_number=%s]', ep.LegTimeout, ep.Origination, ep.OriginationCallerIdNumber);
        }*/

        //var httpUrl = Config.Services.HttApiUrl;

        var dnis = ep.Destination;

        if (ep.Domain)
        {
            dnis = util.format('%s@%s', dnis, ep.Domain);
        }
        var protocol = 'sofia';
        var destinationGroup = 'user';

        if(ep.Type === 'GROUP')
        {
            destinationGroup = 'group';
        }
        else if(ep.Type === 'PUBLIC_USER')
        {
            destinationGroup = protocol + '/' + ep.Profile;
        }

        var calling = util.format('%s%s/%s', option, destinationGroup, dnis);

        if(ep.Type === 'USER')
        {
            if (ep.Group)
            {
                calling = util.format("%s,pickup/%s", calling, ep.Group);
            }
        }

        var doc = xmlBuilder.create('document');

        var cond = doc.att('type', 'freeswitch/xml')
            .ele('section').att('name', 'dialplan').att('description', 'RE Dial Plan For FreeSwitch')
            .ele('context').att('name', context)
            .ele('extension').att('name', 'test')
            .ele('condition').att('field', 'destination_number').att('expression', destinationPattern)

        if(dvpCallDirection === 'outbound' && ep.Type !== 'GROUP')
        {
            cond.ele('action').att('application', 'set').att('data', 'my_uuid=${create_uuid()}').att('inline', 'true')
                .up()
        }

        cond.ele('action').att('application', 'set').att('data', 'ringback=${us-ring}')
            .up()
            .ele('action').att('application', 'set').att('data', 'continue_on_fail=true')
            .up()
            .ele('action').att('application', 'set').att('data', 'hangup_after_bridge=true')
            .up()
            .ele('action').att('application', 'set').att('data', ignoreEarlyM)
            .up()
            .ele('action').att('application', 'set').att('data', bypassMedia)
            .up()

        if(ep.Type === 'GROUP')
        {
            cond.ele('action').att('application', 'set').att('data', 'originate_continue_on_timeout=true')
                .up();

        }

        if(ep.Action)
        {
            cond.ele('action').att('application', 'export').att('data', 'DVP_ACTION_CAT=' + ep.Action)
            .up()
        }

        if(ep.RecordEnabled)
        {
            if(dvpCallDirection === 'outbound')
            {
                var fileUploadUrl = 'http://' + fileServiceIp + ':' + fileServicePort + '/DVP/API/' + fileServiceVersion + '/InternalFileService/File/Upload/' + ep.TenantId + '/' + ep.CompanyId;

                if(!validator.isIP(fileServiceIp))
                {
                    fileUploadUrl = 'http://' + fileServiceIp + '/DVP/API/' + fileServiceVersion + '/InternalFileService/File/Upload/' + ep.TenantId + '/' + ep.CompanyId;
                }

                var fileSavePath = '$${base_dir}/recordings/${my_uuid}.mp3';

                var playFileDetails = 'record_post_process_exec_api=curl_sendfile:' + fileUploadUrl + ' file=${dvpRecFile} class=CALLSERVER&type=CALL&category=CONVERSATION&referenceid=${my_uuid}&mediatype=audio&filetype=wav&sessionid=${my_uuid}&display=' + ep.Destination + '-${origination_caller_id_number}';


                cond.ele('action').att('application', 'set').att('data', 'dvpRecFile=' + fileSavePath)
                    .up()
                    .ele('action').att('application', 'export').att('data', 'execute_on_answer=record_session ${dvpRecFile}')
                    .up()
                    .ele('action').att('application', 'set').att('data', playFileDetails)
                    .up()

            }
            else
            {
                var fileUploadUrl = 'http://' + fileServiceIp + ':' + fileServicePort + '/DVP/API/' + fileServiceVersion + '/InternalFileService/File/Upload/' + ep.TenantId + '/' + ep.CompanyId;

                if(!validator.isIP(fileServiceIp))
                {
                    fileUploadUrl = 'http://' + fileServiceIp + '/DVP/API/' + fileServiceVersion + '/InternalFileService/File/Upload/' + ep.TenantId + '/' + ep.CompanyId;
                }

                var fileSavePath = '$${base_dir}/recordings/${uuid}.mp3';

                var playFileDetails = 'record_post_process_exec_api=curl_sendfile:' + fileUploadUrl + ' file=${dvpRecFile} class=CALLSERVER&type=CALL&category=CONVERSATION&referenceid=${uuid}&mediatype=audio&filetype=wav&sessionid=${uuid}&display=' + ep.Destination + '-${origination_caller_id_number}';


                cond.ele('action').att('application', 'set').att('data', 'dvpRecFile=' + fileSavePath)
                    .up()
                    .ele('action').att('application', 'export').att('data', 'execute_on_answer=record_session ${dvpRecFile}')
                    .up()
                    .ele('action').att('application', 'set').att('data', playFileDetails)
                    .up()
            }


        }

        if(ep.Type === 'PUBLIC_USER')
        {
            cond.ele('action').att('application', 'set').att('data', 'sip_h_DVP-DESTINATION-TYPE=PUBLIC_USER')
                .up()
                .ele('action').att('application', 'export').att('data', 'DVP_OPERATION_CAT=PUBLIC_USER')
                .up()
        }
        else if(ep.Type === 'GROUP')
        {
            cond.ele('action').att('application', 'export').att('data', 'DVP_OPERATION_CAT=GROUP')
                .up()
        }
        else
        {
            cond.ele('action').att('application', 'export').att('data', 'DVP_OPERATION_CAT=PRIVATE_USER')
                .up()
        }

        if(ep.CompanyId)
        {
            cond.ele('action').att('application', 'export').att('data', 'companyid=' + ep.CompanyId)
                .up()
        }
        if(ep.TenantId)
        {
            cond.ele('action').att('application', 'export').att('data', 'tenantid=' + ep.TenantId)
                .up()
        }
        if(ep.AppId)
        {
            cond.ele('action').att('application', 'export').att('data', 'dvp_app_id=' + ep.AppId)
                .up()
        }

        if(dvpCallDirection)
        {
            cond.ele('action').att('application', 'export').att('data', 'DVP_CALL_DIRECTION=' + dvpCallDirection)
                .up()
        }


            if(transferLegInfo && transferLegInfo.TransferCode)
            {
                if(transferLegInfo.InternalLegs && transferLegInfo.TransferCode.InternalTransfer)
                {
                    cond.ele('action').att('application', 'bind_meta_app').att('data', transferLegInfo.TransferCode.InternalTransfer + ' ' + transferLegInfo.InternalLegs + ' s execute_extension::att_xfer XML PBXFeatures')
                    .up()
                }

                if(transferLegInfo.ExternalLegs && transferLegInfo.TransferCode.ExternalTransfer)
                {
                    cond.ele('action').att('application', 'bind_meta_app').att('data', transferLegInfo.TransferCode.ExternalTransfer + ' ' + transferLegInfo.ExternalLegs + ' s execute_extension::att_xfer_outbound XML PBXFeatures')
                        .up()
                }

                if(transferLegInfo.GroupLegs && transferLegInfo.TransferCode.GroupTransfer)
                {
                    cond.ele('action').att('application', 'bind_meta_app').att('data', transferLegInfo.TransferCode.GroupTransfer + ' ' + transferLegInfo.GroupLegs + ' s execute_extension::att_xfer_group XML PBXFeatures')
                        .up()
                }

                if(transferLegInfo.ConferenceLegs && transferLegInfo.TransferCode.ConferenceTransfer)
                {
                    cond.ele('action').att('application', 'bind_meta_app').att('data', transferLegInfo.TransferCode.ConferenceTransfer + ' ' + transferLegInfo.ConferenceLegs + ' s execute_extension::att_xfer_conference XML PBXFeatures')
                        .up()
                }

                if(transferLegInfo.IVRLegs && transferLegInfo.TransferCode.IVRTransfer)
                {
                    cond.ele('action').att('application', 'bind_meta_app').att('data', transferLegInfo.TransferCode.IVRTransfer + ' ' + transferLegInfo.IVRLegs + ' s execute_extension::att_xfer_ivr XML PBXFeatures')
                        .up()
                }
            }


        if(numLimitInfo && numLimitInfo.CheckLimit)
        {
            if(numLimitInfo.NumType === 'INBOUND')
            {
                var limitStr = util.format('hash %d_%d_inbound %s %d !USER_BUSY', numLimitInfo.TenantId, numLimitInfo.CompanyId, numLimitInfo.TrunkNumber, numLimitInfo.InboundLimit);
                cond.ele('action').att('application', 'limit').att('data', limitStr)
                    .up()
            }
            else if(numLimitInfo.NumType === 'BOTH')
            {
                if(numLimitInfo.InboundLimit)
                {
                    var limitStr = util.format('hash %d_%d_inbound %s %d !USER_BUSY', numLimitInfo.TenantId, numLimitInfo.CompanyId, numLimitInfo.TrunkNumber, numLimitInfo.InboundLimit);
                    cond.ele('action').att('application', 'limit').att('data', limitStr)
                        .up()
                }

                if(numLimitInfo.BothLimit)
                {
                    var limitStr = util.format('hash %d_%d_both %s %d !USER_BUSY', numLimitInfo.TenantId, numLimitInfo.CompanyId, numLimitInfo.TrunkNumber, numLimitInfo.BothLimit);
                    cond.ele('action').att('application', 'limit').att('data', limitStr)
                        .up()
                }
            }

        }


        if(ep.PersonalGreeting)
        {
            var personalGreetingExportVar = util.format('nolocal:api_on_answer=uuid_broadcast ${uuid} %s both', ep.PersonalGreeting);
            cond.ele('action').att('application', 'export').att('data', personalGreetingExportVar)
            .up()
            //var greetingPath = 'sounds/' + ep.PersonalGreeting;
            //.ele('action').att('application', 'playback').att('data', greetingPath)
            //    .up()
        }

        if(ep.Type === 'GROUP')
        {
            calling = calling + '+A';
        }

        cond.ele('action').att('application', 'bridge').att('data', calling)
            .up()

        if(ep.IsVoicemailEnabled)
        {
            cond.ele('action').att('application', 'answer')
                .up()

            cond.ele('action').att('application', 'voicemail').att('data', util.format('default %s %s', ep.Domain, ep.Destination))
                .up()
        }

        cond.ele('action').att('application', 'hangup')
        .up()

        cond.end({pretty: true});

        var xmlStr = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\r\n" + doc.toString({pretty: true});

        var decoded = xmlStr.replace(/&amp;/g, '&');

        return decoded;


    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.CreateSendBusyMessageDialplan] - [%s] - Exception occurred creating xml', reqId, ex);
        return createNotFoundResponse();
    }

};

var CreateRouteFaxGatewayDialplan = function(reqId, ep, context, profile, destinationPattern, ignoreEarlyMedia, fromFaxType, toFaxType)
{
    try {
        if (!destinationPattern) {
            destinationPattern = "";
        }

        if (!context) {
            context = "";
        }

        var ignoreEarlyM = "ignore_early_media=false";
        if (ignoreEarlyMedia) {
            ignoreEarlyM = "ignore_early_media=true";
        }

        var doc = xmlBuilder.create('document');

        var cond = doc.att('type', 'freeswitch/xml')
            .ele('section').att('name', 'dialplan').att('description', 'RE Dial Plan For FreeSwitch')
            .ele('context').att('name', context)
            .ele('extension').att('name', 'test')
            .ele('condition').att('field', 'destination_number').att('expression', destinationPattern)

        if(fromFaxType === 'T38' && toFaxType === 'AUDIO')
        {
            cond.ele('action').att('application', 'set').att('data', 'fax_enable_t38=true')
                .up()
                .ele('action').att('application', 'export').att('data', 'sip_execute_on_image=t38_gateway self nocng')
                .up()
        }
        else if(fromFaxType === 'AUDIO' && toFaxType === 'T38')
        {
            cond.ele('action').att('application', 'set').att('data', 'fax_enable_t38=true')
                .up()
                .ele('action').att('application', 'export').att('data', 'sip_execute_on_image=t38_gateway self nocng')
                .up()
        }
        else if(fromFaxType === 'T30AUDIO' && toFaxType === 'T38')
        {
            cond.ele('action').att('application', 'set').att('data', 'fax_enable_t38=true')
                .up()
                .ele('action').att('application', 'export').att('data', 'sip_execute_on_image=t38_gateway peer nocng')
                .up()
        }
        else if(fromFaxType === 'T38' && toFaxType === 'T38')
        {
            cond.ele('action').att('application', 'set').att('data', 't38_passthru=true')
                .up()
                .ele('action').att('application', 'export').att('data', 'refuse_t38=true')
                .up()
        }
        else if(fromFaxType === 'T38PASSTHRU' && toFaxType === 'T38PASSTHRU')
        {
            cond.ele('action').att('application', 'export').att('data', 'refuse_t38=true')
                .up()
        }
        else
        {
            cond.ele('action').att('application', 'set').att('data', 'fax_enable_t38=true')
                .up()
                .ele('action').att('application', 'export').att('data', 'sip_execute_on_image=t38_gateway self nocng')
                .up()
        }

        cond.ele('action').att('application', 'set').att('data', 'ringback=${us-ring}')
            .up()
            .ele('action').att('application', 'set').att('data', 'continue_on_fail=true')
            .up()
            .ele('action').att('application', 'set').att('data', 'hangup_after_bridge=true')
            .up()
            .ele('action').att('application', 'set').att('data', ignoreEarlyM)
            .up()
            .ele('action').att('application', 'bind_meta_app').att('data', '3 ab s execute_extension::att_xfer XML PBXFeatures')
            .up()
            .ele('action').att('application', 'bind_meta_app').att('data', '4 ab s execute_extension::att_xfer_group XML PBXFeatures')
            .up()
            .ele('action').att('application', 'bind_meta_app').att('data', '6 ab s execute_extension::att_xfer_outbound XML PBXFeatures')
            .up()
            .ele('action').att('application', 'bind_meta_app').att('data', '5 ab s execute_extension::att_xfer_conference XML PBXFeatures')
            .up()
            .ele('action').att('application', 'bind_meta_app').att('data', '9 ab s execute_extension::att_xfer_ivr XML PBXFeatures')
            .up()


        var option = '';
        var bypassMed = 'bypass_media=false';

        var destinationGroup = util.format('gateway/%s', ep.Profile);

        if (ep.LegStartDelay > 0)
            option = util.format('[leg_delay_start=%d,leg_timeout=%d,origination_caller_id_name=%s,origination_caller_id_number=%s,sip_h_X-Gateway=%s]', ep.LegStartDelay, ep.LegTimeout, ep.Origination, ep.OriginationCallerIdNumber, ep.IpUrl);
        else
            option = util.format('[leg_timeout=%d,origination_caller_id_name=%s,origination_caller_id_number=%s,sip_h_X-Gateway=%s]', ep.LegTimeout, ep.Origination, ep.OriginationCallerIdNumber, ep.IpUrl);


        var dnis = '';

        if (ep.Domain) {
            dnis = util.format('%s@%s', ep.Destination, ep.Domain);
        }

        var protocol = 'sofia';
        var calling = util.format('%s%s/%s/%s', option, protocol, destinationGroup, dnis);

        cond.ele('action').att('application', 'set').att('data', bypassMed)
            .up()
            .ele('action').att('application', 'set').att('data', calling)
            .up()

        return cond.end({pretty: true});


    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.CreateSendBusyMessageDialplan] - [%s] - Exception occurred creating xml', reqId, ex);
        return createNotFoundResponse();
    }

};

var CreateRouteFaxUserDialplan = function(reqId, ep, context, profile, destinationPattern, ignoreEarlyMedia, fromFaxType, toFaxType, numLimitInfo)
{
    try
    {
        if (!destinationPattern) {
            destinationPattern = "";
        }

        if (!context) {
            context = "";
        }

        var ignoreEarlyM = "ignore_early_media=false";
        if (ignoreEarlyMedia)
        {
            ignoreEarlyM = "ignore_early_media=true";
        }

        var option = '';

        if (ep.LegStartDelay > 0)
            option = util.format('[leg_delay_start=%d,leg_timeout=%d,origination_caller_id_name=%s,origination_caller_id_number=%s]', ep.LegStartDelay, ep.LegTimeout, ep.Origination, ep.OriginationCallerIdNumber);
        else
            option = util.format('[leg_timeout=%d,origination_caller_id_name=%s,origination_caller_id_number=%s]', ep.LegTimeout, ep.Origination, ep.OriginationCallerIdNumber);

        //var httpUrl = Config.Services.HttApiUrl;

        var dnis = ep.Destination;

        if (ep.Domain)
        {
            dnis = util.format('%s@%s', dnis, ep.Domain);
        }
        var protocol = 'sofia';
        var destinationGroup = 'user';


        var calling = util.format('%s%s/%s', option, protocol, destinationGroup, dnis);

        if(ep.Type === 'USER')
        {
            if (ep.Group)
            {
                calling = util.format("%s,pickup/%s", calling, ep.Group);
            }
        }


        var doc = xmlBuilder.create('document');

        var cond = doc.att('type', 'freeswitch/xml')
            .ele('section').att('name', 'dialplan').att('description', 'RE Dial Plan For FreeSwitch')
            .ele('context').att('name', context)
            .ele('extension').att('name', 'test')
            .ele('condition').att('field', 'destination_number').att('expression', destinationPattern)

        if(fromFaxType === 'AUDIO' && toFaxType === 'T38')
        {
            cond.ele('action').att('application', 'set').att('data', 'fax_enable_t38=true')
                .up()
                .ele('action').att('application', 'export').att('data', 'sip_execute_on_image=t38_gateway self nocng')
                .up()
        }
        else if(fromFaxType === 'T38' && toFaxType === 'AUDIO')
        {
            cond.ele('action').att('application', 'set').att('data', 'sip_execute_on_image=t38_gateway self nocng')
                .up()
                .ele('action').att('application', 'export').att('data', 'refuse_t38=true')
                .up()
        }
        else if(fromFaxType === 'T38' && toFaxType === 'T30AUDIO')
        {
            cond.ele('action').att('application', 'set').att('data', 'fax_enable_t38=true')
                .up()
                .ele('action').att('application', 'export').att('data', 'sip_execute_on_image=t38_gateway peer nocng')
                .up()
        }
        else if(fromFaxType === 'T38' && toFaxType === 'T38')
        {
            cond.ele('action').att('application', 'set').att('data', 't38_passthru=true')
                .up()
                .ele('action').att('application', 'export').att('data', 'refuse_t38=true')
                .up()
        }
        else if(fromFaxType === 'T38PASSTHRU' && toFaxType === 'T38PASSTHRU')
        {
            cond.ele('action').att('application', 'set').att('data', 't38_passthru=true')
                .up()
                .ele('action').att('application', 'export').att('data', 'refuse_t38=true')
                .up()
        }
        else
        {
            cond.ele('action').att('application', 'set').att('data', 'fax_enable_t38=true')
                .up()
                .ele('action').att('application', 'export').att('data', 'sip_execute_on_image=t38_gateway self nocng')
                .up()
        }



        cond.ele('action').att('application', 'set').att('data', 'continue_on_fail=true')
            .up()
            .ele('action').att('application', 'set').att('data', 'hangup_after_bridge=true')
            .up()
            .ele('action').att('application', 'set').att('data', ignoreEarlyM)
            .up()
            .ele('action').att('application', 'bind_meta_app').att('data', '3 ab s execute_extension::att_xfer XML PBXFeatures')
            .up()
            .ele('action').att('application', 'bind_meta_app').att('data', '4 ab s execute_extension::att_xfer_group XML PBXFeatures')
            .up()
            .ele('action').att('application', 'bind_meta_app').att('data', '6 ab s execute_extension::att_xfer_outbound XML PBXFeatures')
            .up()
            .ele('action').att('application', 'bind_meta_app').att('data', '5 ab s execute_extension::att_xfer_conference XML PBXFeatures')
            .up()
            .ele('action').att('application', 'bind_meta_app').att('data', '9 ab s execute_extension::att_xfer_ivr XML PBXFeatures')
            .up()

        if(numLimitInfo && numLimitInfo.CheckLimit)
        {
            if(numLimitInfo.NumType === 'INBOUND')
            {
                var limitStr = util.format('hash %d_%d_inbound %s %d !USER_BUSY', numLimitInfo.TenantId, numLimitInfo.CompanyId, numLimitInfo.TrunkNumber, numLimitInfo.InboundLimit);
                cond.ele('action').att('application', 'limit').att('data', limitStr)
                    .up()
            }
            else if(numLimitInfo.NumType === 'BOTH')
            {
                if(numLimitInfo.InboundLimit)
                {
                    var limitStr = util.format('hash %d_%d_inbound %s %d !USER_BUSY', numLimitInfo.TenantId, numLimitInfo.CompanyId, numLimitInfo.TrunkNumber, numLimitInfo.InboundLimit);
                    cond.ele('action').att('application', 'limit').att('data', limitStr)
                        .up()
                }

                if(numLimitInfo.BothLimit)
                {
                    var limitStr = util.format('hash %d_%d_both %s %d !USER_BUSY', numLimitInfo.TenantId, numLimitInfo.CompanyId, numLimitInfo.TrunkNumber, numLimitInfo.BothLimit);
                    cond.ele('action').att('application', 'limit').att('data', limitStr)
                        .up()
                }
            }

        }
            cond.ele('action').att('application', 'bridge').att('data', calling)
            .up()

        cond.end({pretty: true});


        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\r\n" + doc.toString({pretty: true});

    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.CreateSendBusyMessageDialplan] - [%s] - Exception occurred creating xml', reqId, ex);
        return createNotFoundResponse();
    }

};

var CreateReceiveFaxDialplan = function(reqId, context, profile, destinationPattern, fromFaxType, toFaxType, numLimitInfo, callId)
{
    try
    {
        var fileServiceHost = config.Services.fileServiceHost;
        var fileServicePort = config.Services.fileServicePort;
        var fileServiceVersion = config.Services.fileServiceVersion;

        if(fileServiceHost && fileServicePort && fileServiceVersion)
        {
            if (!destinationPattern) {
                destinationPattern = "";
            }

            if (!context) {
                context = "";
            }

            var doc = xmlBuilder.create('document');

            var cond = doc.att('type', 'freeswitch/xml')
                .ele('section').att('name', 'dialplan').att('description', 'RE Dial Plan For FreeSwitch')
                .ele('context').att('name', context)
                .ele('extension').att('name', 'test')
                .ele('condition').att('field', 'destination_number').att('expression', destinationPattern)

            if(fromFaxType === 'AUDIO' && toFaxType === 'T38')
            {
                cond.ele('action').att('application', 'set').att('data', 'fax_enable_t38=true')
                    .up()
            }
            else if(fromFaxType === 'T38' && toFaxType === 'AUDIO')
            {
                cond.ele('action').att('application', 'set').att('data', 'sip_execute_on_image=t38_gateway self nocng')
                    .up()
                    .ele('action').att('application', 'export').att('data', 'refuse_t38=true')
                    .up()
            }
            else if(fromFaxType === 'T38' && toFaxType === 'T30AUDIO')
            {
                cond.ele('action').att('application', 'set').att('data', 'fax_enable_t38=true')
                    .up()
                    .ele('action').att('application', 'export').att('data', 'sip_execute_on_image=t38_gateway peer nocng')
                    .up()
            }
            else if(fromFaxType === 'T38' && toFaxType === 'T38')
            {
                cond.ele('action').att('application', 'set').att('data', 't38_passthru=true')
                    .up()
                    .ele('action').att('application', 'export').att('data', 'refuse_t38=true')
                    .up()
            }
            else if(fromFaxType === 'T38PASSTHRU' && toFaxType === 'T38PASSTHRU')
            {
                cond.ele('action').att('application', 'set').att('data', 't38_passthru=true')
                    .up()
                    .ele('action').att('application', 'export').att('data', 'refuse_t38=true')
                    .up()
            }
            else
            {
                cond.ele('action').att('application', 'set').att('data', 'fax_enable_t38=true')
                    .up()
                    .ele('action').att('application', 'export').att('data', 'sip_execute_on_image=t38_gateway self nocng')
                    .up()
            }

            if(numLimitInfo && numLimitInfo.CheckLimit)
            {
                if(numLimitInfo.NumType === 'INBOUND')
                {
                    var limitStr = util.format('hash %d_%d_inbound %s %d !USER_BUSY', numLimitInfo.TenantId, numLimitInfo.CompanyId, numLimitInfo.TrunkNumber, numLimitInfo.InboundLimit);
                    cond.ele('action').att('application', 'limit').att('data', limitStr)
                        .up()
                }
                else if(numLimitInfo.NumType === 'BOTH')
                {
                    if(numLimitInfo.InboundLimit)
                    {
                        var limitStr = util.format('hash %d_%d_inbound %s %d !USER_BUSY', numLimitInfo.TenantId, numLimitInfo.CompanyId, numLimitInfo.TrunkNumber, numLimitInfo.InboundLimit);
                        cond.ele('action').att('application', 'limit').att('data', limitStr)
                            .up()
                    }

                    if(numLimitInfo.BothLimit)
                    {
                        var limitStr = util.format('hash %d_%d_both %s %d !USER_BUSY', numLimitInfo.TenantId, numLimitInfo.CompanyId, numLimitInfo.TrunkNumber, numLimitInfo.BothLimit);
                        cond.ele('action').att('application', 'limit').att('data', limitStr)
                            .up()
                    }
                }

            }

            var localFilePath = util.format('$${base_dir}/fax/inbox/%s_FAX.tif', callId);

            //sf.format()
            var execFaxSuccessData = sf('execute_on_fax_success=curl_sendfile:http://{0}:{1}/DVP/API/{2}/FilService/File/Upload?class=CALLSERVER&type=CALL&category=FAX&reference={3} file={4}', fileServiceHost, fileServicePort, fileServiceVersion, callId, localFilePath);
            cond.ele('action').att('application', 'set_zombie_exec')
                .up()
                .ele('action').att('application', 'set').att('data', execFaxSuccessData)
                .up()
                .ele('action').att('application', 'rxfax').att('data', localFilePath)
                .up()

            cond.end({pretty: true});


            return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\r\n" + doc.toString({pretty: true});
        }
        else
        {
            return createNotFoundResponse();
        }


    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.CreateSendBusyMessageDialplan] - [%s] - Exception occurred creating xml', reqId, ex);
        return createNotFoundResponse();
    }

};

var CreatePickUpDialplan = function(reqId, extension, context, destinationPattern, appId, companyId, tenantId, dvpCallDirection)
{
    try
    {
        if (!destinationPattern)
        {
            destinationPattern = "";
        }

        if (!context)
        {
            context = "";
        }

        var doc = xmlBuilder.create('document');

        var cond = doc.att('type', 'freeswitch/xml')
                    .ele('section').att('name', 'dialplan').att('description', 'RE Dial Plan For FreeSwitch')
                    .ele('context').att('name', context)
                    .ele('extension').att('name', 'test')
                    .ele('condition').att('field', 'destination_number').att('expression', destinationPattern)
                    .ele('action').att('application', 'pickup').att('data', extension)
                    .up()

        cond.ele('action').att('application', 'set').att('data', 'DVP_ADVANCED_OP_ACTION=PICKUP')
            .up()

        if(companyId)
        {
            cond.ele('action').att('application', 'set').att('data', 'companyid=' + companyId)
                .up()
        }
        if(tenantId)
        {
            cond.ele('action').att('application', 'set').att('data', 'tenantid=' + tenantId)
                .up()
        }
        if(appId)
        {
            cond.ele('action').att('application', 'export').att('data', 'dvp_app_id=' + appId)
                .up()
        }

        if(dvpCallDirection)
        {
            cond.ele('action').att('application', 'export').att('data', 'DVP_CALL_DIRECTION=' + dvpCallDirection)
                .up()
        }

        cond.end({pretty: true});


        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\r\n" + doc.toString({pretty: true});

    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.CreatePickUpDialplan] - [%s] - Exception occurred creating xml', reqId, ex);
        return createNotFoundResponse();
    }

};

var CreateVoicemailDialplan = function(reqId, extension, context, destinationPattern, domain)
{
    try
    {
        if (!destinationPattern)
        {
            destinationPattern = "";
        }

        if (!context)
        {
            context = "";
        }

        var voicemailStr = 'check auth default ' + domain + ' ' + extension;

        var doc = xmlBuilder.create('document');

        doc.att('type', 'freeswitch/xml')
            .ele('section').att('name', 'dialplan').att('description', 'RE Dial Plan For FreeSwitch')
            .ele('context').att('name', context)
            .ele('extension').att('name', 'test')
            .ele('condition').att('field', 'destination_number').att('expression', destinationPattern)
            .ele('action').att('application', 'answer')
            .up()
            .ele('action').att('application', 'set').att('data', 'voicemail_authorized=${sip_authorized}')
            .up()
            .ele('action').att('application', 'voicemail').att('data', voicemailStr)
            .up()
            .up()
            .up()
            .up()
            .up()

            .end({pretty: true});


        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\r\n" + doc.toString({pretty: true});

    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.CreateVoicemailDialplan] - [%s] - Exception occurred creating xml', reqId, ex);
        return createNotFoundResponse();
    }

};

var CreateInterceptDialplan = function(reqId, uuid, context, destinationPattern, companyId, tenantId, appId, dvpCallDirection)
{
    try
    {
        if (!destinationPattern)
        {
            destinationPattern = "";
        }

        if (!context)
        {
            context = "";
        }

        var doc = xmlBuilder.create('document');

        var cond = doc.att('type', 'freeswitch/xml')
                    .ele('section').att('name', 'dialplan').att('description', 'RE Dial Plan For FreeSwitch')
                    .ele('context').att('name', context)
                    .ele('extension').att('name', 'test')
                    .ele('condition').att('field', 'destination_number').att('expression', destinationPattern)
                    .ele('action').att('application', 'set').att('data', 'intercept_unanswered_only=true')
                    .up()
                    .ele('action').att('application', 'intercept').att('data', uuid)
                    .up()

        cond.ele('action').att('application', 'set').att('data', 'DVP_ADVANCED_OP_ACTION=INTERCEPT')
            .up()

        if(companyId)
        {
            cond.ele('action').att('application', 'set').att('data', 'companyid=' + companyId)
                .up()
        }
        if(tenantId)
        {
            cond.ele('action').att('application', 'set').att('data', 'tenantid=' + tenantId)
                .up()
        }
        if(appId)
        {
            cond.ele('action').att('application', 'export').att('data', 'dvp_app_id=' + appId)
                .up()
        }
        if(dvpCallDirection)
        {
            cond.ele('action').att('application', 'export').att('data', 'DVP_CALL_DIRECTION=' + dvpCallDirection)
                .up()
        }

        cond.end({pretty: true});


        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\r\n" + doc.toString({pretty: true});

    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.CreateInterceptDialplan] - [%s] - Exception occurred creating xml', reqId, ex);
        return createNotFoundResponse();
    }

};

var CreateParkDialplan = function(reqId, extension, context, destinationPattern, parkId, companyId, tenantId, appId, dvpCallDirection)
{
    try
    {
        if (!destinationPattern)
        {
            destinationPattern = "";
        }

        if (!context)
        {
            context = "";
        }

        var parkStr = context + ' ' + parkId;

        var doc = xmlBuilder.create('document');

        var cond = doc.att('type', 'freeswitch/xml')
                    .ele('section').att('name', 'dialplan').att('description', 'RE Dial Plan For FreeSwitch')
                    .ele('context').att('name', context)
                    .ele('extension').att('name', 'test')
                    .ele('condition').att('field', 'destination_number').att('expression', destinationPattern)
                    .ele('action').att('application', 'answer')
                    .up()
                    .ele('action').att('application', 'valet_park').att('data', parkStr)
                    .up()

        if(companyId)
        {
            cond.ele('action').att('application', 'export').att('data', 'companyid=' + companyId)
                .up()
        }
        if(tenantId)
        {
            cond.ele('action').att('application', 'export').att('data', 'tenantid=' + tenantId)
                .up()
        }
        if(appId)
        {
            cond.ele('action').att('application', 'export').att('data', 'dvp_app_id=' + appId)
                .up()
        }
        if(dvpCallDirection)
        {
            cond.ele('action').att('application', 'export').att('data', 'DVP_CALL_DIRECTION=' + dvpCallDirection)
                .up()
        }


        cond.end({pretty: true});


        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\r\n" + doc.toString({pretty: true});

    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.CreateParkDialplan] - [%s] - Exception occurred creating xml', reqId, ex);
        return createNotFoundResponse();
    }

};

var CreateBargeDialplan = function(reqId, uuid, context, destinationPattern, caller)
{
    try
    {
        if (!destinationPattern)
        {
            destinationPattern = "";
        }

        if (!context)
        {
            context = "";
        }

        var dtmfString = "w1@500";
        if (!caller)
        {
            dtmfString = "w2@500";
        }

        var doc = xmlBuilder.create('document');

        doc.att('type', 'freeswitch/xml')
            .ele('section').att('name', 'dialplan').att('description', 'RE Dial Plan For FreeSwitch')
            .ele('context').att('name', context)
            .ele('extension').att('name', 'test')
            .ele('condition').att('field', 'destination_number').att('expression', destinationPattern)
            .ele('action').att('application', 'set').att('data', 'eavesdrop_enable_dtmf=true')
            .up()
            .ele('action').att('application', 'queue_dtmf').att('data', dtmfString)
            .up()
            .ele('action').att('application', 'eavesdrop').att('data', uuid)
            .up()
            .up()
            .up()
            .up()
            .up()

            .end({pretty: true});


        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\r\n" + doc.toString({pretty: true});

    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.CreateBargeDialplan] - [%s] - Exception occurred creating xml', reqId, ex);
        return createNotFoundResponse();
    }

};

var CreateAutoAttendantDialplan = function(reqId, endpoint, context, toContext, destinationPattern, ignoreEarlyMedia, dvpCallDirection)
{
    try
    {
        if (!destinationPattern) {
            destinationPattern = "";
        }

        if (!context) {
            context = "";
        }

        var bypassMedia = "bypass_media=true";
        if (!endpoint.BypassMedia)
        {
            bypassMedia = "bypass_media=false";
        }

        var ignoreEarlyM = "ignore_early_media=false";
        if (ignoreEarlyMedia)
        {
            ignoreEarlyM = "ignore_early_media=true";
        }

        //var httpUrl = Config.Services.HttApiUrl;

        var luaParams = util.format('AutoAttendant.lua \'%s\' \'%s\' \'%s\' \'%s\' \'%s\'', endpoint.CompanyId, endpoint.TenantId, endpoint.Destination, context, toContext);

        var doc = xmlBuilder.create('document');

        var cond = doc.att('type', 'freeswitch/xml')
            .ele('section').att('name', 'dialplan').att('description', 'RE Dial Plan For FreeSwitch')
            .ele('context').att('name', context)
            .ele('extension').att('name', 'test')
            .ele('condition').att('field', 'destination_number').att('expression', destinationPattern);


        cond.ele('action').att('application', 'set').att('data', 'ringback=${us-ring}')
            .up()
            .ele('action').att('application', 'set').att('data', 'continue_on_fail=true')
            .up()
            .ele('action').att('application', 'set').att('data', 'hangup_after_bridge=true')
            .up()
            .ele('action').att('application', 'set').att('data', ignoreEarlyM)
            .up()
            .ele('action').att('application', 'set').att('data', bypassMedia)
            .up();

        if(endpoint.Action)
        {
            cond.ele('action').att('application', 'export').att('data', 'DVP_ACTION_CAT=AUTO_ATTENDANT')
                .up()
        }

        cond.ele('action').att('application', 'export').att('data', 'DVP_OPERATION_CAT=AUTO_ATTENDANT')
            .up()

        if(endpoint.CompanyId)
        {
            cond.ele('action').att('application', 'export').att('data', 'companyid=' + endpoint.CompanyId)
                .up()
        }
        if(endpoint.TenantId)
        {
            cond.ele('action').att('application', 'export').att('data', 'tenantid=' + endpoint.TenantId)
                .up()
        }
        if(endpoint.AppId)
        {
            cond.ele('action').att('application', 'export').att('data', 'dvp_app_id=' + endpoint.AppId)
                .up()
        }

        if(dvpCallDirection)
        {
            cond.ele('action').att('application', 'export').att('data', 'DVP_CALL_DIRECTION=' + dvpCallDirection)
                .up()
        }



        cond.ele('action').att('application', 'lua').att('data', luaParams)
            .up();

        cond.end({pretty: true});


        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\r\n" + doc.toString({pretty: true});

    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.CreateSendBusyMessageDialplan] - [%s] - Exception occurred creating xml', reqId, ex);
        return createNotFoundResponse();
    }

};

var CreateForwardingDialplan = function(reqId, endpoint, context, profile, destinationPattern, ignoreEarlyMedia, fwdKey, numLimitInfo, transferLegInfo, dvpCallDirection, codecList)
{
    try
    {
        if (!destinationPattern) {
            destinationPattern = "";
        }

        if (!context) {
            context = "";
        }

        var bypassMedia = "bypass_media=true";
        if (!endpoint.BypassMedia)
        {
            bypassMedia = "bypass_media=false";
        }

        var ignoreEarlyM = "ignore_early_media=false";
        if (ignoreEarlyMedia)
        {
            ignoreEarlyM = "ignore_early_media=true";
        }

        var option = '';

        var codecListString = null;

        if(codecList)
        {
            codecList = JSON.parse(codecList);
        }

        if(codecList && codecList.length > 0)
        {
            codecListString = codecList.join();
        }

        option = util.format('[leg_timeout=%d,origination_caller_id_name=%s,origination_caller_id_number=%s', endpoint.LegTimeout, endpoint.Origination, endpoint.OriginationCallerIdNumber);

        if (endpoint.LegStartDelay > 0)
        {
            option = option + ', leg_delay_start=' + endpoint.LegStartDelay;
        }

        if(codecListString && allowCodecPref)
        {
            option = option + ', absolute_codec_string=\'' + codecListString + '\'';
        }

        option = option + ']';

        /*if (endpoint.LegStartDelay > 0)
            option = util.format('[leg_delay_start=%d,leg_timeout=%d,origination_caller_id_name=%s,origination_caller_id_number=%s]', endpoint.LegStartDelay, endpoint.LegTimeout, endpoint.Origination, endpoint.OriginationCallerIdNumber);
        else
            option = util.format('[leg_timeout=%d,origination_caller_id_name=%s,origination_caller_id_number=%s]', endpoint.LegTimeout, endpoint.Origination, endpoint.OriginationCallerIdNumber);*/

        //var httpUrl = Config.Services.HttApiUrl;

        var dnis = endpoint.Destination;

        if (endpoint.Domain)
        {
            dnis = util.format('%s@%s', dnis, endpoint.Domain);
        }
        var protocol = 'sofia';
        var destinationGroup = 'user';

        if(endpoint.Type == 'PUBLIC_USER')
        {
            destinationGroup = endpoint.Profile;
        }

        var calling = util.format('%s%s/%s', option, destinationGroup, dnis);

        if (endpoint.Group)
        {
            calling = util.format("%s,pickup/%s", calling, endpoint.Group);
        }

        if(!endpoint.DodNumber)
        {
            endpoint.DodNumber = '';
        }

        var luaParams = util.format('CF.lua ${originate_disposition} \'%s\' \'%s\' \'%s\' \'%s\' \'%s\' \'%s\' \'%s\' \'%s\'', endpoint.CompanyId, endpoint.TenantId, context, endpoint.Domain, endpoint.Origination, endpoint.OriginationCallerIdNumber, fwdKey, endpoint.DodNumber);

        var doc = xmlBuilder.create('document');

        var cond = doc.att('type', 'freeswitch/xml')
                .ele('section').att('name', 'dialplan').att('description', 'RE Dial Plan For FreeSwitch')
                .ele('context').att('name', context)
                .ele('extension').att('name', 'test')
                .ele('condition').att('field', 'destination_number').att('expression', destinationPattern)


            cond.ele('action').att('application', 'set').att('data', 'ringback=${us-ring}')
                .up()
                .ele('action').att('application', 'set').att('data', 'continue_on_fail=true')
                .up()
                .ele('action').att('application', 'set').att('data', 'hangup_after_bridge=true')
                .up()
                .ele('action').att('application', 'set').att('data', ignoreEarlyM)
                .up()
                .ele('action').att('application', 'set').att('data', bypassMedia)
                .up()

        if(endpoint.Action)
        {
            cond.ele('action').att('application', 'export').att('data', 'DVP_ACTION_CAT=' + endpoint.Action)
                .up()
        }

        if(endpoint.Type === 'PUBLIC_USER')
        {
            cond.ele('action').att('application', 'set').att('data', 'sip_h_DVP-DESTINATION-TYPE=PUBLIC_USER')
                .up()
                .ele('action').att('application', 'export').att('data', 'DVP_OPERATION_CAT=PUBLIC_USER')
                .up()
        }
        else
        {
            cond.ele('action').att('application', 'export').att('data', 'DVP_OPERATION_CAT=PRIVATE_USER')
                .up()
        }

        if(endpoint.CompanyId)
        {
            cond.ele('action').att('application', 'export').att('data', 'companyid=' + endpoint.CompanyId)
                .up()
        }
        if(endpoint.TenantId)
        {
            cond.ele('action').att('application', 'export').att('data', 'tenantid=' + endpoint.TenantId)
                .up()
        }
        if(endpoint.AppId)
        {
            cond.ele('action').att('application', 'export').att('data', 'dvp_app_id=' + endpoint.AppId)
                .up()
        }

        if(dvpCallDirection)
        {
            cond.ele('action').att('application', 'export').att('data', 'DVP_CALL_DIRECTION=' + dvpCallDirection)
                .up()
        }


        if(transferLegInfo && transferLegInfo.TransferCode)
        {
            if(transferLegInfo.InternalLegs && transferLegInfo.TransferCode.InternalTransfer)
            {
                cond.ele('action').att('application', 'bind_meta_app').att('data', transferLegInfo.TransferCode.InternalTransfer + ' ' + transferLegInfo.InternalLegs + ' s execute_extension::att_xfer XML PBXFeatures')
                    .up()
            }

            if(transferLegInfo.ExternalLegs && transferLegInfo.TransferCode.ExternalTransfer)
            {
                cond.ele('action').att('application', 'bind_meta_app').att('data', transferLegInfo.TransferCode.ExternalTransfer + ' ' + transferLegInfo.ExternalLegs + ' s execute_extension::att_xfer_outbound XML PBXFeatures')
                    .up()
            }

            if(transferLegInfo.GroupLegs && transferLegInfo.TransferCode.GroupTransfer)
            {
                cond.ele('action').att('application', 'bind_meta_app').att('data', transferLegInfo.TransferCode.GroupTransfer + ' ' + transferLegInfo.GroupLegs + ' s execute_extension::att_xfer_group XML PBXFeatures')
                    .up()
            }

            if(transferLegInfo.ConferenceLegs && transferLegInfo.TransferCode.ConferenceTransfer)
            {
                cond.ele('action').att('application', 'bind_meta_app').att('data', transferLegInfo.TransferCode.ConferenceTransfer + ' ' + transferLegInfo.ConferenceLegs + ' s execute_extension::att_xfer_conference XML PBXFeatures')
                    .up()
            }

            if(transferLegInfo.IVRLegs && transferLegInfo.TransferCode.IVRTransfer)
            {
                cond.ele('action').att('application', 'bind_meta_app').att('data', transferLegInfo.TransferCode.IVRTransfer + ' ' + transferLegInfo.IVRLegs + ' s execute_extension::att_xfer_ivr XML PBXFeatures')
                    .up()
            }
        }

        if(numLimitInfo && numLimitInfo.CheckLimit)
        {
            if(numLimitInfo.NumType === 'INBOUND')
            {
                var limitStr = util.format('hash %d_%d_inbound %s %d !USER_BUSY', numLimitInfo.TenantId, numLimitInfo.CompanyId, numLimitInfo.TrunkNumber, numLimitInfo.InboundLimit);
                cond.ele('action').att('application', 'limit').att('data', limitStr)
                    .up()
            }
            else if(numLimitInfo.NumType === 'BOTH')
            {
                if(numLimitInfo.InboundLimit)
                {
                    var limitStr = util.format('hash %d_%d_inbound %s %d !USER_BUSY', numLimitInfo.TenantId, numLimitInfo.CompanyId, numLimitInfo.TrunkNumber, numLimitInfo.InboundLimit);
                    cond.ele('action').att('application', 'limit').att('data', limitStr)
                        .up()
                }

                if(numLimitInfo.BothLimit)
                {
                    var limitStr = util.format('hash %d_%d_both %s %d !USER_BUSY', numLimitInfo.TenantId, numLimitInfo.CompanyId, numLimitInfo.TrunkNumber, numLimitInfo.BothLimit);
                    cond.ele('action').att('application', 'limit').att('data', limitStr)
                        .up()
                }
            }

        }


            cond.ele('action').att('application', 'bridge').att('data', calling)
                .up()
                .ele('action').att('application', 'lua').att('data', luaParams)
                .up()
                .ele('action').att('application', 'hangup')
                .up()

        cond.end({pretty: true});


        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\r\n" + doc.toString({pretty: true});

    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.CreateSendBusyMessageDialplan] - [%s] - Exception occurred creating xml', reqId, ex);
        return createNotFoundResponse();
    }

};

var CreateRouteGatewayDialplan = function(reqId, ep, context, profile, destinationPattern, ignoreEarlyMedia, transferLegInfo, dvpCallDirection, codecList)
{
    try
    {
        if (!destinationPattern)
        {
            destinationPattern = "";
        }

        if (!context)
        {
            context = "";
        }

        var ignoreEarlyM = "ignore_early_media=false";
        if (ignoreEarlyMedia)
        {
            ignoreEarlyM = "ignore_early_media=true";
        }

        var bypassMed = 'bypass_media=false';

        var doc = xmlBuilder.create('document');

        var cond = doc.att('type', 'freeswitch/xml')
            .ele('section').att('name', 'dialplan').att('description', 'RE Dial Plan For FreeSwitch')
            .ele('context').att('name', context)
            .ele('extension').att('name', 'test')
            .ele('condition').att('field', 'destination_number').att('expression', destinationPattern)

        cond.ele('action').att('application', 'set').att('data', 'ringback=${us-ring}')
            .up()
            .ele('action').att('application', 'set').att('data', 'continue_on_fail=true')
            .up()

        if(dvpCallDirection === 'outbound')
        {
            cond.ele('action').att('application', 'set').att('data', 'my_uuid=${create_uuid()}').att('inline', 'true')
                .up()
        }

        cond.ele('action').att('application', 'set').att('data', 'hangup_after_bridge=true')
            .up()
            .ele('action').att('application', 'set').att('data', ignoreEarlyM)
            .up()
            .ele('action').att('application', 'set').att('data', bypassMed)
            .up()
            .ele('action').att('application', 'set').att('data', 'sip_h_DVP-DESTINATION-TYPE=GATEWAY')
            .up()
            .ele('action').att('application', 'export').att('data', 'DVP_OPERATION_CAT=GATEWAY')
            .up()
            .up()

        if(ep.RecordEnabled)
        {
            if(dvpCallDirection === 'outbound')
            {
                var fileUploadUrl = 'http://' + fileServiceIp + ':' + fileServicePort + '/DVP/API/' + fileServiceVersion + '/InternalFileService/File/Upload/' + ep.TenantId + '/' + ep.CompanyId;

                if(!validator.isIP(fileServiceIp))
                {
                    fileUploadUrl = 'http://' + fileServiceIp + '/DVP/API/' + fileServiceVersion + '/InternalFileService/File/Upload/' + ep.TenantId + '/' + ep.CompanyId;
                }

                var fileSavePath = '$${base_dir}/recordings/${my_uuid}.mp3';

                var playFileDetails = 'record_post_process_exec_api=curl_sendfile:' + fileUploadUrl + ' file=${dvpRecFile} class=CALLSERVER&type=CALL&category=CONVERSATION&referenceid=${my_uuid}&mediatype=audio&filetype=wav&sessionid=${my_uuid}&display=' + ep.Destination + '-${origination_caller_id_number}';

                cond.ele('action').att('application', 'set').att('data', 'dvpRecFile=' + fileSavePath)
                    .up()
                    .ele('action').att('application', 'export').att('data', 'execute_on_answer=record_session ${dvpRecFile}')
                    .up()
                    .ele('action').att('application', 'set').att('data', playFileDetails)
                    .up()
            }
            else
            {
                var fileUploadUrl = 'http://' + fileServiceIp + ':' + fileServicePort + '/DVP/API/' + fileServiceVersion + '/InternalFileService/File/Upload/' + ep.TenantId + '/' + ep.CompanyId;

                if(!validator.isIP(fileServiceIp))
                {
                    fileUploadUrl = 'http://' + fileServiceIp + '/DVP/API/' + fileServiceVersion + '/InternalFileService/File/Upload/' + ep.TenantId + '/' + ep.CompanyId;
                }

                var fileSavePath = '$${base_dir}/recordings/${uuid}.mp3';

                var playFileDetails = 'record_post_process_exec_api=curl_sendfile:' + fileUploadUrl + ' file=${dvpRecFile} class=CALLSERVER&type=CALL&category=CONVERSATION&referenceid=${uuid}&mediatype=audio&filetype=wav&sessionid=${uuid}&display=' + ep.Destination + '-${origination_caller_id_number}';

                cond.ele('action').att('application', 'set').att('data', 'dvpRecFile=' + fileSavePath)
                    .up()
                    .ele('action').att('application', 'export').att('data', 'execute_on_answer=record_session ${dvpRecFile}')
                    .up()
                    .ele('action').att('application', 'set').att('data', playFileDetails)
                    .up()
            }



        }

        if(ep.Operator)
        {
            cond.ele('action').att('application', 'export').att('data', 'veeryoperator=' + ep.Operator)
                .up()
        }


        if(ep.CompanyId)
        {
            cond.ele('action').att('application', 'export').att('data', 'companyid=' + ep.CompanyId)
                .up()
        }
        if(ep.TenantId)
        {
            cond.ele('action').att('application', 'export').att('data', 'tenantid=' + ep.TenantId)
                .up()
        }
        if(ep.AppId)
        {
            cond.ele('action').att('application', 'export').att('data', 'dvp_app_id=' + ep.AppId)
                .up()
        }

        if(ep.Action)
        {
            cond.ele('action').att('application', 'export').att('data', 'DVP_ACTION_CAT=' + ep.Action)
                .up()
        }
        if(dvpCallDirection)
        {
            cond.ele('action').att('application', 'export').att('data', 'DVP_CALL_DIRECTION=' + dvpCallDirection)
                .up()
        }


        var option = '';

        var destinationGroup = util.format('gateway/%s', ep.Profile);

        if(ep.Type == 'PUBLIC_USER')
        {
            destinationGroup = ep.Profile;
        }

        var codecListString = null;

        if(codecList)
        {
            codecList = JSON.parse(codecList);
        }

        if(codecList && codecList.length > 0)
        {
            codecListString = codecList.join();
        }

        option = util.format('[leg_timeout=%d, origination_caller_id_name=%s,origination_caller_id_number=%s,sip_h_X-Gateway=%s', ep.LegTimeout, ep.Origination, ep.OriginationCallerIdNumber, ep.Domain);

        if (ep.LegStartDelay > 0)
        {
            option = option + ', leg_delay_start=' + ep.LegStartDelay;
        }

        if(dvpCallDirection === 'outbound')
        {
            option = option + ', origination_uuid=${my_uuid}';
        }

        if(codecListString && allowCodecPref)
        {
            option = option + ', absolute_codec_string=\'' + codecListString + '\'';
        }

        option = option + ']';

        /*if(dvpCallDirection === 'outbound')
        {
            if (ep.LegStartDelay > 0)
                option = util.format('[leg_delay_start=%d, origination_uuid=${my_uuid}, leg_timeout=%d,origination_caller_id_name=%s,origination_caller_id_number=%s,sip_h_X-Gateway=%s]', ep.LegStartDelay, ep.LegTimeout, ep.Origination, ep.OriginationCallerIdNumber, ep.Domain);
            else
                option = util.format('[leg_timeout=%d, origination_uuid=${my_uuid}, origination_caller_id_name=%s,origination_caller_id_number=%s,sip_h_X-Gateway=%s]', ep.LegTimeout, ep.Origination, ep.OriginationCallerIdNumber, ep.Domain);
        }
        else
        {
            if (ep.LegStartDelay > 0)
                option = util.format('[leg_delay_start=%d, leg_timeout=%d,origination_caller_id_name=%s,origination_caller_id_number=%s,sip_h_X-Gateway=%s]', ep.LegStartDelay, ep.LegTimeout, ep.Origination, ep.OriginationCallerIdNumber, ep.Domain);
            else
                option = util.format('[leg_timeout=%d, origination_caller_id_name=%s,origination_caller_id_number=%s,sip_h_X-Gateway=%s]', ep.LegTimeout, ep.Origination, ep.OriginationCallerIdNumber, ep.Domain);
        }*/


        var dnis = '';

        if (ep.Domain)
        {
            //dnis = util.format('%s@%s', ep.Destination, ep.Domain);
            dnis = util.format('%s', ep.Destination);
        }

        var protocol = 'sofia';
        var calling = util.format('%s%s/%s/%s', option, protocol, destinationGroup, dnis);

        if(transferLegInfo && transferLegInfo.TransferCode)
        {
            if(transferLegInfo.InternalLegs && transferLegInfo.TransferCode.InternalTransfer)
            {
                cond.ele('action').att('application', 'bind_meta_app').att('data', transferLegInfo.TransferCode.InternalTransfer + ' ' + transferLegInfo.InternalLegs + ' s execute_extension::att_xfer XML PBXFeatures')
                    .up()
            }

            if(transferLegInfo.ExternalLegs && transferLegInfo.TransferCode.ExternalTransfer)
            {
                cond.ele('action').att('application', 'bind_meta_app').att('data', transferLegInfo.TransferCode.ExternalTransfer + ' ' + transferLegInfo.ExternalLegs + ' s execute_extension::att_xfer_outbound XML PBXFeatures')
                    .up()
            }

            if(transferLegInfo.GroupLegs && transferLegInfo.TransferCode.GroupTransfer)
            {
                cond.ele('action').att('application', 'bind_meta_app').att('data', transferLegInfo.TransferCode.GroupTransfer + ' ' + transferLegInfo.GroupLegs + ' s execute_extension::att_xfer_group XML PBXFeatures')
                    .up()
            }

            if(transferLegInfo.ConferenceLegs && transferLegInfo.TransferCode.ConferenceTransfer)
            {
                cond.ele('action').att('application', 'bind_meta_app').att('data', transferLegInfo.TransferCode.ConferenceTransfer + ' ' + transferLegInfo.ConferenceLegs + ' s execute_extension::att_xfer_conference XML PBXFeatures')
                    .up()
            }

            if(transferLegInfo.IVRLegs && transferLegInfo.TransferCode.IVRTransfer)
            {
                cond.ele('action').att('application', 'bind_meta_app').att('data', transferLegInfo.TransferCode.IVRTransfer + ' ' + transferLegInfo.IVRLegs + ' s execute_extension::att_xfer_ivr XML PBXFeatures')
                    .up()
            }
        }

        if(ep.CheckLimit)
        {
            if(ep.NumberType === 'OUTBOUND')
            {
                //should only have an outbound limit
                if(typeof ep.OutLimit != 'undefined')
                {

                    var limitStr = util.format('hash %d_%d_outbound %s %d !USER_BUSY', ep.TenantId, ep.CompanyId, ep.TrunkNumber, ep.OutLimit);
                    cond.ele('action').att('application', 'limit').att('data', limitStr)
                        .up()
                }
                else
                {
                    return createNotFoundResponse();
                }

            }
            else if(ep.NumberType === 'BOTH')
            {
                if(typeof ep.OutLimit != 'undefined' || typeof ep.BothLimit != 'undefined')
                {
                    if(typeof ep.OutLimit != 'undefined')
                    {
                        var limitStr = util.format('hash %d_%d_outbound %s %d !USER_BUSY', ep.TenantId, ep.CompanyId, ep.TrunkNumber, ep.OutLimit);
                        cond.ele('action').att('application', 'limit').att('data', limitStr)
                            .up()
                    }

                    if(typeof ep.BothLimit != 'undefined')
                    {
                        outLim = ep.BothLimit;
                        var limitStr = util.format('hash %d_%d_outbound %s %d !USER_BUSY', ep.TenantId, ep.CompanyId, ep.TrunkNumber, ep.BothLimit);
                        cond.ele('action').att('application', 'limit').att('data', limitStr)
                            .up()
                    }
                }
                else
                {
                    return createNotFoundResponse();
                }


            }
        }

        cond.ele('action').att('application', 'bridge').att('data', calling)
            .up()
            .ele('action').att('application', 'hangup')
            .up()

        cond.end({pretty: true});


        var xmlStr = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\r\n" + doc.toString({pretty: true});

        var decoded = xmlStr.replace(/&amp;/g, '&');

        return decoded;


    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.CreateRouteGatewayDialplan] - [%s] - Exception occurred creating xml', reqId, ex);
        return createNotFoundResponse();
    }

};

var CreateFollowMeDialplan = function(reqId, fmEndpoints, context, profile, destinationPattern, ignoreEarlyMedia, numLimitInfo, companyId, tenantId, appId, dvpCallDirection)
{
    try
    {
        if (!destinationPattern) {
            destinationPattern = "";
        }

        if (!context) {
            context = "";
        }

        var ignoreEarlyM = "ignore_early_media=false";
        if (ignoreEarlyMedia)
        {
            ignoreEarlyM = "ignore_early_media=true";
        }

        var doc = xmlBuilder.create('document');

        var cond = doc.att('type', 'freeswitch/xml')
            .ele('section').att('name', 'dialplan').att('description', 'RE Dial Plan For FreeSwitch')
                .ele('context').att('name', context)
                    .ele('extension').att('name', 'test')
                        .ele('condition').att('field', 'destination_number').att('expression', destinationPattern)

        cond.ele('action').att('application', 'set').att('data', 'ringback=${us-ring}')
            .up()
            .ele('action').att('application', 'set').att('data', 'continue_on_fail=true')
            .up()
            .ele('action').att('application', 'set').att('data', 'hangup_after_bridge=true')
            .up()
            .ele('action').att('application', 'set').att('data', ignoreEarlyM)
            .up()
            .ele('action').att('application', 'bind_meta_app').att('data', '3 ab s execute_extension::att_xfer XML PBXFeatures')
            .up()
            .ele('action').att('application', 'bind_meta_app').att('data', '4 ab s execute_extension::att_xfer_group XML PBXFeatures')
            .up()
            .ele('action').att('application', 'bind_meta_app').att('data', '6 ab s execute_extension::att_xfer_outbound XML PBXFeatures')
            .up()
            .ele('action').att('application', 'bind_meta_app').att('data', '5 ab s execute_extension::att_xfer_conference XML PBXFeatures')
            .up()
            .ele('action').att('application', 'bind_meta_app').att('data', '9 ab s execute_extension::att_xfer_ivr XML PBXFeatures')
            .up()

        cond.ele('action').att('application', 'export').att('data', 'DVP_ACTION_CAT=FOLLOW_ME')
            .up()

        if(companyId)
        {
            cond.ele('action').att('application', 'export').att('data', 'companyid=' + companyId)
                .up()
        }
        if(tenantId)
        {
            cond.ele('action').att('application', 'export').att('data', 'tenantid=' + tenantId)
                .up()
        }
        if(appId)
        {
            cond.ele('action').att('application', 'export').att('data', 'dvp_app_id=' + appId)
                .up()
        }
        if(dvpCallDirection)
        {
            cond.ele('action').att('application', 'export').att('data', 'DVP_CALL_DIRECTION=' + dvpCallDirection)
                .up()
        }

        if(numLimitInfo && numLimitInfo.CheckLimit)
        {
            if(numLimitInfo.NumType === 'INBOUND')
            {
                var limitStr = util.format('hash %d_%d_inbound %s %d !USER_BUSY', numLimitInfo.TenantId, numLimitInfo.CompanyId, numLimitInfo.TrunkNumber, numLimitInfo.InboundLimit);
                cond.ele('action').att('application', 'limit').att('data', limitStr)
                    .up()
            }
            else if(numLimitInfo.NumType === 'BOTH')
            {
                if(numLimitInfo.InboundLimit)
                {
                    var limitStr = util.format('hash %d_%d_inbound %s %d !USER_BUSY', numLimitInfo.TenantId, numLimitInfo.CompanyId, numLimitInfo.TrunkNumber, numLimitInfo.InboundLimit);
                    cond.ele('action').att('application', 'limit').att('data', limitStr)
                        .up()
                }

                if(numLimitInfo.BothLimit)
                {
                    var limitStr = util.format('hash %d_%d_both %s %d !USER_BUSY', numLimitInfo.TenantId, numLimitInfo.CompanyId, numLimitInfo.TrunkNumber, numLimitInfo.BothLimit);
                    cond.ele('action').att('application', 'limit').att('data', limitStr)
                        .up()
                }
            }

        }



        fmEndpoints.forEach(function(ep)
        {
            var option = '';
            var destinationGroup = '';

            if(ep.Type === 'GATEWAY')
            {
                destinationGroup = util.format('gateway/%s', ep.Profile);

                if (ep.LegStartDelay > 0)
                    option = util.format('[leg_delay_start=%d,leg_timeout=%d,origination_caller_id_name=%s,origination_caller_id_number=%s,sip_h_X-Gateway=%s,sip_h_DVP-DESTINATION-TYPE=%s,DVP_OPERATION_CAT=%s,bypass_media=%s]', ep.LegStartDelay, ep.LegTimeout, ep.Origination, ep.OriginationCallerIdNumber, ep.Domain, 'GATEWAY', 'GATEWAY', 'false');
                else
                    option = util.format('[leg_timeout=%d,origination_caller_id_name=%s,origination_caller_id_number=%s,sip_h_X-Gateway=%s,sip_h_DVP-DESTINATION-TYPE=%s,DVP_OPERATION_CAT=%s,bypass_media=%s]', ep.LegTimeout, ep.Origination, ep.OriginationCallerIdNumber, ep.Domain, 'GATEWAY', 'GATEWAY', 'false');

            }
            else if(ep.Type === 'PUBLIC_USER')
            {
                destinationGroup = ep.Profile;

                if (ep.LegStartDelay > 0)
                    option = util.format('[leg_delay_start=%d,leg_timeout=%d,origination_caller_id_name=%s,origination_caller_id_number=%s,sip_h_X-Gateway=%s,sip_h_DVP-DESTINATION-TYPE=%s,DVP_OPERATION_CAT=%s,bypass_media=%s]', ep.LegStartDelay, ep.LegTimeout, ep.Origination, ep.OriginationCallerIdNumber, ep.Domain, 'PUBLIC_USER', 'PUBLIC_USER', 'false');
                else
                    option = util.format('[leg_timeout=%d,origination_caller_id_name=%s,origination_caller_id_number=%s,sip_h_X-Gateway=%s,sip_h_DVP-DESTINATION-TYPE=%s,DVP_OPERATION_CAT=%s,bypass_media=%s]', ep.LegTimeout, ep.Origination, ep.OriginationCallerIdNumber, ep.Domain, 'PUBLIC_USER', 'PUBLIC_USER', 'false');

            }
            else
            {
                destinationGroup = 'user';

                var bypassMed = 'bypass_media=false';

                if(ep.BypassMedia)
                {
                    bypassMed = 'bypass_media=true';
                }
                else
                {
                    bypassMed = 'bypass_media=false';
                }

                if (ep.LegStartDelay > 0)
                    option = util.format('[leg_delay_start=%d,leg_timeout=%d,origination_caller_id_name=%s,origination_caller_id_number=%s,DVP_OPERATION_CAT=%s,bypass_media=%s]', ep.LegStartDelay, ep.LegTimeout, ep.Origination, ep.OriginationCallerIdNumber, 'PRIVATE_USER', bypassMed);
                else
                    option = util.format('[leg_timeout=%d,origination_caller_id_name=%s,origination_caller_id_number=%s,DVP_OPERATION_CAT=%s,bypass_media=%s]', ep.LegTimeout, ep.Origination, ep.OriginationCallerIdNumber, 'PRIVATE_USER', bypassMed);



            }

            var dnis = '';



            var protocol = 'sofia';
            var calling = '';

            if(ep.Type === 'GATEWAY')
            {
                dnis = util.format('%s', ep.Destination);
                calling = util.format('%s%s/%s/%s', option, protocol, destinationGroup, dnis);
            }
            else
            {
                if (ep.Domain)
                {
                    dnis = util.format('%s@%s', ep.Destination, ep.Domain);
                }
                else
                {
                    dnis = util.format('%s', ep.Destination);
                }
                calling = util.format('%s%s/%s', option, destinationGroup, dnis);
            }

            cond.ele('action').att('application', 'bridge').att('data', calling)
                .up()

        });

        cond.ele('action').att('application', 'hangup')
            .up()

        cond.end({pretty: true});


        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\r\n" + doc.toString({pretty: true});



    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.CreateSendBusyMessageDialplan] - [%s] - Exception occurred creating xml', reqId, ex);
        return createNotFoundResponse();
    }

};

module.exports.createNotFoundResponse = createNotFoundResponse;
module.exports.CreateSendBusyMessageDialplan = CreateSendBusyMessageDialplan;
module.exports.CreateRouteUserDialplan = CreateRouteUserDialplan;
module.exports.CreateFollowMeDialplan = CreateFollowMeDialplan;
module.exports.CreateForwardingDialplan = CreateForwardingDialplan;
module.exports.CreateRouteGatewayDialplan = CreateRouteGatewayDialplan;
module.exports.CreatePickUpDialplan = CreatePickUpDialplan;
module.exports.CreateInterceptDialplan= CreateInterceptDialplan;
module.exports.CreateBargeDialplan = CreateBargeDialplan;
module.exports.CreateVoicemailDialplan = CreateVoicemailDialplan;
module.exports.CreateParkDialplan = CreateParkDialplan;
module.exports.CreateRouteFaxUserDialplan = CreateRouteFaxUserDialplan;
module.exports.CreateRouteFaxGatewayDialplan = CreateRouteFaxGatewayDialplan;
module.exports.CreateConferenceDialplan = CreateConferenceDialplan;
module.exports.CreateReceiveFaxDialplan = CreateReceiveFaxDialplan;
module.exports.CreatePbxFeatures = CreatePbxFeatures;
module.exports.createRejectResponse = createRejectResponse;
module.exports.CreateAutoAttendantDialplan = CreateAutoAttendantDialplan;
module.exports.CreateAttendantTransferGW = CreateAttendantTransferGW;
module.exports.CreatePbxFeaturesGateway = CreatePbxFeaturesGateway;
