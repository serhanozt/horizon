var mysql = require('mysql');
var redis = require('redis');
const redisHost = "10.0.0.125"
const redisPort = 6379


var dbConfig = {
    host: '10.0.0.63',
    user: 'root',
    password: 'selenium#!_s_+!58',
    database: 'spPanel'
};

var connection = mysql.createConnection(dbConfig);

var client = redis.createClient({
    port: redisPort,
    host: redisHost
});


exports.handler = function(event, context) {

    var eventType = event.eventType;
    var productid = event.productid;

    // product is now available
    if (eventType == "track") {
        client.get('productid' + productid, function(err, value) {
            context.succeed(value);
        })

    } else {
        // product is now out of stock
        client.set('productid:' + productid, 0, function(err, value) {
            console.log(err)
        })
        console.log(eventType)
        context.succeed("hello muhammet");
    }


    var statement = "select * from partner limit 1"
    connection.query(statement,
        function(err, rows, rowFields) {
            console.log(rows)
            context.succeed(err);
        });


};