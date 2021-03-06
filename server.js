const { pgString } = require('./config');
var { Pool } = require('pg');

const pool = new Pool({
  connectionString: pgString
});
var fs = require('fs');
var express = require('express');
var util = require('util');
var app = express();

// var options = {
//   key: fs.readFileSync('/etc/letsencrypt/live/chiefsmurph.com/privkey.pem'),
//   cert: fs.readFileSync('/etc/letsencrypt/live/chiefsmurph.com/cert.pem'),
//   ca: fs.readFileSync('/etc/letsencrypt/live/chiefsmurph.com/chain.pem')
// };

// var server = require('http').Server(app);
var uuid = require('node-uuid');

var port = process.env.PORT || 5000; // Use the port that Heroku
const server = app.listen(port);

var io = require('socket.io')(server, {
  // path: '/starcatcher/socket.io'
});
console.log('listening for http and socket requests on port ' + port);
// console.log('process.env.DATABASE_URL', process.env.DATABASE_URL);
var bodyParser = require('body-parser')
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())
app.use(express.static(__dirname + '/public'));


var users = [];

// CREATE TABLE players

// read all users

pool.query('SELECT * FROM players', function(err, result) {
    console.log(err, result);
    users = result.rows;
});


var verifyUser = function(userObj, cb) {
  console.log('verifying...' + JSON.stringify(userObj));
  var queryText = 'SELECT * FROM players WHERE username = \'' + userObj.username + '\' AND handshake = \'' + userObj.handshake + '\'';
  pool.query(queryText, function(err, result) {
      if (err)  console.error(err);
      var authorized = (result.rows.length);
      console.log('checking user ' + userObj.username + ' ' + authorized);
      cb(authorized);
  });
}


io.on('connection', function(socket) {

  var startTime;
  var username;

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
        } else if (!username) {

          var handshake = uuid.v1();
          var queryText = 'INSERT INTO players (username, dateset, starscaught, handshake) VALUES($1, $2, $3, $4)';
    
          pool.query(queryText, [data.username, 'today', 0, handshake], function(err, result) {

            username = data.username;

            if (err)  console.error(err);
            console.log('created new user ' + data.username);
            socket.emit('username-feedback', {
              res: 'good',
              msg: 'congratulations, you are good to go',
              handshake: handshake
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

        var nowTime = new Date().getTime();
        var ratio = data.starsCaught / (nowTime-startTime) ;

        console.log(data.username + ' submitting ' + data.starsCaught + ' (ratio: ' + ratio + ')');

        if (startTime && ratio < 0.006) {

          startTime = null;

          // update with new record
          var handshake = uuid.v1();

          //console.log('about to insert');
          var dateNow = new Date().toISOString().slice(0, 10);
          dateNow = dateNow.substr(5) + '-' + dateNow.substr(0, 4);
          var queryText = 'UPDATE "players" SET "handshake"=\'' + handshake + '\', "starscaught"=' + data.starsCaught + ', "dateset"=\'' + dateNow + '\' WHERE "username"=\'' + data.username + '\'';

          //console.log(queryText);

          pool.query(queryText, function(err, result) {
            if (err) console.error(err);
            socket.emit('hsSuccess', {
              handshake: handshake,
              starsCaught: data.starsCaught
            });
          });
        }
      } else {
        console.log('attack mode');
        socket.emit('hsSuccess', {
          handshake: 'suckonthat',
          starsCaught: data.starsCaught
        });
      }

    });
  });


  socket.on('getHS', function() {
    pool.query('select distinct username, dateset, starscaught from players where starscaught > 0 order by starscaught desc limit 10', function(err, result) {
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
