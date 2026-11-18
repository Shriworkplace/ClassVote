const socketIo = require('socket.io');
const { socketCorsOptions } = require('./config/security');

module.exports = function(server) {
    const io = socketIo(server, {
        cors: socketCorsOptions(),
    });

    io.on('connection', (socket) => {
        console.log('New client connected: ' + socket.id);

        socket.on('join-election', (electionId) => {
            if (typeof electionId === 'string' && /^[a-f\d]{24}$/i.test(electionId)) {
                socket.join(`election:${electionId}`);
            }
        });

        socket.on('leave-election', (electionId) => {
            if (typeof electionId === 'string') {
                socket.leave(`election:${electionId}`);
            }
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected: ' + socket.id);
        });
    });

    return io;
};
