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

var tb_users = 'ephp_users';
var tb_chat_room = 'chat_room';
var tb_chat_messages = 'chat_messages';
var chat_open_room = true;
var chat_one_to_one = true;
var chat_group_room = false;

var config_file = './app/config/config.yml';
var parameters_file = './app/config/parameters.yml';

fs.readFile(config_file, 'utf8', function(err, data) {
    if (err) {
        return console.log(err);
    }
    // Abilito il listener della chat
    tb_users = readParam(data, 'tb_users:', tb_users);
    tb_chat_room = readParam(data, 'tb_chat_room:', tb_chat_room);
    tb_chat_messages = readParam(data, 'tb_chat_messages:', tb_chat_messages);
    chat_open_room = readParam(data, 'chat_open_room:', chat_open_room);
    chat_one_to_one = readParam(data, 'chat_one_to_one:', chat_one_to_one);
    chat_group_room = readParam(data, 'chat_group_room:', chat_group_room);
});

fs.readFile(parameters_file, 'utf8', function(err, data) {
    if (err) {
        return console.log(err);
    }
    // Abilito il listener della chat
    chat_port = readParam(data, 'node.chat.port:', chat_port);
    server.listen(chat_port);
    console.log('Chat enabled on port ' + chat_port);

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

var readParam = function(parameters, parameter, default_value) {
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
    if (out.search(/^null$/i) >= 0 || out === '') {
        out = default_value;
    } else if (out.search(/^(true|yes)$/i) >= 0) {
        out = true;
    } else if (out.search(/^(false|no)$/i) >= 0) {
        out = false;
    }
    return out;
};

var queryFormat = function(query, values) {
    if (!values)
        return query;
    return query.replace(/\:(\w+)/g, function(txt, key) {
        if (values.hasOwnProperty(key)) {
            return this.escape(values[key]);
        }
        return txt;
    }.bind(this));
};

var array_dc2type = function(data) {
    inner = '';
    i = 0;
    data.each(function(elem) {
        inner += 'i:' + i + ';s:' + elem.length + ':"' + elem + '";';
        i++;
    });
    console.log('a:' + data.length + ':{' + inner + '}');
    return 'a:' + data.length + ':{' + inner + '}';
};

var dc2type_array = function(data) {
    out = [];
    data = data.replace(/(a|s|i):[0-9]+(:|;)/g, '').replace(/\{/g, '[').replace(/;\}/g, ']').replace(/;/g, ',');
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
var rooms = [];
var users_room = {};
var room_users = {};
var notify = {};

io.sockets.on('connection', function(socket) {

    /**
     * emits 'adduser'
     * 
     * Aggiunge un utente in chat e lo fa entrare nella stanza default
     * @var username string username adottato in chat
     */
    socket.on('adduser', function(user, messages, room) {
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
        joinRoom(socket, room, user, false);
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
            if(socket._room.private === 1) {
                room_users[socket.room].each(function(user) {
                    if(users_room[user] !== socket.room) {
                        if(!notify[user]) {
                            notify[user] = {};
                        }
                        if(!notify[user][socket.room]) {
                            notify[user][socket.room] = 0;
                        }
                        notify[user][socket.room]++;
                        io.sockets.in(users_room[user]).emit('updatenotify', socket.username, notify[user][socket.room], out);
                    }
                });
            }
        });
    });

    /**
     * emits 'previouschat'
     * 
     * Riceve un messaggio da inviare in una stanza della chat
     * @var data string messaggio di chat
     */
    socket.on('previouschat', function(n) {
        // Recupera gli ultimi messaggi della stanza
        if (!n) {
            n = 5;
            socket.previousfrom = 0;
        }
        prevChat(socket, socket.previousfrom, n, function(out) {
            out.each(function(row) {
                socket.emit('oldchat', row.nickname, row);
                socket.previousfrom = row.send_at;
            });
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
        joinRoom(socket, newroom, socket.username, true);
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
                delete users_room[socket.username];
                room_users[socket.room].remove(socket.username);
                socket.leave(socket.room);
                setTimeout(function() {
                    rooms.each(function(room) {
                        io.sockets.in(room).emit('updateusers', users);
                    });
                }, 250);
            }
        }, 30000);
    });
});

var sendChat = function(socket, data, callback) {
    console.info('sendChat');
    db_pool.getConnection(function(error, connection) {
        if (error) {
            return console.log("sendChat: Connection error");
        }
        chat = {
            id: guid(),
            chatroom_id: socket._room.id,
            user_id: users[socket.username].id,
            send_at: Date.create('now'),
            message: data,
            abuse: 0
        };
        connection.query('INSERT INTO ' + tb_chat_messages + ' SET ?', chat, function(err, rows) {
            if (err) {
                return console.log("sendChat: " + err);
            }
            connection.query('UPDATE ' + tb_chat_room + ' SET last_message_at = ' + connection.escape(Date.create('now')) + ' WHERE id = ' + connection.escape(socket._room.id), function(err, rows) {
                if (err) {
                    return console.log("sendChat: " + err);
                }
                connection.end();
                callback(chat);
            });
        });
    });
};

var prevChat = function(socket, from, limit, callback) {
    console.info('prevChat');
    if (socket._room) {
        db_pool.getConnection(function(error, connection) {
            if (error) {
                return console.log("prevChat: Connection error");
            }
            var query = 'SELECT m.*, u.nickname FROM ' + tb_chat_messages + ' m, ' + tb_users + ' u WHERE m.user_id = u.id AND m.chatroom_id = ' + connection.escape(socket._room.id)
            if(from === 0) {
                 query += ' ORDER BY m.send_at DESC LIMIT ' + limit;
            } else {
                 query += ' AND m.send_at < ' + connection.escape(from) + ' ORDER BY m.send_at DESC LIMIT ' + limit;
            }
            connection.query(query, function(err, rows) {
                if (err) {
                    return console.log("prevChat: " + err);
                }
                connection.end();
                callback(rows);
            });
        });
    }
};


var addUser = function(socket, user) {
    console.info('addUser');
    getUser(user, function(out) {
        users[user] = out;
        socket.emit('updateusers', users);
        setTimeout(function() {
            rooms.each(function(room) {
                io.sockets.in(room).emit('updateusers', users);
            });
        }, 250);
    });
};

var getUser = function(user, callback) {
    console.info('getUser');
    db_pool.getConnection(function(error, connection) {
        if (error) {
            return console.log("getUser: Connection error");
        }
        connection.query('SELECT id, nickname, gender, roles FROM ' + tb_users + ' WHERE nickname = ' + connection.escape(user), function(err, rows) {
            if (err) {
                return console.log("getUser: " + err);
            }
            rows.each(function(row) {
                // aggiungo l'username del client all'elenco degli utenti attivi
                callback(row);
            });
            connection.end();
        });
    });
};

var joinRoom = function(socket, chatroom, user, switch_room) {
    console.info('joinRoom');
    // memorizzo la stanza
    getChatroom(socket, chatroom, user, function(out) {
        if (switch_room) {
            // l'utente esce dalla stanza precedente
            delete users_room[socket.username];
            room_users[socket.room].remove(socket.username);
            socket.leave(socket.room);
            // invio le notifiche
            socket.broadcast.to(socket.room).emit('updatenotice', socket.messages.server, socket.messages.exit.replace(/__nickname__/g, socket.username));
        }
        // associo la chat alla stanza
        if (!rooms.find(out.chatroom)) {
            rooms.add(out.chatroom);
            room_users[out.chatroom] = [];
        }
        socket.room = out.chatroom;
        socket._room = out;
        socket.join(socket.room);
        users_room[socket.username] = out.chatroom;
        if (!room_users[out.chatroom].find(socket.username)) {
            room_users[out.chatroom].add(socket.username);
        }
        // messaggio di benvenuto
        if (switch_room) {
            socket.emit('updatenotice', socket.messages.server, socket.messages.reconnect.replace(/__room__/g, socket.room));
        } else {
            socket.emit('updatenotice', socket.messages.server, socket.messages.connect.replace(/__nickname__/g, socket.username).replace(/__room__/g, socket.room));
        }
        // notifica di ingresso nella stanza default di un nuovo utente tramite il comando 'updatechat'
        socket.broadcast.to(socket.room).emit('updatenotice', socket.messages.server, socket.messages.enter.replace(/__nickname__/g, socket.username));
        // visualiza le rooma de3ll'utente e le spara
        getUserRooms(socket, user, 1);
    });
};

var getChatroom = function(socket, room, user, callback) {
    console.info('getChatroom');
    var out = null;
    db_pool.getConnection(function(error, connection) {
        if (error) {
            return console.log("getChatroom: Connection error");
        }
        var query = room.id ? 'SELECT * FROM ' + tb_chat_room + ' WHERE id = ' + connection.escape(room.id) : 'SELECT * FROM ' + tb_chat_room + ' WHERE chatroom = ' + connection.escape(room.chatroom);
        connection.query(query, function(err, rows) {
            if (err) {
                return console.log("getChatroom: " + err);
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
                connection.query('INSERT INTO ' + tb_chat_room + ' SET ?', chatroom, function(err, rows) {
                    if (err) {
                        return console.log("getChatroom: " + err);
                    }
                    connection.query('SELECT * FROM ' + tb_chat_room + ' WHERE chatroom = ' + connection.escape(room.chatroom), function(err, rows) {
                        if (err) {
                            return console.log("getChatroom: " + err);
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
                    connection.query('UPDATE ' + tb_chat_room + ' SET users = ' + connection.escape(array_dc2type(my_chatroom_user)) + ', alias = ' + connection.escape(array_dc2type(my_chatroom_alias)) + ' WHERE id = ' + connection.escape(out.id), function(err, rows) {
                        if (err) {
                            return console.log("getChatroom: " + err);
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
    console.info('getUserRooms');
    db_pool.getConnection(function(error, connection) {
        if (error) {
            return console.log("getUserRooms: Connection error");
        }
        var query_part = [];
        var query = "SELECT * FROM " + tb_chat_room + " c WHERE ";
        if (chat_open_room) {
            query_part.add("(c.private = " + connection.escape(0) + ")");
        }
        if (chat_one_to_one) {
            query_part.add("(c.private = " + connection.escape(1) + " AND c.users LIKE " + connection.escape('%"' + user + '"%') + ")");
        }
        if (chat_group_room) {
            query_part.add("(c.private = " + connection.escape(2) + " AND c.users LIKE " + connection.escape('%"' + user + '"%') + ")");
        }
        query_part.each(function(qp) {
            query += qp + ' OR ';
        });
        query = query.to(query.length - 4) + " ORDER BY c.last_message_at DESC";
        connection.query(query, function(err, rows) {
            if (err) {
                return console.log("getUserRooms: " + err);
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