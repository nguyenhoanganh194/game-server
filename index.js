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
        "gameserver": "http://127.0.0.1:" + wssPort.toString(),
        "username": username,
        "id" : clientId,
      } 
      var ticketString = JSON.stringify(ticket)
      clients[clientId] = {
        gui: username,
        connection: null,
        time : time
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
  if(clients[gui] == null){
    connection.close(4500,"Wrong token");
  } 


  connection.on("open", () => console.log("opened!"))
  connection.on("close", () => console.log("closed!"))

  connection.on('message', function(data) {
    if (typeof(data) === "string") {
      // client sent a string
      console.log("string received from client -> '" + data + "'");

    } else {
      console.log("binary received from client -> " + Array.from(data).join(", ") + "");
    }
  });

  connection.on('close', function() {
    console.log("client left.");
  });
  if(clients[])

});


function onNewMessage(message){

}

const guid = () => (S4() + S4() + "-" + S4() + "-4" + S4().substr(0,3) + "-" + S4() + "-" + S4() + S4() + S4()).toLowerCase();
function S4() {
  return (((1+Math.random())*0x10000)|0).toString(16).substring(1); 
}
