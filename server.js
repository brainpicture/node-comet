var sys = require('sys');
var comet = require('./server/comet');

var messages = [{user: 'Admin', msg: 'The comet chat was started!'}];

var server = new comet.server(30000).run(8069);

function addMessage(data) {
	if (messages.length > 100) messages.shift();
	messages.push(data);
	server.send('*',[data]);
}

server.onConnect(function(user, data) { // New user connected
	sys.p('ONCONNECT MESSAGES');
	sys.p(data);
	user.userName = (data) ? data['userName'] || 'Anonimous' : 'Anonimous';
	server.send(user, messages);
	addMessage({user: user.userName, msg: 'Joined', sys: true});
});

server.onRecive(function(user, data) { // New message from an user
	sys.p('ONRECIVE MESSAGE');
	if (data != null && String(data.msg) != '') {
		addMessage({user: user.userName, msg:data.msg});
	}
});

server.onDisconnect(function(user) {
	addMessage({user: user.userName, msg: 'Left', sys: true});
});

sys.puts('Server running at http://127.0.0.1:8069/');
