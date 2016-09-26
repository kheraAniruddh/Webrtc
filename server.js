//Modules
var io      = require("socket.io");         // web socket external module
var easyrtc = require("easyrtc");           // EasyRTC external module
var express = require('express');
var debug = require('debug')('webrtc2:server');
var https = require('https');
var fs = require('fs');
var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var config = require('./configuration/config');

var app = express();
app.use(passport.initialize());
app.use(passport.session());
var loggedIn = false;
var redirectURL;
var username, roomName;
   
// Passport session setup.
passport.serializeUser(function(user, done) {
  done(null, user);
});
passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

// Use the FacebookStrategy within Passport.
passport.use(new FacebookStrategy({
    clientID: config.facebook_api_key,
    clientSecret:config.facebook_api_secret ,
    callbackURL: config.callback_url
  },
  function(req, accessToken, refreshToken, profile, done) {
    process.nextTick(function () {
      //Check whether the User exists or not using profile.id
      //Further DB code.
      username = profile.displayName;
      loggedIn=true;
      return done(null, profile);
    });
  }
));


//Passport Router
app.get('/auth/facebook', passport.authenticate('facebook'));
app.get('/auth/facebook/callback', passport.authenticate('facebook', { 
       failureFlash: true  
 }),
  function(req, res) {
    res.redirect(redirectURL || '/');
  });


//Statically serve files in these directories  -easyRTC
app.use("/js", express.static(__dirname + '/easyrtc/js'));
app.use("/images", express.static(__dirname + '/easyrtc/images'));
app.use("/css", express.static(__dirname + '/easyrtc/css'));

//For my homepage
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(favicon(path.join(__dirname, 'public', './img/logo.png')));
app.use("/css", express.static(__dirname + '/public/css'));
app.use("/img", express.static(__dirname + '/public/img'));
app.use("/script", express.static(__dirname + '/public/script'));

// Needed to parse form data 
app.use(express.bodyParser());
app.get('/', function (req, res) {
    if (loggedIn === true) {
        res.render('index',
            { title: 'RHC- WebRTC', message: "Welcome "+ username }
        );
        console.log("homepage -logged in");
    }
    else {
        res.redirect('/auth/facebook');
        console.log("homepage -not logged in");
    }
});

//Initiate a video call
app.get('/video', function(req, res){
    if (loggedIn === true) {
         res.sendfile(__dirname + '/easyrtc/demo_multiparty.html');
         // res.sendfile(__dirname + '/easyrtc/demo_room.html');
    }
    else {
        redirectURL= req.path; 
        res.redirect('/auth/facebook');
        console.log("homepage -not logged in");
    }
});

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '5000');
app.set('port', port);

// https certificates
var options = {
    key: fs.readFileSync(__dirname + '/./certificates/key.pem'),
    cert: fs.readFileSync(__dirname + '/./certificates/cert.pem'),
};

/**
 * Create HTTPS server.
 */
var server = https.createServer(options,app);
var socketServer = io.listen(server);

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);
console.log("listening on", port);

  // Start EasyRTC server
//var easyrtcServer = easyrtc.listen(app, socketServer, {'apiEnable':'true'});
var easyrtcServer = easyrtc.listen(app, socketServer, null, function(err, rtc){
    if (err) throw err;
    rtc.createApp("myApp", null, function(err, appObj){
        if (err) throw err;

        aplicacion = appObj;

        appObj.createRoom("myRoomName", null, function(err, roomObj) {
            if (err) throw err;
            console.log("Room" + roomObj.getRoomName() + " has been created.");
            roomName = roomObj.getRoomName();
        });
    });
});

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}
