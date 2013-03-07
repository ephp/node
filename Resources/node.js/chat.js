var express = require('express')
  , app = express()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server)
  , sugar = require('sugar')
;

server.listen(8080);

// routing di express ??
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/example.html');
});

// username degli utenti che sono in chat
var usernames = {};

// stanze dove è possibile chattare
var rooms = ['MyRoom 1', 'MyRoom 2', 'MyRoom 3', 'MyRoom 4', 'MyRoom 5'];

io.sockets.on('connection', function (socket) {

        /**
         * emits 'adduser'
         * 
         * Aggiunge un utente in chat e lo fa entrare nella stanza default
         * @var username string username adottato in chat
         */
	socket.on('adduser', function(username, messages){
		// memorizzo l'username nella sessione del socket associata al client
		socket.username = username;
		// memorizzo i messaggi
		socket.messages = messages;
		// memorizzo la stanza di default nella sessione del socket associata al client
		socket.room = 'MyRoom 1';
		// aggiungo l'username del client all'elenco degli utenti attivi
		usernames[username] = username;
		// faccio entrare l'utente nella stanza default
		socket.join(socket.room);
		// messaggio di benvenuto
		socket.emit('updatechat', socket.messages.server, socket.messages.connect.replace(/__nickname__/g, socket.username).replace(/__room__/g, socket.room));
		// notifica di ingresso nella stanza default di un nuovo utente tramite il comando 'updatechat'
		socket.broadcast.to(socket.room).emit('updatechat', socket.messages.server, socket.messages.enter.replace(/__nickname__/g, socket.username));
		socket.emit('updaterooms', rooms, 'MyRoom 1');
	});
        
        /**
         * emits 'addroom'
         * 
         * Aggiunge una stanza
         * @var newroom string nome della stanza
         */
	socket.on('addroom', function(newroom){
		// aggiungo la stanza
		rooms.add(newroom);
		// l'utente esce dalla stanza precedente
		socket.leave(socket.room);
		// l'utente entra nella nuova stanza
		socket.join(newroom);
		// invio le notifiche
		socket.emit('updatechat', socket.messages.server, socket.messages.reconnect.replace(/__room__/g, newroom));
		socket.broadcast.to(socket.room).emit('updatechat', socket.messages.server, socket.messages.exit.replace(/__nickname__/g, socket.username));
		// aggiorno la sessione
		socket.room = newroom;
		// invio l'ultima notifich
		socket.broadcast.to(newroom).emit('updatechat', socket.messages.server,  socket.messages.enter.replace(/__nickname__/g, socket.username));
		// aggiorno la sessione
		socket.emit('updaterooms', rooms, newroom);
	});

        /**
         * emits 'sendchat'
         * 
         * Riceve un messaggio da inviare in una stanza della chat
         * @var data string messaggio di chat
         */
	socket.on('sendchat', function (data) {
		// invia il messaggio di chat alla stanza tramite il comando 'updatechat'
		io.sockets.in(socket.room).emit('updatechat', socket.username, data);
	});

        /**
         * emits 'switchRoom'
         * 
         * Permette di cambiare stanza
         * @var newroom string nuova stanza
         */
	socket.on('switchRoom', function(newroom){
		// l'utente esce dalla stanza precedente
		socket.leave(socket.room);
		// l'utente entra nella nuova stanza
		socket.join(newroom);
		// invio le notifiche
		socket.emit('updatechat', 'SERVER', 'Ti sei connesso alla stanza '+ newroom);
		socket.broadcast.to(socket.room).emit('updatechat', socket.messages.server, socket.messages.exit.replace(/__nickname__/g, socket.username));
		// aggiorno la sessione
		socket.room = newroom;
		// invio l'ultima notifich
		socket.broadcast.to(newroom).emit('updatechat', socket.messages.server,  socket.messages.enter.replace(/__nickname__/g, socket.username));
		// aggiorno la sessione
		socket.emit('updaterooms', rooms, newroom);
	});

        /**
         * emits 'disconnect'
         * 
         * Disconnessione dell'utene
         */
	socket.on('disconnect', function(){
		// remuovo l'utente dalla chat
		delete usernames[socket.username];
		// aggiorno l'elenco utenti
		io.sockets.emit('updateusers', usernames);
		// notifico l'evento'
		socket.broadcast.emit('updatechat', socket.messages.server, socket.messages.disconnect.replace(/__nickname__/g, socket.username));
		socket.leave(socket.room);
	});
});