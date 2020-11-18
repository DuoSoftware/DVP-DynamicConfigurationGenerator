/**
 * Created by dinusha on 4/22/2015.
 */

module.exports = {

    "EmailSendMethod": "SYS_EMAIL_SEND_METHOD",

    "DB": {
        "Type":"SYS_DATABASE_TYPE",
        "User":"SYS_DATABASE_POSTGRES_USER",
        "Password":"SYS_DATABASE_POSTGRES_PASSWORD",
        "Port":"SYS_SQL_PORT",
        "Host":"SYS_DATABASE_HOST",
        "Database":"SYS_DATABASE_NAME"
    },

    "Host":{
        "Port":"HOST_DYNAMICCONFIGGEN_PORT",
        "Version":"HOST_VERSION",
        "AllowCodecConfigure": "HOST_DYNAMICCONFIGGEN_CODECCONFIG"
    },

    "RabbitMQ":
    {
        "ip": "SYS_RABBITMQ_HOST",
        "port": "SYS_RABBITMQ_PORT",
        "user": "SYS_RABBITMQ_USER",
        "password": "SYS_RABBITMQ_PASSWORD",
        "vhost":"SYS_RABBITMQ_VHOST"
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

    "SMSServer": {
        "ip": "SYS_SMSSERVER_HOST",
        "port": "SYS_SMSSERVER_PORT",
        "password": "SYS_SMSSERVER_PASSWORD",
        "user": "SYS_SMSSERVER_USER"
    },

    "SMTP": {
        "ip": "SYS_SMTP_HOST",
        "port": "SYS_SMTP_PORT",
        "user": "SYS_SMTP_USER",
        "password": "SYS_SMTP_PASSWORD"
    },

    "Mongo": {
        "ip": "SYS_MONGO_HOST",
        "port": "SYS_MONGO_PORT",
        "dbname": "SYS_MONGO_DB",
        "password": "SYS_MONGO_PASSWORD",
        "user": "SYS_MONGO_USER",
        "type": "SYS_MONGO_TYPE"

    },

    "Services":
    {

        "accessToken": "HOST_TOKEN",
        "fileServiceHost": "SYS_FILESERVICE_HOST",
        "fileServicePort": "SYS_FILESERVICE_PORT",
        "fileServiceVersion":"SYS_FILESERVICE_VERSION",

        "dccaclientHost": "SYS_DIAMETERCLIENT_HOST",
        "dccaclientPort": "SYS_DIAMETERCLIENT_PORT",
        "dccaclientVersion": "SYS_DIAMETERCLIENT_VERSION",

        "resourceServiceHost": "SYS_RESOURCESERVICE_HOST",
        "resourceServicePort": "SYS_RESOURCESERVICE_PORT",
        "resourceServiceVersion": "SYS_RESOURCESERVICE_VERSION",

        "uploadurl": "SYS_FILESERVICE_HOST",
        "uploadport":"SYS_FILESERVICE_PORT",
        "uploadurlVersion":"SYS_FILESERVICE_VERSION",

        "interactionurl": "SYS_INTERACTIONS_HOST",
        "interactionport": "SYS_INTERACTIONS_PORT",
        "interactionversion":"SYS_INTERACTIONS_VERSION",


        "cronurl": "SYS_SCHEDULEWORKER_HOST",
        "cronport": "SYS_SCHEDULEWORKER_PORT",
        "cronversion":"SYS_SCHEDULEWORKER_VERSION",


        "ticketServiceHost": "SYS_LITETICKET_HOST",
        "ticketServicePort":  "SYS_LITETICKET_PORT",
        "ticketServiceVersion":  "SYS_LITETICKET_VERSION",
    },

    "Token": "HOST_TOKEN",
    "billingEnabled": "SYS_BILLING_ENABLED",
    "RecordingPath": "SYS_CALL_RECORD_PATH",
    "UseDashboardAMQP": "HOST_USE_DASHBOARD_MSG_QUEUE",
    "EnableDefaultRing": "HOST_ENABLE_DEFAULT_RING",
    "EnableTransferFailPlay": "HOST_ENABLE_TRANSFER_PLAY",
    "RegistrationTimeout": "HOST_REGISTRATION_TIMEOUT"
};
