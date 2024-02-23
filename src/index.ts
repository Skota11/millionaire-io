import { serve } from "https://deno.land/std/http/server.ts";
import { Server } from "https://deno.land/x/socket_io/mod.ts";

const io = new Server();

const data = new Map();
const roomsInviteNumber = new Map();
const roomsId = new Map();

io.on("connection", (socket) => {
    socket.on("createNewRoom", (msg) => {
        const id = crypto.randomUUID();
        io.to(socket.id).emit("NewRoomId", { id: id });
        data.set(id, msg)
    })
    socket.on("joinRoom", (msg) => {
        if (socket.rooms.size == 2) {
            socket.leave(Array.from(socket.rooms)[1])
        }
        socket.join(msg.roomId);
        const socketRoom = Array.from(socket.rooms)[1]
        io.to(socketRoom).emit("Join", { username: msg.username, roomSettings: data.get(socketRoom), id: socketRoom })
        socket.data.username = msg.username;
        socket.data.room = socketRoom
    })
    socket.on("getInviteNumber", (msg) => {
        const socketRoom = Array.from(socket.rooms)[1]
        if (msg == socketRoom) {
            if (roomsInviteNumber.has(msg)) {
                io.to(socket.id).emit("inviteNumber", roomsInviteNumber.get(msg))
            } else {
                const temp = Math.floor(Math.random() * (19999 + 1 - 11000)) + 11000
                const number = ('' + temp).slice(-4)
                roomsInviteNumber.set(msg, number)
                roomsId.set(number, msg)

                io.to(socket.id).emit("inviteNumber", roomsInviteNumber.get(msg))
            }
        }
    })
    socket.on("getRoomId", (msg) => {
        if (roomsId.has(msg.toString())) {
            io.to(socket.id).emit("roomId", roomsId.get(msg.toString()))
        } else {
            io.to(socket.id).emit("roomId", "invalidNumber")
        }
    })
    socket.on("disconnect", () => {
        if (socket.data.room !== undefined) {
            io.to(socket.data.room).emit("Leave", { id: socket.id, username: socket.data.username })
        }
    });
});

await serve(io.handler(), {
    port: 8000,
});