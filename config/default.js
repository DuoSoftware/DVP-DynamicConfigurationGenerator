module.exports = {
  "DB": {
    "Type":"postgres",
    "User":"duo",
    "Password":"DuoS123",
    "Port":5432,
    "Host":"104.236.231.11",
    "Database":"duo",
    "Cluster": false
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
    "ip": "45.55.142.207",
    "port": 6389,
    "user": "duo",
    "password": "DuoS123",
    "db": 0,
    "sentinels":{
      "hosts": "138.197.90.92,45.55.205.92,162.243.81.39",
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

  "Services":
  {

    "fileServiceHost": "192.168.0.54",
    "fileServicePort": 8081,
    "fileServiceVersion":"6.0",
    "dccaclientHost": "127.0.0.1",
    "dccaclientPort": 4555,
    "dccaclientVersion": "1.0.0.0"

  },

  "Token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdWtpdGhhIiwianRpIjoiYWEzOGRmZWYtNDFhOC00MWUyLTgwMzktOTJjZTY0YjM4ZDFmIiwic3ViIjoiNTZhOWU3NTlmYjA3MTkwN2EwMDAwMDAxMjVkOWU4MGI1YzdjNGY5ODQ2NmY5MjExNzk2ZWJmNDMiLCJleHAiOjE5MDIzODExMTgsInRlbmFudCI6LTEsImNvbXBhbnkiOi0xLCJzY29wZSI6W3sicmVzb3VyY2UiOiJhbGwiLCJhY3Rpb25zIjoiYWxsIn1dLCJpYXQiOjE0NzAzODExMTh9.Gmlu00Uj66Fzts-w6qEwNUz46XYGzE8wHUhAJOFtiRo",
  "UseCache": false,
  "billingEnabled": true,
  "RecordingPath": "/usr/src/recordings/"
};