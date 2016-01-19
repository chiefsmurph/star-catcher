var pg = require('pg');
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

  socket.on('usernameSubmit', function(data) {
    console.log(data.username);
    setTimeout(function() {
      var includesBad = false;
      var badWords = ['fuck', 'cock', 'pus', 'dick', 'bastard', 'cunt', 'ass', 'nig', 'bitch'];
      for (var i = 0; i < badWords.length; i++) {
        if (data.username.toLowerCase().indexOf(badWords[i]) !== -1) {
          includesBad = true;
        }
      }
      if (data.username.length < 4 || data.username.length > 9) {
        socket.emit('username-feedback', {
          res: 'bad',
          msg: 'must be between 4-9 characters long'
        });
      } else if (data.username.indexOf(' ') !== -1) {
        socket.emit('username-feedback', {
          res: 'bad',
          msg: 'must not include spaces'
        });
      } else if (includesBad) {
        socket.emit('username-feedback', {
          res: 'bad',
          msg: 'no curse words'
        });
      } else {
        socket.emit('username-feedback', {
          res: 'good',
          msg: 'congratulations, you are good to go'
        });
      }

    }, 1000);
  });

});
