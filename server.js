var express = require('express');
var util = require('util');
var app = express();
var server = require('http').Server(app);

var port = process.env.PORT || 5000; // Use the port that Heroku
server.listen(port);

var io = require('socket.io')(server);
console.log('listening for http and socket requests on port ' + port);

var bodyParser = require('body-parser')
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())
app.use(express.static(__dirname + '/public'));

io.on('connection', function(socket) {
  console.log('connection');
});
