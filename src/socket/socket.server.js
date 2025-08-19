const { Server } = require("socket.io");
const aiService = require('../services/ai.service')




function setupSocketServer(httpServer) {
  const io = new Server(httpServer,{});

  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

socket.on("userMessage",async (message) => {

const result = await aiService.generateContent(message);


  console.log("Received message from client:", message);
  console.log(result);

    socket.emit("userMessage", result);


});




    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  return io;
}


module.exports = setupSocketServer;