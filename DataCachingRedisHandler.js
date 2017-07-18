/**
 * Created by dinusha on 8/4/2016.
 */

var redis = require("ioredis");
var Config = require('config');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;

////////////////////////////////redis////////////////////////////////////////
var redisip = Config.Redis.ip;
var redisport = Config.Redis.port;
var redispass = Config.Redis.password;
var redismode = Config.Redis.mode;
var redisdb = Config.Redis.db;


//[redis:]//[user][:password@][host][:port][/db-number][?db=db-number[&password=bar[&option=value]]]
//redis://user:secret@localhost:6379
var redisSetting =  {
    port:redisport,
    host:redisip,
    family: 4,
    db: redisdb,
    password: redispass,
    retryStrategy: function (times) {
        var delay = Math.min(times * 50, 2000);
        return delay;
    },
    reconnectOnError: function (err) {

        return true;
    }
};

if(redismode == 'sentinel'){

    if(Config.Redis.sentinels && Config.Redis.sentinels.hosts && Config.Redis.sentinels.port, Config.Redis.sentinels.name){
        var sentinelHosts = Config.Redis.sentinels.hosts.split(',');
        if(Array.isArray(sentinelHosts) && sentinelHosts.length > 2){
            var sentinelConnections = [];

            sentinelHosts.forEach(function(item){

                sentinelConnections.push({host: item, port:Config.Redis.sentinels.port})

            })

            redisSetting = {
                sentinels:sentinelConnections,
                name: Config.Redis.sentinels.name,
                password: redispass
            }

        }else{

            console.log("No enough sentinel servers found .........");
        }

    }
}

var client = undefined;

if(redismode != "cluster") {
    client = new redis(redisSetting);
}else{

    var redisHosts = redisip.split(",");
    if(Array.isArray(redisHosts)){


        redisSetting = [];
        redisHosts.forEach(function(item){
            redisSetting.push({
                host: item,
                port: redisport,
                family: 4,
                password: redispass});
        });

        var client = new redis.Cluster([redisSetting]);

    }else{

        client = new redis(redisSetting);
    }
}



var SetObjectWithExpire = function(key, value, timeout, callback)
{
    try
    {
        client.setex(key, timeout, value, function(err, response)
        {
            if(err)
            {
                logger.error('[DVP-DynamicConfigurationGenerator.SetObjectWithExpire] - REDIS ERROR', err)
            }
            else
            {
                logger.error('[DVP-DynamicConfigurationGenerator.SetObjectWithExpire] - REDIS SUCCESS', err)
            }
            callback(err, response);
        });

    }
    catch(ex)
    {
        callback(ex, undefined);
    }

};

var GetObjectParseJson = function(reqId, key, callback)
{
    GetObject(reqId, key, function(err, resp)
    {
        if(err || !resp)
        {
            callback(err, null);
        }
        else
        {
            try
            {
                var jsonObj = JSON.parse(resp);
                callback(null, jsonObj);
            }
            catch(ex)
            {
                callback(ex, null);
            }

        }
    })
}

var GetObject = function(reqId, key, callback)
{
    try
    {
        logger.debug('[DVP-DynamicConfigurationGenerator.GetObject] - [%s] - Method Params - key : %s', reqId, key);

        var start = new Date().getTime();
        client.get(key, function(err, response)
        {
            var end = new Date().getTime();
            var time = end - start;

            console.log("Redis Time : " + time);
            if(err)
            {
                logger.error('[DVP-DynamicConfigurationGenerator.GetObject] - [%s] - REDIS GET failed', reqId, err);
            }
            else
            {
                logger.debug('[DVP-DynamicConfigurationGenerator.GetObject] - [%s] - REDIS GET success', reqId);
            }

            callback(err, response);
        });

    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.GetObject] - [%s] - Exception occurred', reqId, ex);
        callback(ex, undefined);
    }
};

var SetObject = function(key, value, callback)
{
    try
    {
        client.set(key, value, function(err, response)
        {
            if(err)
            {
                logger.error('[DVP-DynamicConfigurationGenerator.SetObjectWithExpire] - REDIS ERROR', err)
            }
            else
            {
                logger.debug('[DVP-DynamicConfigurationGenerator.SetObjectWithExpire] - REDIS SUCCESS')
            }
            callback(err, response);
        });

    }
    catch(ex)
    {
        callback(ex, undefined);
    }

};

var PublishToRedis = function(pattern, message, callback)
{
    try
    {
        if(client.connected)
        {
            var result = client.publish(pattern, message);
            logger.debug('[DVP-DynamicConfigurationGenerator.SetObjectWithExpire] - REDIS SUCCESS');
            callback(undefined, true);
        }
        else
        {
            callback(new Error('REDIS CLIENT DISCONNECTED'), false);
        }


    }
    catch(ex)
    {
        callback(ex, undefined);
    }
}

var GetFromSet = function(setName, callback)
{
    try
    {
        if(client.connected)
        {
            client.smembers(setName).keys("*", function (err, setValues)
            {
                if(err)
                {
                    logger.error('[DVP-DynamicConfigurationGenerator.SetObjectWithExpire] - REDIS ERROR', err)
                }
                else
                {
                    logger.debug('[DVP-DynamicConfigurationGenerator.SetObjectWithExpire] - REDIS SUCCESS')
                }
                callback(err, setValues);
            });
        }
        else
        {
            callback(new Error('REDIS CLIENT DISCONNECTED'), undefined);
        }


    }
    catch(ex)
    {
        callback(ex, undefined);
    }
};

var IncrementKey = function(key, callback)
{
    try
    {
        if(client.connected)
        {
            client.incr(key, function (err, reply)
            {
                if(err)
                {
                    logger.error('[DVP-DynamicConfigurationGenerator.IncrementKey] - [%s] - REDIS ERROR', err);
                }
                else
                {
                    logger.debug('[DVP-DynamicConfigurationGenerator.IncrementKey] - [%s] - REDIS SUCCESS');

                }


            });
        }


    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.IncrementKey] - [%s] - REDIS ERROR', ex);
    }
}

var AddChannelIdToSet = function(uuid, setName)
{
    try
    {
        if(client.connected)
        {
            client.sismember(setName, uuid, function (err, reply)
            {
                if(err)
                {
                    logger.error('[DVP-EventMonitor.handler] - [%s] - REDIS ERROR', err);
                }
                else
                {
                    logger.debug('[DVP-EventMonitor.handler] - [%s] - REDIS SUCCESS');
                    if (reply === 0)
                    {
                        client.sadd(setName, uuid);
                    }

                }


            });
        }


    }
    catch(ex)
    {
        console.log('dfdfd');

    }

}

var AddToHash = function(hashId, key, value, callback)
{
    try
    {
        if(client.connected)
        {
            client.hset(hashId, key, value, function (err, reply)
            {
                if(err)
                {
                    logger.error('[DVP-DynamicConfigurationGenerator.AddToHash] - [%s] - REDIS ERROR', err);
                }
                else
                {
                    logger.debug('[DVP-DynamicConfigurationGenerator.AddToHash] - [%s] - REDIS SUCCESS');

                }

                callback(err, reply);

            });
        }

    }
    catch(ex)
    {
        logger.error('[DVP-DynamicConfigurationGenerator.AddToHash] - [%s] - REDIS ERROR', ex);
    }
};

client.on('error', function(msg)
{

});

module.exports.SetObject = SetObject;
module.exports.PublishToRedis = PublishToRedis;
module.exports.GetFromSet = GetFromSet;
module.exports.SetObjectWithExpire = SetObjectWithExpire;
module.exports.GetObject = GetObject;
module.exports.AddChannelIdToSet = AddChannelIdToSet;
module.exports.GetObjectParseJson = GetObjectParseJson;
module.exports.IncrementKey = IncrementKey;
module.exports.AddToHash = AddToHash;
