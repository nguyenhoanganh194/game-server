import { WebSocketServer } from 'ws';
import express, { json, urlencoded } from 'express';
import crypto from 'crypto';
const app = express();
const port = 9000;
const wssPort = 8080;
const wss = new WebSocketServer({ port: wssPort });
const clients = {};
const rooms = {};

app.use(json())
app.use(urlencoded({ extended: true }))
app.listen(port, (err) => {
  if (err) {
    return console.log('something bad happened', err)
  }
  console.log(`server is listening on ${port}`)
})


app.post("/ticket",(request, response) => {
  const authorizationHeader = request.headers.authorization;
  if (!authorizationHeader) {
    console.log("Missing headers");
    response.status(401).send('Authorization header is missing');
  } else {
    if (authorizationHeader !== 'valid_token') {
      console.log("Invalid token");
      response.status(401).send('Invalid token');
    } else {
      var username = request.body.username;
      const clientId = guid();
      var time = Date.now();
      var ticket = {
        "token": "valid_token",
        "gameserver": "ws://127.0.0.1:" + wssPort.toString(),
        "username": username,
        "id" : clientId,
      } 
      var ticketString = JSON.stringify(ticket)
      clients[clientId] = {
        username: username,
        connection: null,
        time : time,
        roomid : null
      }
      response.status(200).send(ticketString);
    }
  }
});



wss.on('connection', (connection, req) => {
  if(req.headers.token != "valid_token"){
    connection.close(4500,"Wrong token");
  }
  var gui = req.headers.gui;

  //Check gui and time stamp here
  if(clients[gui] == null){
    connection.close(4500,"Wrong gui");
  } 
  var accept = {
    command: "Login",
    value: "Accept"
  }
  connection.send(JSON.stringify(accept));
  clients[gui].connection = connection;

  connection.on("open", () => console.log("opened!"))
  connection.on("close", () => console.log("closed!"))

  connection.on('message', function(data) {
    var gui = req.headers.gui;
    if( clients[gui].connection != connection){
      connection.close(4501,"Diff connect");
    }   
    var command = JSON.parse( data.toString());
    switch(command.command){
      case "CreateRoom":
        CreateRoom(command,connection,gui);
        break;
      case "LeaveRoom":
        LeaveRoom(command,connection,gui);
        break;
      case "JoinRoom":
        JoinRoom(command,connection,gui);
        break;
      case "GetRooms":
        GetRooms(command,connection,gui);
        break;
      case "GetMyRoomStatus":
        GetMyRoomStatus(command,connection,gui);
        break;
    }
    
  });

  connection.on('close', function() {
    console.log("client left.");
  });

});


const guid = () => (S4() + S4() + "-" + S4() + "-4" + S4().substr(0,3) + "-" + S4() + "-" + S4() + S4() + S4()).toLowerCase();
function S4() {
  return (((1+Math.random())*0x10000)|0).toString(16).substring(1); 
}


function CreateRoom(command, connection, gui){
  if(clients[gui].roomid == null){
    var room = {
      white : gui,
      whiteReady : false,
      black : null,
      blackReady : false
    }
    var roomid = guid();
    rooms[roomid] = room;
    clients[gui].roomid = roomid;
    console.log("New room created " + roomid);
    var message = {
      command: "CreateRoom",
      value: "Accept"
    }
    connection.send(JSON.stringify(message));
    return;
  }
  var message = {
    command: "CreateRoom",
    value: "Deny"
  }
  connection.send(JSON.stringify(message));
}

function LeaveRoom(command, connection, gui){
  var room = rooms[clients[gui].roomid];
  if( room != null){
    if(room.black == gui){
      room.black = null;
    }
    if(room.white == gui){
      room.white = null;
    }
    if(room.black == null && room.white == null){
      rooms[clients[gui].roomid] = null;
    }
    clients[gui].roomid = null;
    var message = {
      command: "LeaveRoom",
      value: "Accept"
    }
    connection.send(JSON.stringify(message));
  }
}

function JoinRoom(command, connection, gui){
  var isAdd = false;
  if(clients[gui].roomid == null){
    var room = rooms[command.value];
    if(room != null){
      if(room.white == null){
        room.white = gui;
        isAdd = true;
      }
      else if(room.black == null){
        room.black = gui;
        isAdd = true;
      }
      if(isAdd){
        clients[gui].roomid = command.value.room;
      }
    }
  }
  var message = {
    command: "JoinRoom",
    value: ""
  }
  if(isAdd){
    message.value = "Accept";
  }
  else{
    message.value = "Deny";
  }
  connection.send(JSON.stringify(message));
}

function GetRooms(command, connection, gui){
  var message = {
    command: "GetRooms",
    value: JSON.stringify(rooms)
  }
  connection.send(JSON.stringify(message));
}

function GetMyRoomStatus(command, connection, gui){
  var roomid = clients[gui].roomid;
  console.log(roomid);
  if(roomid != null){

    var room = rooms[roomid];
    console.log(room);
    if(room != null){
      var message = {
        command: "GetMyRoomStatus",
        value: JSON.stringify(room)
      }
      connection.send(JSON.stringify(message));
      return;
    }
  }
  var message = {
    command: "GetMyRoomStatus",
    value: "Deny"
  }
  connection.send(JSON.stringify(message));
}
