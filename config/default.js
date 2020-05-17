module.exports = {
    "DB": {
        "Type":"postgres",
        "User":"postgres",
        "Password":"",
        "Port":5432,
        "Host":"",
        "Database":"duo",
        "Cluster": true
    },

    //"Redis": {
    //  "ip": "45.55.142.207",
    //  "port": 6389,
    //  "db": 9,
    //  "password": "DuoS123"
    //},

    "Redis":
        {
            "mode":"instance",//instance, cluster, sentinel
            "ip": "138.197.90.92",
            "port": 6389,
            "user": "",
            "password": "",
            "db": 0,
            "sentinels":{
                "hosts": "138.197.90.92,45.55.205.92,162.243.81.39",
                "port":6379,
                "name":"redis-cluster"
            }

        },

    "Host":{
        "Ip":"0.0.0.0",
        "Port":8817,
        "Version":"1.0.0.0",
        "AllowCodecConfigure": true
    },

    "RabbitMQ": {
        "ip":"45.55.142.207",
        "port":"5672",
        "user": "admin",
        "password": "admin",
        "vhost":'/'
    },

    "Services":
        {
            "fileServiceHost": "192.168.0.54",
            "fileServicePort": 8081,
            "fileServiceVersion":"6.0",
            "dccaclientHost": "127.0.0.1",
            "dccaclientPort": 4555,
            "dccaclientVersion": "1.0.0.0",
            "dynamicPort": false
        },

    "Token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdWtpdGhhIiwianRpIjoiYWEzOGRmZWYtNDFhOC00MWUyLTgwMzktOTJjZTY0YjM4ZDFmIiwic3ViIjoiNTZhOWU3NTlmYjA3MTkwN2EwMDAwMDAxMjVkOWU4MGI1YzdjNGY5ODQ2NmY5MjExNzk2ZWJmNDMiLCJleHAiOjE5MDIzODExMTgsInRlbmFudCI6LTEsImNvbXBhbnkiOi0xLCJzY29wZSI6W3sicmVzb3VyY2UiOiJhbGwiLCJhY3Rpb25zIjoiYWxsIn1dLCJpYXQiOjE0NzAzODExMTh9.Gmlu00Uj66Fzts-w6qEwNUz46XYGzE8wHUhAJOFtiRo",
    "UseCache": false,
    "billingEnabled": "false",
    "RecordingPath": "/usr/src/recordings/",
    "UseDashboardAMQP": "true",
    "EnableDefaultRing": false,
    "EnableTransferFailPlay": false,
    "RegistrationTimeout": 300000
};
