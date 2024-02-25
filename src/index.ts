import { serve } from "https://deno.land/std/http/server.ts";
import { Server } from "https://deno.land/x/socket_io/mod.ts";
import { Application } from "https://deno.land/x/oak/mod.ts";

import { cards } from "./cards.ts";

const app = new Application();

const io = new Server({cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }});

const data = new Map();
const roomsInviteNumber = new Map();
const roomsId = new Map();
const startingRoom = new Map();
const PlayerCards = new Map();
const PlayerNames = new Map();

io.on("connection", (socket) => {
    socket.on("createNewRoom", (msg) => {
        const id = crypto.randomUUID();
        io.to(socket.id).emit("NewRoomId", { id: id });
        data.set(id, msg)
        startingRoom.set(id , false)
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

        PlayerNames.set(socket.id , msg.username);
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
    socket.on("getRoomMember" , (msg) => {
        const members = io.of("/").adapter.rooms;
        io.to(socket.id).emit("getRoomMember" , Array.from(members.get(msg)))
    })
    socket.on("gameStart", (msg) => {
        console.log(io.of("/").adapter.rooms.get(msg).size)
        if (!startingRoom.get(msg) && io.of("/").adapter.rooms.get(msg).size !== 1) {
            const socketRoom = Array.from(socket.rooms)[1]
        if (msg == socketRoom) {
            //gameStart
            io.to(socketRoom).emit("gameStart" , {already : false , not : false})
            startingRoom.set(msg , true)

            const gameSetCards = [...cards];
            const members = io.of("/").adapter.rooms.get(msg);
            const array = Array.from(members)
            const oneMemberCards = Math.floor(53 / members.size);
            
            for (let index = 0; index < array.length; index++) {
                const playerId = array[index];
                const temp:any = [];
                for (let index = 0; index < oneMemberCards; index++) {
                    const random = Math.floor(Math.random() * (gameSetCards.length))
                    const element = gameSetCards[random];
                    temp.push(element)
                    gameSetCards.splice(random , 1)
                }
                PlayerCards.set(playerId , temp)
            }
            if (gameSetCards.length > 0) {
                for (let index = 0; index < gameSetCards.length; index++) {
                    let indexN = index;
                    if (index > array.length) {
                        indexN = index - array.length
                    }
                    const temp = Array.from(PlayerCards.get(array[indexN]))
                    temp.push(gameSetCards[index])
                    PlayerCards.set(array[indexN] , temp)
                }
            }

            //手札をプレイヤーに送信
            for (let index = 0; index < array.length; index++) {
                const element = array[index];
                console.log(element)
                console.log(PlayerCards.get(element))
                io.to(element).emit("getCards" , PlayerCards.get(element))
            }
        }
    }else if(io.of("/").adapter.rooms.get(msg).size == 1) {
        io.to(socket.id).emit("gameStart" , {already : false , not : true})
    }else {
        io.to(socket.id).emit("gameStart" , {already : true , not : false})
    }
    })
    socket.on("getPlayerName", (id) => {
        io.to(socket.id).emit("getPlayerName" , Object.fromEntries(PlayerNames))
        console.log(Object.fromEntries(PlayerNames))
    })
    socket.on("disconnect", () => {
        if (socket.data.room !== undefined) {
            io.to(socket.data.room).emit("Leave", { id: socket.id, username: socket.data.username })
        }
    });
});

const handler = io.handler(async (req) => {
    return await app.handle(req) || new Response(null, { status: 404 });
  });
  
  await serve(handler, {
    port: 8000,
  });