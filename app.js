var express = require("express");
var app = express();
var serverPort = 4443;
var http = require("http");
var server = http.createServer(app);
var io = require("socket.io")(server);

var sockets = {};
var users = {};
const activeUser = [];

function sendTo(connection, message) {
  connection.send(message);
}
function socketIdsInRoom(name) {
  var socketIds = io.nsps["/"].adapter.rooms[name];
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

app.get("/", function (req, res) {
  console.log("get /");
  res.sendFile(__dirname + "/index.html");
});

io.on("connection", function (socket) {
  console.log("user connected");

  socket.on("disconnect", function () {
    console.log("user disconnected");
    if (socket.name) {
      socket.broadcast
        .to("chatroom")
        .emit("roommessage", { type: "disconnect", username: socket.name });
      delete sockets[socket.name];
      delete users[socket.name];
    }
  });

  socket.on("exchange", function (data) {
    console.log("exchange", data);
    data.from = socket.id;
    var to = io.sockets.connected[data.to];
    to.emit("exchange", data);
  });

  socket.on("join", function (name, callback) {
    console.log("join", name);
    var socketIds = socketIdsInRoom(name);
    callback(socketIds);
    socket.join(name);
    socket.room = name;
  });

  socket.on("login", (data) => {
    const existingUser = activeUser.find(
      (existingUser) => existingUser.roomId === data.roomId
    );

    if (!existingUser) {
      activeUser.push(data);
      const addUser = activeUser.filter(
        (existing) => existing.roomId !== data.roomId
      );

      socket.emit("updateUserList", addUser);
      socket.broadcast.emit("updateUserList", addUser);
    }
    if (sockets[data.name]) {
      socket.emit("login", {
        type: "login",
        success: false,
      });
    } else {
      sockets[data.name] = socket;
      socket.name = data.name;
      socket.roomId = data.roomId;
      socket.broadcast
        .to("chatroom")
        .emit("roommessage", { type: "login", username: data.name });
      socket.join(data.roomId);
      users[data.name] = socket.id;
    }
  });

  socket.on("call_disconnected", (data) => {
    if (sockets[data.name]) {
      sockets[data.name].emit("call_disconnected", {
        callername: data.name,
      });
    }
  });

  socket.on("call_user", (data) => {
    console.log(data, "data");
    if (sockets[data.name]) {
      sockets[data.name].emit("answer", {
        type: "answer",
        name: data.name,
        roomId: data.videoId,
        offer: data.offer,
      });
    } else {
      socket.emit("call_response", {
        type: "call_response",
        response: "offline",
        name: data.name,
      });
    }
  });

  socket.on("call_accepted", (data) => {
    sockets[data.callername].emit("call_response", {
      type: "call_response",
      response: "accepted",
      responsefrom: data.from,
    });
  });

  socket.on("call_busy", (data) => {
    sockets[data.callername].emit("call_response", {
      type: "call_response",
      response: "busy",
      responsefrom: data.from,
    });
  });

  socket.on("call_rejected", (data) => {
    sockets[data.callername].emit("call_response", {
      type: "call_response",
      response: "rejected",
      responsefrom: data.from,
    });
  });
});

const port = process.env.PORT || serverPort;
server.listen(port, function () {
  console.log("server up and running at %s port", port);
});
