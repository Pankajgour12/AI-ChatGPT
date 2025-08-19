
const http = require('http');
const app =require('./src/app')
const connectDB = require('./src/db/db')
const setupSocketServer = require('./src/socket/socket.server')

const httpServer = http.createServer(app);



setupSocketServer(httpServer);

connectDB();

httpServer.listen(3000, () => {

    console.log('server is runnig on port 3000')
})