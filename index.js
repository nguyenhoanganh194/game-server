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
        gui: username,
        connection: null,
        time : time,
        room : null
      }
      response.status(200).send(ticketString);
    }
  }
});



wss.on('connection', (connection, req) => {
  console.log(req.headers.token);
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
    console.log(command);
    switch(command.command){
      case "Create":
        if(clients[gui].room == null){
          var room = {
            white : gui,
            black : null
          }
          var roomid = gui();
          rooms[roomid] = room;
          clients[gui].room = roomid;
        }
        break;
      case "Leave":
        var room = rooms[clients[gui].room];
        if( room != null){
          if(room.black == gui){
            room.black = null;
          }
          if(room.white == gui){
            room.white = null;
          }
          if(room.black == null && room.white == null){
            rooms[gui] = null;
          }
          clients[gui].room = null;
        }
        break;
      case "Join":
        if(clients[gui].room == null){
          var room = rooms[command.value.room];
          if(room != null){
            var isAdd = false;
            if(room.white == null){
              room.white = gui;
              isAdd = true;
            }
            else if(room.black == null){
              room.black = gui;
              isAdd = true;
            }
            if(isAdd){
              clients[gui].room = command.value.room;
            }
          }
        }
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
