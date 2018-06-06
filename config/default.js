module.exports = {
  "DB": {
    "Type":"postgres",
    "User":"",
    "Password":"",
    "Port":5432,
    "Host":"",
    "Database":"",
    "Cluster": true
  },

  //"Redis": {
  //  "ip": "",
  //  "port": 6389,
  //  "db": 9,
  //  "password": ""
  //},

  "Redis":
  {
    "mode":"instance",//instance, cluster, sentinel
    "ip": "",
    "port": 6389,
    "user": "",
    "password": "",
    "db": 0,
    "sentinels":{
      "hosts": "",
      "port":16389,
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
    "ip":"",
    "port":"5672",
    "user": "",
    "password": "",
    "vhost":'/'
  },

  "Services":
  {

    "fileServiceHost": "",
    "fileServicePort": 8081,
    "fileServiceVersion":"6.0",
    "dccaclientHost": "127.0.0.1",
    "dccaclientPort": 4555,
    "dccaclientVersion": "1.0.0.0"

  },

  "Token": "",
  "UseCache": false,
  "billingEnabled": "true",
  "RecordingPath": "/usr/src/recordings/",
  "UseDashboardAMQP": "true"
};
