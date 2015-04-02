var restify = require('restify');
var fsMediaFormatter = require('./FreeSwitchMediaFormatter.js');
var backendHandler = require('./SipExtBackendOperations.js');
var xmlGen = require('./XmlResponseGenerator.js');
var logHandler = require('./LogHandler.js');
var jsonFormatter = require('./DVP-Common/CommonMessageGenerator/ClientMessageJsonFormatter.js');

var server = restify.createServer({
    name: 'localhost',
    version: '1.0.0',
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



server.post('/CallApp', function(req,res,next)
{
    try
    {
        var data = fsMediaFormatter.convertUrlEncoded(req.body);

        var hostname = data["hostname"];
        var cdnum = data["Caller-Destination-Number"];
        var callerContext = data["Caller-Context"];
        var huntDestNum = data["Hunt-Destination-Number"];
        var huntContext = data["Hunt-Context"];
        var varDomain = data["variable_domain"];
        var varUserId = data["variable_user_id"];
        var profile = data["variable_sofia_profile_name"];
        var varUuid = data["variable_uuid"];
        var varSipFromUri = data["variable_sip_from_uri"];
        var varSipToUri = data["variable_sip_to_uri"];
        var varUsrContext = data["variable_user_context"];
        var varFromNumber = data["variable_FromNumber"];

        if (cdnum && callerContext && hostname)
        {
            //Dialplan

            var destNum = (huntDestNum) ? huntDestNum:cdnum;

            //Get Context

            backendHandler.GetContext(callerContext, function(err, ctxt)
            {
                if(err)
                {
                    var xml = xmlGen.createNotFoundResponse();

                    res.end(xml);
                }
                else if(!ctxt || ctxt.ContextCat === "PUBLIC")
                {
                    var decodedSipFromUri = decodeURIComponent(varSipFromUri);
                    var decodedSipToUri = decodeURIComponent(varSipToUri);

                    var fromSplitArr = decodedSipFromUri.split("@");

                    var toSplitArr = decodedSipToUri.split("@");

                    var aniNum = "";
                    var dnisNum = "";
                    var domain = "";

                    if(fromSplitArr.count == 2)
                    {
                        domain = fromSplitArr[1];

                        var domainAndPort = domain.split(":");

                        if(domainAndPort.count == 2)
                        {
                            domain = domainAndPort[0];
                        }

                        aniNum = fromSplitArr[0];

                    }

                    if(toSplitArr.count == 2)
                    {
                        dnisNum = toSplitArr[0];
                    }

                    //pick inbound call rule



                    res.end("ffff");

                }
                else
                {}

            })



        }
    }
    catch(ex)
    {

    }

    return next();

})


server.get('/LbRequestController/:direction/:number/', function(req,res,next)
{
    try
    {
        var direction = req.params.direction;
        var number = req.params.number;

        if(direction === "in")
        {
            backendHandler.GetCloudForIncomingRequest(number, 0, function(err, cb)
            {
                if(err || !cb)
                {
                    res.end(",,");
                }
                else
                {
                    var returnMessage = cb.LimitId + "," + cb.LoadBalanceType + "," + cb.IpCode;
                    res.end(returnMessage);
                }

            });
        }
        else if(direction === "out")
        {
            backendHandler.GetGatewayForOutgoingRequest(number, 0, function(err, cb)
            {
                if(err || !cb)
                {
                    res.end(",");
                }
                else
                {
                    var returnMessage = cb.LimitId + "," + cb.GwIpUrl;
                    res.end(returnMessage);
                }

            });
        }
        else
        {
            logHandler.WriteLog("error", jsonFormatter.FormatMessage(new Error("Invalid direction"), 'EXCEPTION', false, undefined));
            res.end(",");
        }

    }
    catch(ex)
    {
        logHandler.WriteLog("error", jsonFormatter.FormatMessage(ex, 'EXCEPTION', false, undefined));
        res.end(",");
    }

    return next();
})


server.post('/DirectoryProfile', function(req, res, next)
{
    try
    {
        logHandler.WriteLog("info", "Start");

        var data = fsMediaFormatter.convertUrlEncoded(req.body);

        var hostname = data["hostname"];
        var user = data["user"];
        var domain = data["domain"];
        var action = data["action"];
        var purpose = data["purpose"];
        var group = data["group"];
        var sipAuthRealm = data["sip_auth_realm"];
        var profile = data["profile"];

        if(action && user && hostname && domain && (action === 'sip_auth' || action === 'message-count'))
        {
            var tempAuthRealm = domain;
            if(sipAuthRealm != undefined)
            {
                tempAuthRealm = sipAuthRealm;
            }

            backendHandler.GetUserBy_Name_Domain(user, tempAuthRealm, function(err, usr){
                if(usr != undefined)
                {
                    //create xml
                    var xml = xmlGen.createDirectoryProfile(usr.SipUsername, usr.SipExtension, usr.Domain, usr.EmailAddress, usr.Password, usr.Context);

                    res.end(xml);

                }
                else
                {
                    logHandler.WriteLog("error", jsonFormatter.FormatMessage(new Error('user undefined'), 'ERROR', false, undefined));
                    var xml = xmlGen.createNotFoundResponse();

                    res.end(xml);
                }
            })
        }
        else if(action && user && hostname && domain && (action === 'user_call' || action === 'voicemail-lookup'))
        {
            var tempAuthRealm = domain;
            if(sipAuthRealm != undefined)
            {
                tempAuthRealm = sipAuthRealm;
            }

            backendHandler.GetUserBy_Ext_Domain(user, tempAuthRealm, function(err, usr){
                if(usr != undefined)
                {
                    //create xml
                    var xml = xmlGen.createDirectoryProfile(usr.SipUsername, usr.SipExtension, usr.Domain, usr.EmailAddress, usr.Password, usr.Context);

                    res.end(xml);

                }
                else
                {
                    logHandler.WriteLog("error", jsonFormatter.FormatMessage(new Error('user undefined'), 'ERROR', false, undefined));

                    var xml = xmlGen.createNotFoundResponse();

                    res.end(xml);
                }
            })
        }
        else if(purpose && profile && hostname && purpose === 'gateways')
        {
            var csId = parseInt(hostname);
            backendHandler.GetGatewayListForCallServerProfile(profile, csId, function(err, result)
            {
                if (err)
                {
                    logHandler.WriteLog("error", jsonFormatter.FormatMessage(err, 'ERROR', false, undefined));
                    var xml = xmlGen.createNotFoundResponse();

                    res.end(xml);
                }
                else
                {
                    var xml = xmlGen.CreateGatewayProfile(result);

                    res.end(xml);
                }

            })
        }
        else
        {
            logHandler.WriteLog("error", jsonFormatter.FormatMessage(new Error('Invalid Parameters Passed'), 'ERROR', false, undefined));
            res.end(xmlGen.createNotFoundResponse());
        }

    }
    catch(ex)
    {
        logHandler.WriteLog("error", jsonFormatter.FormatMessage(ex, 'EXCEPTION', false, undefined));
        res.end(xmlGen.createNotFoundResponse());
    }

    return next();

});


server.listen(9093, 'localhost', function () {
    console.log('%s listening at %s', server.name, server.url);
});