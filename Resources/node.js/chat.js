var express = require('express')
        , app = express()
        , server = require('http').createServer(app)
        , io = require('socket.io').listen(server)
        , sugar = require('sugar')
        , fs = require('fs')
        , mysql = require('mysql')
        , ephp = require('./ephp_modules/utility')
        ;

var chat_port = 0;
var server_number = 0;
var database_host = '127.0.0.1';
var database_port = 3306;
var database_name = 'node_db';
var database_user = 'root';
var database_password = null;
var db_pool = null;

var tb_users = 'ephp_users';
var tb_chat_room = 'chat_room';
var tb_chat_messages = 'chat_messages';
var tb_chat_notify = 'chat_notify';
var chat_notify = true;
var chat_open_room = true;
var chat_one_to_one = true;
var chat_group_room = false;

var config_file = './app/config/config.yml';
var parameters_file = './app/config/parameters.yml';

var config = 'config';

process.argv.forEach(function(val, index, array) {
    if (index === 2) {
        config = val;
    }
});

fs.readFile('./' + config + '.yml', 'utf8', function(err, data) {
    if (err) {
        return console.log(err);
    }
    // Abilito il listener della chat
    config_file = ephp.readParam(data, 'config:', config_file);
    parameters_file = ephp.readParam(data, 'parameters:', parameters_file);
    fs.readFile(config_file, 'utf8', function(err, data) {
        if (err) {
            return console.log(err);
        }
        // Abilito il listener della chat
        tb_users = ephp.readParam(data, 'tb_users:', tb_users);
        tb_chat_room = ephp.readParam(data, 'tb_chat_room:', tb_chat_room);
        tb_chat_messages = ephp.readParam(data, 'tb_chat_messages:', tb_chat_messages);
        tb_chat_notify = ephp.readParam(data, 'tb_chat_notify:', tb_chat_notify);
        chat_notify = ephp.readParam(data, 'chat_notify:', chat_notify);
        chat_open_room = ephp.readParam(data, 'chat_open_room:', chat_open_room);
        chat_one_to_one = ephp.readParam(data, 'chat_one_to_one:', chat_one_to_one);
        chat_group_room = ephp.readParam(data, 'chat_group_room:', chat_group_room);
    });

    fs.readFile(parameters_file, 'utf8', function(err, data) {
        if (err) {
            return console.log(err);
        }
        // Abilito il listener della chat
        chat_port = ephp.readParam(data, 'node.chat.port:', chat_port);
        server.listen(chat_port);
        console.log('Chat enabled on port ' + chat_port);

        server_number = ephp.readParam(data, 'server_number:', server_number);
        console.log('Server number ' + server_number);

        database_host = ephp.readParam(data, 'database_host:', database_host);
        database_port = ephp.readParam(data, 'database_port:', database_port);
        database_name = ephp.readParam(data, 'database_name:', database_name);
        database_user = ephp.readParam(data, 'database_user:', database_user);
        database_password = ephp.readParam(data, 'database_password:', database_password);


        db_pool = mysql.createPool({
            database: database_name,
            port: database_port,
            host: database_host,
            user: database_user,
            password: database_password
        });
        console.log('Connected to db');
    });
});

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

// routing di express ??
app.get('/', function(req, res) {
    res.sendfile(__dirname + '/example.html');
});

// username degli utenti che sono in chat
var users = {};
var rooms = [];
var users_room = {};
var users_socket = {};
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
        // memorizzo la stanza di default nella sessione del socket associata al client
        room = room ? room : {chatroom: socket.messages.default_room, alias: socket.messages.default_room};
        //Aggiungo l'utente fra quelli attivi
        addUser(socket, user, room, function() {
            // preparo le rooms
            console.log(users[user]);
            socket.online = users[user].chat_status;
            // faccio entrare l'utente nella stanza default
            joinRoom(socket, room, user, false);
            // notifico lo stato
            socket.emit('updatestatus', users[user].chat_status);
        });
        //Memorizzo il socket dell'utente
        users_socket[user] = socket;
        if (chat_notify) {
            sendNotify(socket, user);
        }
    });

    /**
     * emits 'sendchat'
     * 
     * Riceve un messaggio da inviare in una stanza della chat
     * @var data string messaggio di chat
     */
    socket.on('changestatus', function(status) {
        users[socket.username].chat_status = status;
        socket.emit('updatestatus', users[socket.username].chat_status);
        getUser(socket.username, function(out) {
            out.dati = ephp.unserializePhp(out.dati);
            out.dati.chat_status = status;
            setDatiUser(socket.username, out.dati);
        });
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
            if (socket._room.private === 1) {
                if (chat_notify) {
                    addNotify(socket, out, function(user) {
                        if (users_socket[user.nickname]) {
                            sendNotify(users_socket[user.nickname], user.nickname);
                        }
                    });
                }
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
            socket.previousfrom = 0;
            if (chat_notify && socket._room && socket._room.private) {
                n = 0;
                removeNotify(socket._room, users[socket.username], function(nm) {
                    if (nm > 0) {
                        prevChat(socket, socket.previousfrom, nm, function(out) {
                            out.each(function(row) {
                                socket.emit('oldchat', row.nickname, row);
                                socket.previousfrom = row.send_at;
                            });
                        });
                    }
                });
            } else {
                n = 5;
            }
        }
        if (n > 0) {
            prevChat(socket, socket.previousfrom, n, function(out) {
                out.each(function(row) {
                    socket.emit('oldchat', row.nickname, row);
                    socket.previousfrom = row.send_at;
                });
            });
        }
    });

    /**
     * emits 'switchRoom'
     * 
     * Permette di cambiare stanza
     * @var newroom string nuova stanza
     */
    socket.on('switchRoom', function(newroom) {
        // effettua lo switch
        if (newroom.chatroom && Array.isArray(newroom.chatroom)) {
            var my_chatroom = newroom.chatroom;
            newroom.chatroom = my_chatroom.unique().sortBy().toString();
        }
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
        delete users_socket[socket.username];
        setTimeout(function() {
            if (!users[socket.username]) {
                // aggiorno l'elenco utenti
                io.sockets.emit('updateusers', users);
                // notifico l'evento'
                if (socket.messages) {
                    socket.broadcast.emit('updatenotice', socket.messages.server, socket.messages.disconnect.replace(/__nickname__/g, socket.username));
                }
                delete users_room[socket.username];
                if (room_users[socket.room]) {
                    room_users[socket.room].remove(socket.username);
                }
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
            id: ephp.guid(server_number),
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

var sendNotify = function(socket, user) {
    console.info('sendNotify');
    db_pool.getConnection(function(error, connection) {
        if (error) {
            return console.log("sendNotify: Connection error");
        }
        getUser(user, function(user) {
            var query = 'SELECT r.id, r.chatroom, r.users, r.alias, n.notify_at, n.messages, SUBSTR(n.messages, LENGTH(n.messages)-38 ,36) as last_message_id, (SELECT message FROM ' + tb_chat_messages + ' m WHERE m.id = SUBSTR(n.messages, LENGTH(n.messages)-38 ,36)) as last_message FROM ' + tb_chat_notify + ' n, ' + tb_chat_room + ' r WHERE n.chatroom_id = r.id and n.user_id = ' + connection.escape(user.id) + ' AND n.notified = ' + connection.escape(0);
            connection.query(query, function(err, rows) {
                if (err) {
                    return console.log("sendNotify: " + err);
                }
                rows.each(function(row) {
                    var ids_messages = ephp.unserializePhp(row.messages);
                    var row_users = ephp.unserializePhp(row.users);
                    var row_alias = ephp.unserializePhp(row.alias);
                    var ids = eval('[' + row.chatroom + ']');
                    ids.remove(user.id);
                    socket.emit('updatenotify', {id: ids.first(), nickname: row_alias[row_users.findIndex(socket.username)]}, ids_messages.length, {chatroom_id: row.id, message: row.last_message});
                });
                connection.end();
            });
        });
    });

};

var addNotify = function(socket, msg, callback) {
    console.info('addNotify');
    var chat_users = ephp.unserializePhp(socket._room.users);
    chat_users.each(function(user) {
        if (users_room[user] !== socket.room) {
            db_pool.getConnection(function(error, connection) {
                if (error) {
                    return console.log("addNotify: Connection error");
                }
                getUser(user, function(user) {
                    var query = 'SELECT * FROM ' + tb_chat_notify + ' WHERE chatroom_id = ' + connection.escape(socket._room.id) + ' AND user_id = ' + connection.escape(user.id);
                    connection.query(query, function(err, rows) {
                        if (err) {
                            return console.log("addNotify: " + err);
                        }
                        var outnot = null;
                        rows.each(function(row) {
                            outnot = row;
                        });
                        if (outnot === null) {
                            notify = {
                                chatroom_id: socket._room.id,
                                user_id: user.id,
                                notify_at: Date.create('now'),
                                messages: ephp.unserializePhp([msg.id]),
                                notified: 0
                            };
                            connection.query('INSERT INTO ' + tb_chat_notify + ' SET ?', notify, function(err, rows) {
                                if (err) {
                                    return console.log("addNotify: " + err);
                                }
                                connection.query(query, function(err, rows) {
                                    if (err) {
                                        return console.log("addNotify: " + err);
                                    }
                                    connection.end();
                                    callback(user);
                                });
                            });
                        } else {
                            var messages = ephp.unserializePhp(outnot.messages);
                            messages.add(msg.id);
                            connection.query('UPDATE ' + tb_chat_notify + ' SET notify_at = ' + connection.escape(Date.create('now')) + ', messages = ' + connection.escape(ephp.serializePhp(messages)) + ', notified = ' + connection.escape(0) + ' WHERE chatroom_id = ' + connection.escape(socket._room.id) + ' AND user_id = ' + connection.escape(user.id), function(err, rows) {
                                if (err) {
                                    return console.log("addNotify: " + err);
                                }
                                connection.end();
                                callback(user);
                            });
                        }
                    });
                });
            });
        }
    });
};

var removeNotify = function(room, user, callback) {
    console.info('removeNotify');
    db_pool.getConnection(function(error, connection) {
        if (error) {
            return console.log("removeNotify: Connection error");
        }
        var query = 'SELECT * FROM ' + tb_chat_notify + ' WHERE chatroom_id = ' + connection.escape(room.id) + ' AND user_id = ' + connection.escape(user.id);
        connection.query(query, function(err, rows) {
            if (err) {
                return console.log("removeNotify: " + err);
            }
            var outnot = null;
            rows.each(function(row) {
                outnot = row;
            });
            if (outnot === null) {
                connection.end();
                callback(0);
            } else {
                var messages = ephp.unserializePhp(outnot.messages);
                connection.query('UPDATE ' + tb_chat_notify + ' SET notify_at = ' + connection.escape(Date.create('now')) + ', messages = ' + connection.escape(ephp.serializePhp([])) + ', notified = ' + connection.escape(1) + ' WHERE chatroom_id = ' + connection.escape(room.id) + ' AND user_id = ' + connection.escape(user.id), function(err, rows) {
                    if (err) {
                        return console.log("removeNotify: " + err);
                    }
                    connection.end();
                    callback(messages.length + 5);
                });
            }
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
            var query = 'SELECT m.*, u.nickname FROM ' + tb_chat_messages + ' m, ' + tb_users + ' u WHERE m.user_id = u.id AND m.chatroom_id = ' + connection.escape(socket._room.id);
            if (from === 0) {
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

var addUser = function(socket, user, room, callback) {
    console.info('addUser');
    getUser(user, function(out) {
        var update_user = false;
        if (!out.dati) {
            out.dati = {chat_status: 'Offline', chat_last_room: room};
            update_user = true;
        } else {
            out.dati = ephp.unserializePhp(out.dati);
            if (!out.dati.chat_status) {
                out.dati.chat_status = 'Offline';
                update_user = true;
            }
            if (!out.dati.chat_last_room) {
                out.dati.chat_last_room = room;
                update_user = true;
            }
        }
        if (update_user) {
            setDatiUser(user, out.dati);
        }
        out.status = out.dati.chat_status;
        out.last_room = out.dati.chat_last_room;
        delete out.dati;
        users[user] = out;
        socket.emit('updateusers', users);
        setTimeout(function() {
            if(callback) {
                callback();
            }
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
        connection.query('SELECT id, nickname, gender, roles, dati FROM ' + tb_users + ' WHERE nickname = ' + connection.escape(user), function(err, rows) {
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

var setDatiUser = function(user, dati) {
    console.info('getUser');
    db_pool.getConnection(function(error, connection) {
        if (error) {
            return console.log("getUser: Connection error");
        }
        connection.query('UPDATE ' + tb_users + ' SET dati = ' + connection.escape(ephp.serializePhp(dati)) + ' WHERE nickname = ' + connection.escape(user), function(err, rows) {
            if (err) {
                return console.log("getUser: " + err);
            }
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
        getUser(socket.username, function(out) {
            out.dati = ephp.unserializePhp(out.dati);
            out.dati.chat_last_room = chatroom;
            setDatiUser(socket.username, out.dati);
        });
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
                var chat_private = room.chatroom !== socket.messages.default_room;
                var chat_user = [user];
                var chat_alias = [room.alias];
                if (chat_private) {
                    chat_user.add(room.alias);
                    chat_alias.add(user);
                }
                chatroom = {
                    id: ephp.guid(server_number),
                    chatroom: room.chatroom,
                    private: chat_private,
                    users: ephp.serializePhp(chat_user),
                    alias: ephp.serializePhp(chat_alias),
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
                if (room.alias) {
                    var my_chatroom_user = ephp.unserializePhp(out.users);
                    if (!my_chatroom_user.find(socket.username)) {
                        my_chatroom_user.add(socket.username);
                        var my_chatroom_alias = ephp.unserializePhp(out.alias);
                        my_chatroom_alias.add(room.alias);
                        connection.query('UPDATE ' + tb_chat_room + ' SET users = ' + connection.escape(ephp.serializePhp(my_chatroom_user)) + ', alias = ' + connection.escape(ephp.serializePhp(my_chatroom_alias)) + ' WHERE id = ' + connection.escape(out.id), function(err, rows) {
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
            query_part.add("(c.private = " + connection.escape(0) + " AND c.users LIKE " + connection.escape('%"' + user + '"%') + ")");
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
                var my_room_users = ephp.unserializePhp(row.users);
                var my_room_alias = ephp.unserializePhp(row.alias);
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