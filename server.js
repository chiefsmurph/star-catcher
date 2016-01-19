var pg = require('pg');
var express = require('express');
var util = require('util');
var app = express();
var server = require('http').Server(app);
var uuid = require('node-uuid');

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


var users = [];

// read all users
pg.connect(process.env.DATABASE_URL + "?ssl=true", function(err, client, done) {
  var queryText = 'SELECT * FROM players';
  client.query(queryText, function(err, result) {

    done();
    users = result.rows;

  });
});


var verifyUser = function(userObj, cb) {
  console.log('verifying...' + JSON.stringify(userObj));
  pg.connect(process.env.DATABASE_URL + "?ssl=true", function(err, client, done) {
    var queryText = 'SELECT * FROM players WHERE username = \'' + userObj.username + '\' AND handshake = \'' + userObj.handshake + '\'';
    client.query(queryText, function(err, result) {

      done();
      if (err)  console.error(err);
      var authorized = (result.rows.length);
      console.log('checking user ' + userObj.username + ' ' + authorized);
      cb(authorized);

    });
  });
}


io.on('connection', function(socket) {

  var startTime;

  console.log('connection');

  socket.on('usernameSubmit', function(data) {
    console.log(data.username);
    setTimeout(function() {

      var checkForBadWords = function(name) {
        var includesBad = false;
        var badWords = ['fuck', 'cock', 'pus', 'dick', 'bastard', 'cunt', 'ass', 'nig', 'bitch'];
        for (var i = 0; i < badWords.length; i++) {
          if (data.username.toLowerCase().indexOf(badWords[i]) !== -1) {
            includesBad = true;
          }
        }
        return includesBad;
      };

      var checkForAlreadyUsed = function(name) {
        var taken = false;
        users.forEach(function(userObj) {
          if (name === userObj.username) {
            taken = true;
          }
        });
        return taken;
      };


      if (data.username.length < 4 || data.username.length > 11) {
        socket.emit('username-feedback', {
          res: 'bad',
          msg: 'must be between 4-11 characters long'
        });
      } else if (data.username.indexOf(' ') !== -1) {
        socket.emit('username-feedback', {
          res: 'bad',
          msg: 'must not include spaces'
        });
      } else if (checkForBadWords(data.username)) {
        socket.emit('username-feedback', {
          res: 'bad',
          msg: 'no curse words'
        });
      } else if (checkForAlreadyUsed(data.username)) {
        socket.emit('username-feedback', {
          res: 'bad',
          msg: 'username already taken'
        });
      } else {

        var handshake = uuid.v1();

        pg.connect(process.env.DATABASE_URL + "?ssl=true", function(err, client, done) {
          var queryText = 'INSERT INTO players (username, dateset, starscaught, handshake) VALUES($1, $2, $3, $4)';
          client.query(queryText, [data.username, 'today', 0, handshake], function(err, result) {

            if (err)  console.error(err);

            done();
            console.log('created new user ' + data.username);
            socket.emit('username-feedback', {
              res: 'good',
              msg: 'congratulations, you are good to go',
              handshake: handshake
            });

          });
        });



      }

    }, 1000);
  });

  socket.on('verifyLogin', function(userObj) {
    verifyUser(userObj, function(authorized) {
      socket.emit('login-feedback', {
        res: authorized
      });
    });
  });

  socket.on('startgame', function() {
    console.log('startgame');
    startTime = new Date().getTime();
  });

  socket.on('sendScore', function(data) {
    verifyUser({
      username: data.username,
      handshake: data.handshake
    }, function(authorized) {
      if (authorized) {
        if (startTime) {


          // update with new record
          var handshake = uuid.v1();

          pg.connect(process.env.DATABASE_URL + "?ssl=true", function(err, client, done) {
            //console.log('about to insert');
            var dateNow = new Date().toISOString().slice(0, 10);
            dateNow = dateNow.substr(5) + '-' + dateNow.substr(0, 4);
            var queryText = 'UPDATE "players" SET "handshake"=\'' + handshake + '\', "starscaught"=' + data.starsCaught + ', "dateset"=\'' + dateNow + '\' WHERE "username"=\'' + data.username + '\'';

            //console.log(queryText);

            client.query(queryText, function(err, result) {
              done();
              if (err) console.error(err);
              socket.emit('hsSuccess', {
                handshake: handshake,
                starsCaught: data.starsCaught
              });
            });
          });
        }
      } else {
        console.log('attack mode');
      }
    });
  });


  socket.on('getHS', function() {
    pg.connect(process.env.DATABASE_URL + "?ssl=true", function(err, client, done) {
      client.query('select distinct username, dateset, starscaught from players order by starscaught desc limit 10;', function(err, result) {
        done();
        if (err) console.error(err);

        var passing = [];
        result.rows.forEach(function(row) {
          passing.push({
            username: row.username,
            starscaught: row.starscaught,
            dateset: row.dateset
          })
        });

        socket.emit('hs', {
          scores: passing
        });
      });
    });

  });

});
