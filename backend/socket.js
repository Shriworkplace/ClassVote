const socketIo = require('socket.io');
const { socketCorsOptions } = require('./config/security');

module.exports = function(server) {
    const io = socketIo(server, {
        cors: socketCorsOptions(),
    });

    io.on('connection', (socket) => {
        console.log('New client connected: ' + socket.id);

        socket.on('disconnect', () => {
            console.log('Client disconnected: ' + socket.id);
        });
    });

    return io;
};
