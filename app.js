var express = require('express')
var app = express();
var serverPort = (4443);
var http = require('http');
var server = http.createServer(app);
var io = require('socket.io')(server);
 
var sockets = {};
var users = {};
 
function sendTo(connection, message) {
   connection.send(message);
}
function socketIdsInRoom(name) {
  var socketIds = io.nsps['/'].adapter.rooms[name];
  if (socketIds) {
    var collection = [];
    for (var key in socketIds) {
      collection.push(key);
    }
    return collection;
  } else {
    return [];
  }
}
 
app.get('/', function(req, res){
  console.log('get /');
  res.sendFile(__dirname + '/index.html');
});
 
io.on('connection', function(socket){
  console.log("user connected");
 
  socket.on('disconnect', function () {
    console.log("user disconnected");
    if(socket.name){
      socket.broadcast.to("chatroom").emit('roommessage',{ type: "disconnect", username: socket.name})
      delete sockets[socket.name];
      delete users[socket.name];
    }
 
  })

  socket.on('exchange', function(data){
    console.log('exchange', data);
    data.from = socket.id;
    var to = io.sockets.connected[data.to];
    to.emit('exchange', data);
  });
   socket.on('join', function(name, callback){
    console.log('join', name);
    var socketIds = socketIdsInRoom(name);
    callback(socketIds);
    socket.join(name);
    socket.room = name;
  });



  socket.on('login', (data)=>{
    console.log("User loggedIn", data.name);
    // check if user already exist, fail if it does
    if(sockets[data.name]) {
        socket.emit('login', {
            type: "login",
            success: false
         })
      } else {
         //save user connection on the server
         var templist = users;
         // saves the socket connection to socket object
         sockets[data.name] = socket;
         // adding name to socket connection
         socket.name = data.name;
         socket.emit('login', {
            type: "login",
            success: true,
            username: data.name,
            userlist: templist
         })
         socket.broadcast.to("chatroom").emit('roommessage',{ type: "login", username: data.name})
         socket.join(data.roomId);
         // eg {userA: "LvUal-89gmGJCLRIAAAC", userb: "qkFEHHv7cfb3MH8wAAAA"}
         users[data.name] = socket.id
         // console.log(socket)

      }
  })
  socket.on('call_disconnected', (data) => {
    if(sockets[data.name]){
      sockets[data.name].emit( 'call_disconnected', {
           
           callername: data.name,
      
        });
    }
  })

  socket.on('call_user', (data)=> {
    // chek if user u calling exist

        if(sockets[data.name]){
          console.log("user called");
          console.log(data.name);
          console.log(data.callername);
          console.log(data.videoId);
          // emiting to d user who u calling
          sockets[data.name].emit( 'answer', {
           type: "answer",
           callername: data.callername,
           videoId: data.videoId
        });
      }else{
        socket.emit('call_response', {
           type: "call_response",
           response: "offline", 
           name: data.name
        });
      }
  })

  socket.on('call_accepted', (data)=>{
    // send to d person calling
    sockets[data.callername].emit('call_response', {
         type: "call_response",
         response: "accepted",
         responsefrom : data.from
      } )
  })

  socket.on('call_busy', (data)=>{
    sockets[data.callername].emit('call_response', {
         type: "call_response",
         response: "busy",
         responsefrom : data.from
      } )
  })

  socket.on('call_rejected', (data)=>{
    // send to d person calling
    sockets[data.callername].emit('call_response', {
         type: "call_response",
         response: "rejected",
         responsefrom : data.from
      } )
  })

 })

 const port = process.env.PORT || serverPort
server.listen(port, function(){
   console.log('server up and running at %s port', port);
 });