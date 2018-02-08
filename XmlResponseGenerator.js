var xmlBuilder = require('xmlbuilder');
var Config = require('config');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var util = require('util');

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
        return '';
    }

}

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

var CreateUserGroupDirectoryProfile = function(grp, reqId)
{
    try
    {
        var grpDomain = grp.Domain ? grp.Domain : "";
        //var element = new xmlBuilder.create('users');


        var users = {'user': []};



        if(grp.SipUACEndpoint)
        {
            grp.SipUACEndpoint.forEach(function(sipUsr)
            {

                var sipUsername = sipUsr.SipUsername ? sipUsr.SipUsername : "";
                var sipExt = sipUsr.SipExtension ? sipUsr.SipExtension : "";
                var sipPassword = sipUsr.Password ? sipUsr.Password : "";
                var sipUsrDomain = "";
                var sipUserContext = "";

                if(sipUsr.CloudEndUser && sipUsr.CloudEndUser.Domain)
                {
                    sipUsrDomain = sipUsr.CloudEndUser.Domain;
                }

                if(sipUsr.ContextId)
                {
                    sipUserContext = sipUsr.ContextId;
                }

                var userObj = {
                        '@id': sipUsername, '@cacheable': 'false', '@number-alias': sipExt,
                        'params': {'param':[]},
                        'variables': {'variable':[]}
                };

                userObj.params.param.push({'@name' : 'dial-string', '@value' : '{sip_invite_domain=${domain_name},presence_id=${dialed_user}@${dialed_domain}}${sofia_contact(${dialed_user}@${dialed_domain})}'});
                userObj.params.param.push({'@name' : 'password', '@value' : sipPassword});

                userObj.variables.variable.push({'@name' : 'domain', '@value' : sipUsrDomain});
                userObj.variables.variable.push({'@name' : 'user_context', '@value' : sipUserContext});
                userObj.variables.variable.push({'@name' : 'user_id', '@value' : sipUsername});


                users.user.push(userObj);




            });
        }

        var grpExt = "";
        if(grp.Extension && grp.Extension.Extension)
        {
            grpExt = grp.Extension.Extension;
        }

        var obj2 = {
                group : {'@name' : grpExt, 'users' : {'user': []}}

        };



        if(grp.SipUACEndpoint)
        {

            grp.SipUACEndpoint.forEach(function (sipUsr)
            {
                var sipExt = sipUsr.SipExtension ? sipUsr.SipExtension : "";
                var usrPointerObj = {'@id': sipExt, '@type': 'pointer'};
                obj2.group.users.user.push(usrPointerObj);

            });
        }

        var obj = {
            document: {
                '@type': 'freeswitch/xml',
                section: {
                    '@name': 'directory',
                    domain: {
                        '@name': grpDomain,
                        'users': users,
                        'groups': obj2
                    }
                }


            }
        };

        var xml = xmlBuilder.create(obj);
        xml.end({pretty: true});

        //var gwStr = section.end({pretty: true});

        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\r\n" + xml.toString({pretty: true});

        /*var doc = xmlBuilder.create('document').att('type', 'freeswitch/xml')
            doc.ele('section').att('name', 'directory')
                .ele('domain').att('name', grpDomain)
                    .ele(obj)
                    .up()
                    .ele(obj2).up().up();

        doc.end({pretty: true});

        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\r\n" + doc.toString({pretty: true});*/

    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.CreateUserGroupDirectoryProfile] - [%s] - Exception occurred creating xml', reqId, ex);
        return createNotFoundResponse();
    }



}

var CreateGatewayProfile = function(gwList, reqId)
{
    try
    {
        var expireSec = 60;
        var retrySec = 3600;
        var pingSec = 60;


        /*var doc = xmlBuilder.create('document').att('type', 'freeswitch/xml');
        var section = doc.ele('section').att('name', 'directory');*/

        var obj = {
            document: {
                '@type': 'freeswitch/xml',
                section: {
                    '@name': 'directory',
                    domain: []
                }


            }
        };




        gwList.forEach(function(gw)
        {

            var proxy = gw.IpUrl;
            if(gw.Proxy)
            {
                proxy = gw.Proxy;
            }

            var username = '';
            var password = '';

            var domain = gw.Domain;

            if(gw.Username)
            {
                username = gw.Username;
                domain = gw.IpUrl;

                if(gw.Password)
                {
                    password = gw.Password;
                }
            }


            var domainEle = {
                '@name': domain,
                params: {
                    param: {
                        '@name': 'dial-string',
                        '@value': '{presence_id=${dialed_user}${dialed_domain}}${sofia_contact(${dialed_user}${dialed_domain})}'
                    }
                },
                variables: {
                    variable: {}
                },
                user: {
                    '@id': '',
                    gateways: {
                        gateway: {
                            '@name': gw.TrunkCode,
                            param: []
                        }
                    },
                    params: {
                        param: {
                            '@name': 'password',
                            '@value': ''
                        }
                    }
                }
            };





            if(!username)
            {
                domainEle.user.gateways.gateway.param.push(
                    {
                        '@name': 'username',
                        '@value': username
                    },
                    {
                        '@name': 'realm',
                        '@value': gw.IpUrl
                    },
                    {
                        '@name': 'proxy',
                        '@value': proxy
                    },
                    {
                        '@name': 'password',
                        '@value': password
                    },
                    {
                        '@name': 'from-user',
                        '@value': username
                    },
                    {
                        '@name': 'from-domain',
                        '@value': domain
                    },
                    {
                        '@name': 'register',
                        '@value': 'false'
                    },
                    {
                        '@name': 'register-transport',
                        '@value': 'udp'
                    },
                    {
                        '@name': 'apply-register-acl',
                        '@value': 'provider'
                    },
                    {
                        '@name': 'caller-id-in-from',
                        '@value': 'true'
                    },
                    {
                        '@name': 'context',
                        '@value': 'public'
                    },
                    {
                        '@name': 'expire-seconds',
                        '@value': expireSec
                    },
                    {
                        '@name': 'retry-seconds',
                        '@value': retrySec
                    },
                    {
                        '@name': 'ping',
                        '@value': pingSec
                    },
                    {
                        '@name': 'auth-calls',
                        '@value': 'false'
                    },
                    {
                        '@name': 'register-proxy',
                        '@value': gw.IpUrl
                    },
                    {
                        '@name': 'auth-username',
                        '@value': ''
                    });

            }
            else
            {
                domainEle.user.gateways.gateway.param.push(
                    {
                        '@name': 'realm',
                        '@value': gw.IpUrl
                    },
                    {
                        '@name': 'proxy',
                        '@value': proxy
                    },
                    {
                        '@name': 'from-domain',
                        '@value': domain
                    },
                    {
                        '@name': 'username',
                        '@value': username
                    },
                    {
                        '@name': 'from-user',
                        '@value': username
                    },
                    {
                        '@name': 'password',
                        '@value': password
                    },
                    {
                        '@name': 'contact-params',
                        '@value': username + '@' + domain
                    },
                    {
                        '@name': 'extension',
                        '@value': username
                    },
                    {
                        '@name': 'extension-in-contact',
                        '@value': 'true'
                    },
                    {
                        '@name': 'ping',
                        '@value': pingSec
                    },
                    {
                        '@name': 'retry-seconds',
                        '@value': '30'
                    });

            }

            obj.document.section.domain.push(domainEle);


            /*section.ele('domain').att('name', gw.Domain)
                .ele('params')
                    .ele('param').att('name', 'dial-string').att('value', '{presence_id=${dialed_user}${dialed_domain}}${sofia_contact(${dialed_user}${dialed_domain})}')
                    .up()
                .up()
                .ele('variables')
                    .ele('variable')
                    .up()
                .up()
                .ele('user').att('id', '')
                    .ele('gateways')
                        .ele('gateway').att('name', gw.TrunkCode)
                            .ele('param').att('name', 'username').att('value', username)
                            .up()
                            .ele('param').att('name', 'auth-username').att('value', username)
                            .up()
                            .ele('param').att('name', 'realm').att('value', gw.IpUrl)
                            .up()
                            .ele('param').att('name', 'proxy').att('value', proxy)
                            .up()
                            .ele('param').att('name', 'register-proxy').att('value', gw.IpUrl)
                            .up()
                            .ele('param').att('name', 'register-transport').att('value', 'udp')
                            .up()
                            .ele('param').att('name', 'caller-id-in-from').att('value', 'true')
                            .up()
                            .ele('param').att('name', 'password').att('value', password)
                            .up()
                            .ele('param').att('name', 'from-user').att('value', username)
                            .up()
                            .ele('param').att('name', 'from-domain').att('value', gw.Domain)
                            .up()
                            .ele('param').att('name', 'expire-seconds').att('value', expireSec)
                            .up()
                            .ele('param').att('name', 'retry-seconds').att('value', retrySec)
                            .up()
                            .ele('param').att('name', 'context').att('value', 'public')
                            .up()
                            .ele('param').att('name', 'register').att('value', 'false')
                            .up()
                            .ele('param').att('name', 'auth-calls').att('value', 'false')
                            .up()
                            .ele('param').att('name', 'apply-register-acl').att('value', 'provider')
                            .up()
                        .up()
                    .up()
                    .ele('params')
                        .ele('param').att('name', 'password').att('value', '')
                        .up()
                    .up()
                .up()
            .up()*/


        });

        var xml = xmlBuilder.create(obj);

        //var gwStr = section.end({pretty: true});

        return xml.end({pretty: true});
    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.CreateGatewayProfile] - [%s] - Exception occurred creating xml', reqId, ex);
        return createNotFoundResponse();
    }



}

var createDirectoryProfile = function(extName, ext, domain, email, password, context, sendEmail, reqId, pin)
{
    try {

        if (!extName) {
            extName = "";
        }
        if (!ext) {
            ext = "";
        }
        if (!domain) {
            domain = "";
        }
        if (!email) {
            email = "";
        }
        if (!password) {
            password = "";
        }
        if (!context) {
            context = "";
        }




        var doc = xmlBuilder.create('document');

        var tempDoc = doc.att('type', 'freeswitch/xml')
            .ele('section').att('name', 'directory')
            .ele('domain').att('name', domain)
            .ele('user').att('id', extName).att('cacheable', 'false').att('number-alias', ext)
            .ele('params')
                .ele('param').att('name', 'dial-string').att('value', '{sip_invite_domain=${domain_name},presence_id=${dialed_user}@${dialed_domain}}${sofia_contact(${dialed_user}@${dialed_domain})}')
                .up()
                .ele('param').att('name', 'password').att('value', password)
                .up();

        if(sendEmail)
        {
            tempDoc.ele('param').att('name', 'vm-email-all-messages').att('value', 'true')
                .up()
                .ele('param').att('name', 'vm-attach-file').att('value', 'true')
                .up()
                .ele('param').att('name', 'vm-mailto').att('value', email)
                .up()

        }

        if(pin)
        {
            tempDoc.ele('param').att('name', 'vm-password').att('value', pin)
                .up()
        }

        tempDoc.up()
            .ele('variables')
            .ele('variable').att('name', 'domain').att('value', domain)
            .up()
            .ele('variable').att('name', 'user_context').att('value', context)
            .up()
            .ele('variable').att('name', 'user_id').att('value', extName)
            .up()
            .up()
            .up()
            .up()
            .up()
            .end({pretty: true});

        /*doc.att('type', 'freeswitch/xml')
            .ele('section').att('name', 'directory')
                .ele('domain').att('name', domain)
                    .ele('user').att('id', extName).att('cacheable', 'false').att('number-alias', ext)
                        .ele('params')
                            .ele('param').att('name', 'dial-string').att('value', '{sip_invite_domain=${domain_name},presence_id=${dialed_user}@${dialed_domain}}${sofia_contact(${dialed_user}@${dialed_domain})}')
                            .up()
                            .ele('param').att('name', 'password').att('value', password)
                            .up()
                            .ele('param').att('name', 'vm-email-all-messages').att('value', 'true')
                            .up()
                            .ele('param').att('name', 'vm-attach-file').att('value', 'true')
                            .up()
                            .ele('param').att('name', 'vm-mailto').att('value', email)
                            .up()
                        .up()
                    .ele('variables')
                        .ele('variable').att('name', 'domain').att('value', domain)
                        .up()
                        .ele('variable').att('name', 'user_context').att('value', context)
                        .up()
                        .ele('variable').att('name', 'user_id').att('value', extName)
                        .up()
                    .up()
                .up()
            .up()
        .up()
        .end({pretty: true});*/


        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\r\n" + doc.toString({pretty: true});
    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.createDirectoryProfile] - [%s] - Exception occurred creating xml', reqId, ex);
        return createNotFoundResponse();
    }

};

var CreateHttpApiDialplan = function(destinationPattern, context, httApiUrl, reqId, numLimitInfo, appId, companyId, tenantId, dvpCallDirection, ani, bUnit)
{
    try
    {
        if (!destinationPattern) {
            destinationPattern = "";
        }

        if (!context) {
            context = "";
        }

        //var httpUrl = Config.Services.HttApiUrl;

        var httpApiUrl = "{url=" + httApiUrl + "}";

        var doc = xmlBuilder.create('document');

        var cond = doc.att('type', 'freeswitch/xml')
            .ele('section').att('name', 'dialplan').att('description', 'RE Dial Plan For FreeSwitch')
            .ele('context').att('name', context)
            .ele('extension').att('name', 'test')
            .ele('condition').att('field', 'destination_number').att('expression', destinationPattern)

        if(numLimitInfo)
        {
            if(typeof numLimitInfo.NumberInboundLimit != 'undefined' && numLimitInfo.NumberInboundLimit != null)
            {
                var limitStr = util.format('hash %d_%d_inbound %s %d !USER_BUSY', tenantId, companyId, numLimitInfo.TrunkNumber, numLimitInfo.NumberInboundLimit);
                cond.ele('action').att('application', 'limit').att('data', limitStr)
                    .up()
            }

            if(typeof numLimitInfo.NumberBothLimit != 'undefined' && numLimitInfo.NumberBothLimit != null)
            {
                var limitStr = util.format('hash %d_%d_both %s %d !USER_BUSY', tenantId, companyId, numLimitInfo.TrunkNumber, numLimitInfo.NumberBothLimit);
                cond.ele('action').att('application', 'limit').att('data', limitStr)
                    .up()
            }

            if(typeof numLimitInfo.CompanyInboundLimit != 'undefined' && numLimitInfo.CompanyInboundLimit != null)
            {
                var limitStr = util.format('hash %d_%d_inbound companylimit %d !USER_BUSY', tenantId, companyId, numLimitInfo.CompanyInboundLimit);
                cond.ele('action').att('application', 'limit').att('data', limitStr)
                    .up()
            }

            if(typeof numLimitInfo.CompanyBothLimit != 'undefined' && numLimitInfo.CompanyBothLimit != null)
            {
                var limitStr = util.format('hash %d_%d_both companylimit %d !USER_BUSY', tenantId, companyId, numLimitInfo.CompanyBothLimit);
                cond.ele('action').att('application', 'limit').att('data', limitStr)
                    .up()
            }
        }

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

        if(bUnit)
        {
            cond.ele('action').att('application', 'export').att('data', 'business_unit=' + bUnit)
                .up()
        }

        if(ani)
        {
            cond.ele('action').att('application', 'set').att('data', 'effective_caller_id_number=' + ani)
                .up()
        }

        cond.ele('action').att('application', 'set').att('data', 'DVP_OPERATION_CAT=HTTAPI')
            .up()
            .ele('action').att('application', 'export').att('data', 'dvp_app_type=HTTAPI')
            .up()
            .ele('action').att('application', 'answer')
            .up()
            .ele('action').att('application', 'httapi').att('data', httpApiUrl)
            .up();


        cond.end({pretty: true});


        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\r\n" + doc.toString({pretty: true});


    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.CreateHttpApiDialplan] - [%s] - Exception occurred creating xml', reqId, ex);
        return createNotFoundResponse();
    }

};

var CreateHttpApiDialplanTransfer = function(destinationPattern, context, httApiUrl, reqId, numLimitInfo, appId, companyId, tenantId, dvpCallDirection, ani, appType, bUnit, isDialerIVR)
{
    try
    {
        if (!destinationPattern) {
            destinationPattern = "";
        }

        if (!context) {
            context = "";
        }

        //var httpUrl = Config.Services.HttApiUrl;

        var httpApiUrl = "{url=" + httApiUrl + "}";

        var doc = xmlBuilder.create('document');

        var cond = doc.att('type', 'freeswitch/xml')
            .ele('section').att('name', 'dialplan').att('description', 'RE Dial Plan For FreeSwitch')
            .ele('context').att('name', context)
            .ele('extension').att('name', 'test')
            .ele('condition').att('field', 'destination_number').att('expression', destinationPattern)

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

        if(bUnit)
        {
            cond.ele('action').att('application', 'export').att('data', 'business_unit=' + bUnit)
                .up()
        }

        if(isDialerIVR)
        {
            cond.ele('action').att('application', 'set').att('data', 'is_dialer_ivr=true')
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

        if(ani)
        {
            cond.ele('action').att('application', 'set').att('data', 'effective_caller_id_number=' + ani)
                .up()
        }

        if(appType != 'DIALER')
        {
            cond.ele('action').att('application', 'set').att('data', 'DVP_OPERATION_CAT=HTTAPI')
                .up();
        }


        cond.ele('action').att('application', 'export').att('data', 'dvp_app_type=HTTAPI')
            .up()
            .ele('action').att('application', 'httapi').att('data', httpApiUrl)
            .up();


        cond.end({pretty: true});


        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\r\n" + doc.toString({pretty: true});


    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.CreateHttpApiDialplan] - [%s] - Exception occurred creating xml', reqId, ex);
        return createNotFoundResponse();
    }

};

var CreateSocketApiDialplan = function(destinationPattern, context, socketUrl, reqId, numLimitInfo, appId, companyId, tenantId, dvpCallDirection, bUnit)
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
        if(bUnit)
        {
            cond.ele('action').att('application', 'export').att('data', 'business_unit=' + bUnit)
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

        cond.ele('action').att('application', 'set').att('data', 'DVP_OPERATION_CAT=SOCKET')
            .up()

        cond.ele('action').att('application', 'answer')
            .up()
            .ele('action').att('application', 'socket').att('data', socketUrl + ' async full')
            .up()


        cond.end({pretty: true});


        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\r\n" + doc.toString({pretty: true});


    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.CreateSocketApiDialplan] - [%s] - Exception occurred creating xml', reqId, ex);
        return createNotFoundResponse();
    }

};

var CreateRouteGatewayDialplan = function(reqId, ep, context, profile, destinationPattern, ignoreEarlyMedia)
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

module.exports.createDirectoryProfile = createDirectoryProfile;
module.exports.createNotFoundResponse = createNotFoundResponse;
module.exports.CreateGatewayProfile = CreateGatewayProfile;
module.exports.CreateHttpApiDialplan = CreateHttpApiDialplan;
module.exports.CreateUserGroupDirectoryProfile = CreateUserGroupDirectoryProfile;
module.exports.CreateSocketApiDialplan = CreateSocketApiDialplan;
module.exports.CreateRouteGatewayDialplan = CreateRouteGatewayDialplan;
module.exports.createRejectResponse = createRejectResponse;
module.exports.CreateHttpApiDialplanTransfer = CreateHttpApiDialplanTransfer;