import { Socket } from 'dgram';
import express, { json, urlencoded } from 'express';
import { Server } from 'socket.io';
import Http from 'http';

const app = express();
const port = 9000;

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
      var ticket = {
        "token": "valid_token",
        "gameserver": "http://127.0.0.1:9000/",
        "username": username,
        "time": Date.now(),
      } 
      console.log("valid_ticket");
      var ticketString = JSON.stringify(ticket)
      response.status(200).send(ticketString);
    }
  }
});

const http = Http.createServer(app);
const io = new Server(http);

io.on('connection', (socket) => {
  console.log('a user connected');
  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);
  });
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});
http.listen(9001, () => {
  console.log('Connected at 9001');
});
