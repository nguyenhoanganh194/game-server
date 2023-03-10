# DS-project
 The DS project oulu course
## Project Instructions:

Install docker and deploy the auth server.
When the auth server is deployed. Replay the "LoadServerURL" in index.js by the auth server ip.
 ```docker
docker build -t game_server .
docker run -it -p {portHTTP}:{9000} -p {portWS}:{8080} game_server
```


