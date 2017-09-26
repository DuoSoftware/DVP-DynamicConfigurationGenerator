/**
 * Created by dinusha on 4/22/2015.
 */

module.exports = {

    "DB": {
        "Type":"SYS_DATABASE_TYPE",
        "User":"SYS_DATABASE_POSTGRES_USER",
        "Password":"SYS_DATABASE_POSTGRES_PASSWORD",
        "Port":"SYS_SQL_PORT",
        "Host":"SYS_DATABASE_HOST",
        "Database":"SYS_DATABASE_POSTGRES_USER"
    },

    "Host":{
        "Port":"HOST_DYNAMICCONFIGGEN_PORT",
        "Version":"HOST_VERSION",
        "AllowCodecConfigure": "HOST_DYNAMICCONFIGGEN_CODECCONFIG"
    },

    //"Redis":
    //{
    //    "ip": "SYS_REDIS_HOST",
    //    "port": "SYS_REDIS_PORT",
    //    "password": "SYS_REDIS_PASSWORD",
    //    "db": "SYS_REDIS_DB_CONFIG"
    //},

    "Redis":
    {
        "mode":"SYS_REDIS_MODE",
        "ip": "SYS_REDIS_HOST",
        "port": "SYS_REDIS_PORT",
        "user": "SYS_REDIS_USER",
        "password": "SYS_REDIS_PASSWORD",
        "db": "SYS_REDIS_DB",
        "sentinels":{
            "hosts": "SYS_REDIS_SENTINEL_HOSTS",
            "port":"SYS_REDIS_SENTINEL_PORT",
            "name":"SYS_REDIS_SENTINEL_NAME"
        }

    },

    "Services":
    {

        "fileServiceHost": "SYS_FILESERVICE_HOST",
        "fileServicePort": "SYS_FILESERVICE_PORT",
        "fileServiceVersion":"SYS_FILESERVICE_VERSION",
        "dccaclientHost": "SYS_DIAMETERCLIENT_HOST",
        "dccaclientPort": "SYS_DIAMETERCLIENT_PORT",
        "dccaclientVersion": "SYS_DIAMETERCLIENT_VERSION"

    },

    "Token": "HOST_TOKEN",
    "billingEnabled": "SYS_BILLING_ENABLED",
    "RecordingPath": "SYS_CALL_RECORD_PATH"
};