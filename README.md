# Node.js comet module (Not ready yet!)

## Client side:
* constructor: new cometClent(server [string], anonymous [boolean]);
	- server: path to application like: http://example.com/:8080 or /server if you have routes
	- anonymous: set true if you don't want to remember users
* recive(callback [function])
* run(callback [function])
* send(callback [function])

Usage:
	var client=new cometClient('ajax-request-path');
	
	client.recive(function(data) {
		// Recive an message
	});
	
	client.run({text: 'Create data (unnessusary)'});
	
	client.send({text: 'Sent data'});
	
## Server side
* constructor: new comet.server(timeout [integer]);
* recive(callback [function])

Usage:
	var comet = require('./lib/comet');
	
	var server = new comet.server(30000);
	
	server.recive(function(user, data) { // New message from an user
		// Recive an message
		user.send({text: 'Message to current user'});
	});
	
	server.send('*',{text: 'Message to all users'});
