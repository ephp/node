var express = require('express')
        , app = express()
        , server = require('http').createServer(app)
        , io = require('socket.io').listen(server)
        , sugar = require('sugar')
        , fs = require('fs')
        , mysql = require('mysql')
        ;

var chat_port = 0;
var database_host = '127.0.0.1';
var database_port = 3306;
var database_name = 'node_db';
var database_user = 'root';
var database_password = null;
var db_pool = null;

//var parameters_file = 'D:/htdocs/italiaccessibile/vendor/ephp/node/Ephp/NodeBundle/Resources/node.js/parameters.yml';
var parameters_file = './app/config/parameters.yml';

fs.readFile(parameters_file, 'utf8', function(err, data) {
    function readParam(parameters, parameter, default_value) {
        out = '';
        start = parameters.search(parameter);
        if (start > 0) {
            start += parameter.length;
            out = parameters.substr(start);
            end = out.search('\n');
            if (end > 0) {
                out = out.substr(0, end).trim();
            } else {
                out = out.trim();
            }
        }
        out = out.replace(/^null$/i, '') !== '' ? out : default_value;
        return out;
    }
    if (err) {
        return console.log(err);
    }
    // Abilito il listener della chat
    chat_port = readParam(data, 'node.chat.port:', chat_port);
    server.listen(chat_port);
    console.log('Chat enabled');

    database_host = readParam(data, 'database_host:', database_host);
    database_port = readParam(data, 'database_port:', database_port);
    database_name = readParam(data, 'database_name:', database_name);
    database_user = readParam(data, 'database_user:', database_user);
    database_password = readParam(data, 'database_password:', database_password);

    db_pool = mysql.createPool({
        database: database_name,
        port: database_port,
        host: database_host,
        user: database_user,
        password: database_password
    });
    console.log('Connected to db');

});

var array_dc2type = function(data) {
    inner = '';
    i = 0;
    data.each(function(elem) {
        inner += 'i:' + i + ';s:' + elem.length + ':"' + elem + '";';
        i++;
    });
    return 'a:' + data.length + ':{' + inner + '}';
};

var dc2type_array = function(data) {
    out = [];
    data = data.replace(/(a|s|i):[0-9]+(:|;)/g, '').replace(/\{/, '[').replace(/;\}/, ']').replace(/;/, ',');
    return eval(data);
};

var guid = function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : r & 0x3 | 0x8;
        return v.toString(16);
    });
};

// routing di express ??
app.get('/', function(req, res) {
    res.sendfile(__dirname + '/example.html');
});

// username degli utenti che sono in chat
var users = {};

io.sockets.on('connection', function(socket) {

    var reload_page = true;

    /**
     * emits 'adduser'
     * 
     * Aggiunge un utente in chat e lo fa entrare nella stanza default
     * @var username string username adottato in chat
     */
    socket.on('adduser', function(user, messages, room) {
        reload_page = true;
        // memorizzo i messaggi
        socket.messages = messages;
        // memorizzo l'username nella sessione del socket associata al client
        socket.username = user;
        // preparo le rooms
        socket.rooms = [];
        //Aggiungo l'utente fra quelli attivi
        addUser(socket, user);
        // memorizzo la stanza di default nella sessione del socket associata al client
        room = room ? room : {chatroom: socket.messages.default_room, alias: socket.messages.default_room};
        // faccio entrare l'utente nella stanza default
        joinRoom(socket, room, user);

    });

    /**
     * emits 'sendchat'
     * 
     * Riceve un messaggio da inviare in una stanza della chat
     * @var data string messaggio di chat
     */
    socket.on('sendchat', function(data) {
        // invia il messaggio di chat alla stanza tramite il comando 'updatechat'
        sendChat(socket, data, function(out) {
            io.sockets.in(socket.room).emit('updatechat', socket.username, out);
        });
    });

    /**
     * emits 'switchRoom'
     * 
     * Permette di cambiare stanza
     * @var newroom string nuova stanza
     */
    socket.on('switchRoom', function(newroom) {
        // effettua lo switch
        joinRoom(socket, {id: newroom}, socket.username);
    });

    /**
     * emits 'disconnect'
     * 
     * Disconnessione dell'utene
     */
    socket.on('disconnect', function() {
        // remuovo l'utente dalla chat
        delete users[socket.username];
        setTimeout(function() {
            if (!users[socket.username]) {
                // aggiorno l'elenco utenti
                io.sockets.emit('updateusers', users);
                // notifico l'evento'
                console.log('SYSTEM: socket.messages.disconnect: ' + socket.messages.disconnect);
                socket.broadcast.emit('updatenotice', socket.messages.server, socket.messages.disconnect.replace(/__nickname__/g, socket.username));
                socket.leave(socket.room);
            }
        }, 30000);
    });
});

var sendChat = function(socket, data, callback) {
    db_pool.getConnection(function(error, connection) {
        if (error) {
            return console.log("Connection error");
        }
        chat = {
            id: guid(),
            chatroom_id: socket._room.id,
            user_id: users[socket.username].id,
            send_at: Date.create('now'),
            message: data,
            abuse: 0
        };
        connection.query('INSERT INTO chat_messages SET ?', chat, function(err, rows) {
            if (err) {
                return console.log(err);
            }
            connection.end();
            callback(chat);
        });
    });
};


var addUser = function(socket, user) {
    getUser(user, function(out) {
        users[user] = out;
        socket.emit('updateusers', users);
    });
};

var getUser = function(user, callback) {
    db_pool.getConnection(function(error, connection) {
        if (error) {
            return console.log("Connection error");
        }
        connection.query('SELECT id, nickname, gender, roles FROM ephp_users WHERE nickname = ' + connection.escape(user), function(err, rows) {
            if (err) {
                return console.log(err);
            }
            rows.each(function(row) {
                // aggiungo l'username del client all'elenco degli utenti attivi
                callback(row);
            });
            connection.end();
        });
    });
};

var joinRoom = function(socket, chatroom, user) {
    // memorizzo la stanza
    getChatroom(socket, chatroom, user, function(out) {
        if (chatroom.id) {
            // l'utente esce dalla stanza precedente
            socket.leave(socket.room);
            // invio le notifiche
            console.log('SYSTEM: socket.messages.exit: ' + socket.messages.exit);
            socket.broadcast.to(socket.room).emit('updatenotice', socket.messages.server, socket.messages.exit.replace(/__nickname__/g, socket.username));
        }
        // associo la chat alla stanza
        socket.room = out.chatroom;
        socket._room = out;
        socket.join(socket.room);
        // messaggio di benvenuto
        if (chatroom.id) {
            console.log('SYSTEM: socket.messages.reconnect: ' + socket.messages.reconnect);
            socket.emit('updatenotice', socket.messages.server, socket.messages.reconnect.replace(/__room__/g, socket.room));
        } else {
            console.log('SYSTEM: socket.messages.connect: ' + socket.messages.connect);
            socket.emit('updatenotice', socket.messages.server, socket.messages.connect.replace(/__nickname__/g, socket.username).replace(/__room__/g, socket.room));
        }
        // notifica di ingresso nella stanza default di un nuovo utente tramite il comando 'updatechat'
        console.log('SYSTEM: socket.messages.enter: ' + socket.messages.enter);
        socket.broadcast.to(socket.room).emit('updatenotice', socket.messages.server, socket.messages.enter.replace(/__nickname__/g, socket.username));
        // visualiza le rooma de3ll'utente e le spara
        getUserRooms(socket, user, 1);
    });
};

var getChatroom = function(socket, room, user, callback) {
    var out = null;
    db_pool.getConnection(function(error, connection) {
        if (error) {
            return console.log("Connection error");
        }
        var query = room.chatroom ? 'SELECT * FROM chat_room WHERE chatroom = ' + connection.escape(room.chatroom) : 'SELECT * FROM chat_room WHERE id = ' + connection.escape(room.id);
        connection.query(query, function(err, rows) {
            if (err) {
                return console.log(err);
            }
            rows.each(function(row) {
                out = row;
            });
            if (out === null) {
                chatroom = {
                    id: guid(),
                    chatroom: room.chatroom,
                    private: room.chatroom !== socket.messages.default_room,
                    users: array_dc2type([user]),
                    alias: array_dc2type([room.alias]),
                    locale: socket.messages.default_locale
                };
                connection.query('INSERT INTO chat_room SET ?', chatroom, function(err, rows) {
                    if (err) {
                        return console.log(err);
                    }
                    connection.query('SELECT * FROM chat_room WHERE chatroom = ' + connection.escape(room), function(err, rows) {
                        if (err) {
                            return console.log(err);
                        }
                        rows.each(function(row) {
                            out = row;
                        });
                        connection.end();
                        callback(out);
                    });
                });
            } else {
                var my_chatroom_user = dc2type_array(out.users);
                if (!my_chatroom_user.find(socket.username)) {
                    my_chatroom_user.add(socket.username);
                    var my_chatroom_alias = dc2type_array(out.alias);
                    my_chatroom_alias.add(room.alias);
                    connection.query('UPDATE chat_room SET users = ' + connection.escape(array_dc2type(my_chatroom_user)) + ', alias = ' + connection.escape(array_dc2type(my_chatroom_alias)) + ' WHERE id = ' + connection.escape(out.id), function(err, rows) {
                        if (err) {
                            return console.log(err);
                        }
                        connection.end();
                        callback(out);
                    });
                } else {
                    connection.end();
                    callback(out);
                }
            }
        });
    });
};

var getUserRooms = function(socket, user, pag) {
    db_pool.getConnection(function(error, connection) {
        if (error) {
            return console.log("Connection error");
        }
        connection.query("SELECT * FROM chat_room c WHERE (c.private = " + connection.escape(0) + ") OR (c.private = " + connection.escape(1) + " AND c.users LIKE " + connection.escape('%"' + user + '"%') + ") ORDER BY c.last_message_at DESC", function(err, rows) {
            if (err) {
                return console.log(err);
            }
            socket.rooms = [];
            rows.each(function(row) {
                var my_room_users = dc2type_array(row.users);
                var my_room_alias = dc2type_array(row.alias);
                var my_index = my_room_users.findIndex(socket.username);
                var my_room = {
                    'id': row.id,
                    'chatroom': row.chatroom,
                    'last_message': row.last_message_at,
                    'locale': row.locale,
                    'alias': my_room_alias[my_index]
                };
                socket.rooms.add(my_room);
            });
            connection.end();
            socket.emit('updaterooms', socket.rooms, socket.room);
        });
    });
};