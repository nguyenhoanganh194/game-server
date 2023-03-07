import { WebSocketServer } from 'ws';
import Ic from 'isepic-chess';
import express, { json, urlencoded } from 'express';
import crypto from 'crypto';
import axios from 'axios'
const app = express();
const port = 9000;
const wssPort = 8080;
const wss = new WebSocketServer({ port: wssPort });
const clients = {};
const rooms = {};

var aiServer = null;


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

app.post("/aiserver",(request, response) => {
  const authorizationHeader = request.headers.authorization;
  if (!authorizationHeader) {
    console.log("Missing headers");
    response.status(401).send('Authorization header is missing');
    return;
  } else {
    if (authorizationHeader !== 'valid_token') {
      console.log("Invalid token");
      response.status(401).send('Invalid token');
      return;
    } 
    aiServer = request.body.url;
    console.log(aiServer);
    response.status(200).send("ok");
  }
});


wss.on('connection', (connection, req) => {
  if(req.headers.token != "valid_token"){
    connection.close(4500,"Wrong token");
    return;
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
  SendUpdateToLoadbalancer();
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
      case "GetMyStatus":
        var message = {
          command: "GetMyStatus",
          value: JSON.stringify({
            gui: gui,
            roomid : clients[gui].roomid,
            username : clients[gui].username
          })
        }
        connection.send(JSON.stringify(message));
        break;
        case "GetReady":
          GetReady(command,connection,gui);
          break;
        case "Move":
          Move(command,connection,gui);
          break;
    }
    
  });

  connection.on('close', function() {
    console.log("client left.");
    LeaveRoom("command",connection,gui);
    delete clients[gui];
  });

});

function CreateRoom(command, connection, gui){
  if(clients[gui].roomid == null){
    var room = {
      white : gui,
      whiteReady : false,
      black : null,
      blackReady : false,
      board : Ic.Ic.initBoard()
    }
    console.log(command.value);
    if(command.value == "True"){
      room.black ="AI";
      room.blackReady = true;
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
  var message = {
    command: "LeaveRoom",
    value: "Deny"
  }
  if( room != null){
    if(room.black == gui){
      room.black = null;
    }
    if(room.white == gui){
      room.white = null;
    }
    if(room.black == null && room.white == null){
      delete rooms[clients[gui].roomid];
    }
    else if(room.black == "AI" && room.white == null){
      delete rooms[clients[gui].roomid];
    }
    clients[gui].roomid = null;
    message.value ="Accept";
  }
  connection.send(JSON.stringify(message));
}

function JoinRoom(command, connection, gui){
  var isAdd = false;
  if(clients[gui].roomid == null){
    var room = rooms[command.value];
    if(room != null){
      if(room.white == null){
        room.white = gui;
        clients[gui].roomid = command.value;
        isAdd = true;
      }
      else if(room.black == null){
        room.black = gui;
        clients[gui].roomid = command.value;
        isAdd = true;
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
  var room = GetRoomFromClient(gui);
  if(room != null){
    var message = {
      command: "GetMyRoomStatus",
      value: JSON.stringify(room)
    }
    connection.send(JSON.stringify(message));
    return;
  }
  var message = {
    command: "GetMyRoomStatus",
    value: "Deny"
  }
  connection.send(JSON.stringify(message));
}

function GetReady(command, connection, gui){
  var room = GetRoomFromClient(gui);
  if(room != null){
    if(room.white == gui){
      room.whiteReady = true;
    }
    else if(room.black == gui){
      room.blackReady = true;
    }
    var message = {
      command: "GetReady",
      value: "Accept"
    }
    connection.send(JSON.stringify(message));
    return;
  }
  
  var message = {
    command: "GetReady",
    value: "Deny"
  }
  connection.send(JSON.stringify(message));
}

function Move(command, connection, gui){
  var room = GetRoomFromClient(gui);
  if(room != null){
    if(room.whiteReady == true && room.blackReady == true){
      var move = command.value;
      var allowMove = false;
      if(room.board.activeColor == 'w' && gui == room.white)
      {
        allowMove = true;
      }
      else if(room.board.activeColor == 'b' && gui == room.black)
      {
        allowMove = true;
      }
      if(allowMove == true){
        room.board.playMove(move);
      }
      var message = {
        command: "Move",
        value: room.board.fen
      }
      try{
        if(room.white != null){
          clients[room.white].connection.send(JSON.stringify(message));
        }
        if(room.black != null && room.black != "AI"){
          clients[room.black].connection.send(JSON.stringify(message));
        }
      }
      catch{

      }
      if(room.board.activeColor == 'b' && room.black == "AI"){
        GetMoveFromAI(room.board, function(callbackData){
          if(callbackData == false){
            return;
          }
          if(callbackData.data){
            room.board.playMove(callbackData.data);
          }
          var message = {
            command: "Move",
            value: room.board.fen
          }

          try{
            if(room.white != null){
              clients[room.white].connection.send(JSON.stringify(message));
            }
          }
          catch{
          }
        });
      }
      
      return;
    }
  
  }
  var message = {
    command: "Move",
    value: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  }
  connection.send(JSON.stringify(message));
}

function GetRoomFromClient(gui){
  var roomid = clients[gui].roomid;
  if(roomid != null){
    var room = rooms[roomid];
    return room;
  }
  return null;
}

function GetMoveFromAI(board,callback){
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'valid_token'
  };
  if(aiServer == null){
    callback(false);
    return;
  }
  axios.post(aiServer, {
    fen: board.fen,
  }, { headers })
  .then((serverRespond) => {
    console.log("Receive AI move");
    callback(serverRespond);
  })
  .catch((error) => {
    console.log(error);
    callback(false);
  });
}
SendUpdateToLoadbalancer();
function SendUpdateToLoadbalancer(){
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'valid_token',
    'Port': port
  };
  axios.post('http://127.0.0.1:8001/gameserver', {
    numClients: Object.keys(clients).length,
    numRooms: Object.keys(rooms).length,
  }, { headers })
  .then((serverRespond) => {
    if(serverRespond.status == 200){
      aiServer = serverRespond.data;
      console.log(aiServer)
    }
  })
  .catch((error) => {
    console.log(error);
  });
};


const guid = () => (S4() + S4() + "-" + S4() + "-4" + S4().substr(0,3) + "-" + S4() + "-" + S4() + S4() + S4()).toLowerCase();
function S4() {
  return (((1+Math.random())*0x10000)|0).toString(16).substring(1); 
}