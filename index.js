var mysql = require('mysql');
var redis = require('redis');
var crypto = require('crypto');

const redisHost = "10.0.0.125"
const redisPort = 6379

var dbConfig = {
    host: '10.0.0.229',
    user: 'root',
    password: 'selenium#!_s_+!58',
    database: 'partner_horizon'
};

var client = redis.createClient({
    port: redisPort,
    host: redisHost
});

var connection = mysql.createConnection(dbConfig);
exports.handler = function(event, context) {


    var productId = event.product.id;
    var eventType = event.eventType;

    // track product availablity
    if (eventType == "check") {
        //check status of stock
        var eventStockStatus = event.product.stock
        if (eventStockStatus == "true") {

            //check if that product exists in redis
            client.get('productid:' + productId, function(err, value) {
                if (value == 0) {
                    // this product previously exsists in Redis
                    // get productDetails from mySQL
                    // update mySQL stock status to 1

                    //send webpush
                    var statement = "select * from wishListProductDetails where productId=" + productId;
                    connection.query(statement,
                        function(err, rows, rowFields) {

                            var webpushData = rows;

                            var statement = "select id from wishListDetails where stockStatus=0 and productId=" + rows[0].id;

                            connection.query(statement,
                                function(err, rows, rowFields) {
                                    var idsToBeSent = rows[0].id

                                    //update stockStatus
                                    var statement = "update wishListDetails set stockStatus=1 where id=" + idsToBeSent
                                    connection.query(statement,
                                        function(err, rows, rowFields) {

                                            // set redis to 1
                                            client.set("productid:" + productId, 1);

                                            // send alfred @todo
                                            var pushObject = {
                                                "title": "Go Play White",
                                                "wishListId": "1",
                                                "desc": "test desc",
                                                "img": "//test44test.herokuapp.com/images/large/1611262223Tpu112.jpg",
                                                "url": "http://test44test.herokuapp.com/product/go-play-white/",
                                                "builderId": "0",
                                                "partnerName": "horizon",
                                                "randomToken": "6304262",
                                                "sendType": "1",
                                                "campId": "0"
                                            }
                                            
                                            crypto.createHmac('sha256', 'SomeRandomRequestKey').update()



                                        });
                                });
                        });

                } else if (value == 1) {
                    context.succeed("already in stock");
                } else {
                    context.succeed("key doesn't exist in redis");
                }
            })
        } else {
            //check if this product exists in redis
            client.get('productid:' + productId, function(err, value) {
                if (value == 1) {
                    //if exists and in stock, set redis to back to 0
                    client.set("productid:" + productId, 0, function(err, reply) {});
                    // update mySQL stock status to 0
                }
            });
        }
    } else if (eventType == "add") {

        var userid = event.userId
        var productImage = event.product.img;
        var productName = event.product.name;
        var productUrl = event.product.url;
        var productPrice = event.product.price;
        var productSize = event.product.size;
        var productCategories = event.product.categories;

        var productObject = {
            "id": productId,
            "img": productImage,
            "name": productName,
            "url": productUrl,
            "price": productPrice,
            "size": productSize,
            "categories": productCategories
        }

        var statement = "select id from wishListProductDetails where productId='" + productId + "'";

        connection.query(statement,
            function(err, rows, rowFields) {

                if (err) {
                    context.fail(err);
                } else if (rows.length == 0) {
                    //insert into  WLPD
                    var statement = "insert into wishListProductDetails (productId,name,img,price,url,size,categories) values(" +
                        "'" + productId + "'" + "," + "'" + productName + "'" + "," + "'" + productImage + "'" + "," + "'" + productPrice + "'" + "," +
                        "'" + productUrl + "'" + "," + "'" + productSize + "'" + "," + "'" + productCategories + "'" +
                        ")"

                    connection.query(statement,
                        function(err, result) {
                            if (!err) {
                                //return wishlistProductDetails ID
                                setWishListDetails(result.insertId, productObject, userid);
                            } else {
                                context.fail("failed inserting into wishListProductDetails");
                            }
                        });
                } else if (rows.length != 0) {
                    setWishListDetails(rows[0].id, productObject, userid);
                }
            });


    } else if (eventType == 'get') {
        var userId = event.userId;

        var statement = "select productId from usersWishList where userId='" + userId + "' and status=1";

        connection.query(statement, function(err, result) {
            if (!err) {
                if (result.length > 0) {
                    var productQuery = "select productId as id, name, img, price, url, size, categories from wishListProductDetails ";

                    result.forEach(function(item, index) {
                        if (index === 0) {
                            productQuery += 'where ';
                        }

                        productQuery += ' id = ' + item.productId;

                        if ((result.length - 1) !== index) {
                            productQuery += ' or';
                        }
                    });

                    connection.query(productQuery, function(err, result) {
                        if (!err) {
                            context.succeed(result);
                        } else {
                            context.fail(err);
                        }

                    });
                } else {
                    context.succeed([]);
                }

            } else {
                context.fail(err);
            }

        });

    } else if (eventType == "delete") {
        var userId = event.userId;
        var productId = event.productId;

        var productDetailtQuery = "select id from wishListProductDetails where productId='" + productId + "'";

        connection.query(productDetailtQuery, function(err, rows) {
            if (!err) {
                var statement = "update usersWishList set status=0 where userId='" + userId + "' and productId=" + rows[0].id;

                connection.query(statement, function(err, result) {
                    if (!err) {
                        context.succeed({ "id": productId });
                    } else {
                        context.fail(err);
                    }

                });
            } else {
                context.fail(err);
            }

        });
    }

    var setWishListDetails = function(wishListProductDetailId, productObject, userid) {

        //check if exist

        var readStatement = "select id from wishListDetails where productId='" +
            wishListProductDetailId + "' and stockStatus=0 and detailType=1" + " and size=" +
            "'" + productObject.size + "'" + " and price='" + productObject.price + "'";



        connection.query(readStatement, function(err, rows, rowFields) {

            if (!err) {
                if (rows.length > 0) {

                    setUserWishList(userid, rows[0].id, wishListProductDetailId, productObject)
                } else {

                    var statement = "insert into wishListDetails (productId,stockStatus,detailType,size,price) values(" +
                        "'" + wishListProductDetailId + "'" + "," +
                        0 + "," + 1 + "," +
                        "'" + productObject.size + "'" + "," + "'" + productObject.price + "'" + ")";

                    connection.query(statement,
                        function(err, result) {

                            if (!err) {
                                var wishListDetailId = result.insertId;
                                setUserWishList(userid, wishListDetailId, wishListProductDetailId, productObject)
                            } else {
                                context.fail(err);
                            }
                        });

                }
            } else {
                context.fail(err);
            }
        });



    }

    var setUserWishList = function(userId, wishListDetailId, wishListProductDetailId, productObject) {

        var statement = "insert into usersWishList (wishListDetailId,userId,status,productId) values(" + "'" + wishListDetailId + "'" + "," + "'" + userId + "'" + "," + "'" + 1 + "'" + "," + "'" + wishListProductDetailId + "'" + ");";

        connection.query(statement,
            function(err, result) {

                if (!err) {
                    // redis set key to 0
                    client.set("productid:" + productObject.productId, 0, function(err, reply) {
                        context.succeed(productObject);
                    });

                } else {
                    context.fail(err);
                }
            });

    }

};