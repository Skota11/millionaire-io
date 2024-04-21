import { serve } from "https://deno.land/std/http/server.ts";
import { Server } from "https://deno.land/x/socket_io/mod.ts";
import { Application } from "https://deno.land/x/oak/mod.ts";

import { cards } from "./cards.ts";

const app = new Application();

const io = new Server({cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }});

const GameData = new Map();
const roomsInviteNumber = new Map();
const roomsId = new Map();
const startingRoom = new Map();
const PlayerCards = new Map();
const PlayerNames = new Map();
const RoomsTurn = new Map();
const RoomsPass = new Map();
const RoomsPlayer = new Map();
const winThrougthPlayer = new Map();
const CardsNumber = new Map();

io.on("connection", (socket) => {
    socket.on("createNewRoom", (msg) => {
        const id = crypto.randomUUID();
        io.to(socket.id).emit("NewRoomId", { id: id });
        GameData.set(id, msg)
        startingRoom.set(id , false)
    })
    socket.on("joinRoom", (msg) => {
        if (socket.rooms.size == 2) {
            socket.leave(Array.from(socket.rooms)[1])
        }
        socket.join(msg.roomId);
        const socketRoom = Array.from(socket.rooms)[1]
        io.to(socketRoom).emit("Join", { username: msg.username, roomSettings: GameData.get(socketRoom), id: socketRoom })
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
        if (io.of("/").adapter.rooms.get(msg).size <= 2) {
            io.to(socket.id).emit("gameStart" , {already : false , not : true})
    }else if(startingRoom.get(msg)) {
        io.to(socket.id).emit("gameStart" , {already : true , not : false})
    }else {
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
                io.to(element).emit("getCards" , PlayerCards.get(element))
            }
            for (let index = 0; index < array.length; index++) {
                const element = array[index];
                CardsNumber.set(element , PlayerCards.get(element).length)
            }

            io.to(socketRoom).emit("Turn" , array[0])
            RoomsTurn.set(socketRoom , array[0]);
            RoomsPlayer.set(socketRoom , array)
        }
    }
    })
    socket.on("getPlayerName", (id) => {
        io.to(socket.id).emit("getPlayerName" , Object.fromEntries(PlayerNames))
    })
    socket.on("getCardsNumber", (msg:any) => {
        io.to(socket.id).emit("getCardsNumber" , Object.fromEntries(CardsNumber))
    })
    socket.on("Play" , (msg) => {
        const socketRoom = Array.from(socket.rooms)[1]
        const array = RoomsPlayer.get(socketRoom)
        if (RoomsTurn.get(socketRoom) == msg.sid) {
            io.to(socketRoom).emit("Play" , msg)
            if (!msg.pass && (GameData.get(socketRoom)["eight"] && msg?.cards[0]?.num == 8)) {
                    io.to(socketRoom).emit("Turn" , msg.sid)
                    io.to(socketRoom).emit("TurnReset")
                    RoomsTurn.set(socketRoom , msg.sid)
            }else if (msg.spade){
                io.to(socketRoom).emit("Turn" , msg.sid)
                    io.to(socketRoom).emit("TurnReset")
                    RoomsTurn.set(socketRoom , msg.sid)
            }else {
            if (msg.pass) {
                RoomsPass.set(socketRoom , RoomsPass.get(socketRoom) + 1)
                console.log("pass" , RoomsPass.get(socketRoom))
                console.log(array.length - 1)
            }else {
                RoomsPass.set(socketRoom , 0)
            }
            if (RoomsPass.get(socketRoom) == array.length - 1) {
                io.to(socketRoom).emit("TurnReset")
                console.log("reset")
                RoomsPass.set(socketRoom , 0)
            }
            const turnIndex = array.indexOf(msg.sid);
            let turnNextIndex;
            if (array.length - 1 == turnIndex) {
                turnNextIndex = 0
            } else {
                turnNextIndex = turnIndex + 1
            }
            io.to(socketRoom).emit("Turn" , array[turnNextIndex])
            RoomsTurn.set(socketRoom , array[turnNextIndex])
            }

            if (!msg.pass) {
                const playerCard = PlayerCards.get(msg.sid)
                msg.cards.map((card:any) =>{
                    const index = playerCard.findIndex(e => e.num == card.num && e.suit == card.suit)
                    playerCard.splice(index , 1)
                })
                PlayerCards.set(msg.sid , playerCard)
            }
            if (PlayerCards.get(msg.sid).length == 0) {
                array.splice(array.indexOf(msg.sid) , 1)
                RoomsPlayer.set(socketRoom , array)
                io.to(msg.sid).emit("winThrougth" , msg.sid)
            }
            CardsNumber.set(msg.sid , PlayerCards.get(msg.sid).length)
            io.to(msg.sid).emit("getCards" , PlayerCards.get(msg.sid))
        }
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
