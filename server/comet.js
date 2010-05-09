var sys = require('sys'), 
   url = require('url'),
   http = require('http'),
   querystring = require('querystring');

exports.server = function (interval) {
/// PRIVATE
	var reciveCallback = null;
	var connectCallback = null;
	var disconnectCallback = null;
	
	var connections = {}
		
	var sendData = function(res, session, action, data) {
		if (data != null)
			data = JSON.stringify(data);
		else
			data = '';
		if (action != null)
			var out = 'cometClient.connections[\''+session+'\'].'+action+'('+data+')';
		else
			var out = '';
		res.writeHead(200, {'Content-Type': 'text/javascript'});
		sys.p('out: '+out);
		res.end(out);
	}
	
	var connection = function (id,resource) {
		this.session = id;
		this.handle = resource;
		this.open = true;
		this.buffer = []; // An buffer for lost messages
		this.timeoutHandler = null;
		this.send = function (data) {
			sys.p('Sending: ');
			sys.p(data);
			if (this.open) {
				sendData(this.handle, this.session, 'callback', {f:true, d:data});
				this.open = false;
			} else {
				sys.p('FAULT');
				this.buffer.push(data);
			}
		}
		this.reconnect = function () {
			if (this.open) {
				clearTimeout(this.timeoutHandler);
				sendData(this.handle, this.session, 'reconnect');
				this.open = false;
			}
			var self=this;
			this.timeoutHandler = setTimeout(function () { // disconnect
				sys.p('DICONNECT');
				sys.p(connections[self.session]);
				if (connections[self.session]) {
					if (disconnectCallback) disconnectCallback(self);
					delete connections[self.session];
					delete self;
				}
				sys.p(connections[self.session]);
			}, 10000);
		}
		this.end = function () {
			if (this.open) {
				clearTimeout(this.timeoutHandler);
				sendData(this.handle, this.session);
				this.open = false;
			}
		}
		this.timeout = function () {
			var self=this;
			clearTimeout(this.timeoutHandler);

			this.timeoutHandler = setTimeout(function () {
				self.reconnect();
			}, interval);
			return this;
		}
	}
	
	fetchRequest = function (query, res) {
		if (query != null) {
			//try {
				query.d=String(query.d);
				if (query.d != '')
					try {
						var data = JSON.parse(query.d);
					} catch(err) {
						var data = {};
						sys.p('Parsing error!');
					}
				else
					var data = {};
				
				if (connections[query.s]==null) {
					connections[query.s]=new connection(query.s, res);
					if (data && data.data) {
						if (data.act == 'connect') {
							if (connectCallback) connectCallback(connections[query.s], data['data']);
						} else {
							if (reciveCallback) reciveCallback(connections[query.s], data['data']);
						}
					}
				} else {
					if (data._system && data.act == 'connect') { // User with same uid already exist
						var oldSession = query.s;
						while (connections[query.s]) {
							query.s = '';
							while (query.s.length < 40) query.s += Math.ceil(Math.random()*16).toString(16).toUpperCase();
						}
						
						connections[query.s]=new connection(query.s, res);
						
						sendData(res, oldSession, 'callback', {d:{'_system': true, 'act': 'changeUid', 'uid': query.s}});
						connections[query.s].open = false;
						if (data && data.data && connectCallback) connectCallback(connections[query.s], data['data']);
						return true;
					}
					if (connections[query.s].open) connections[query.s].end();
				}
				if (data._system && data.act == 'disconnect') {
					if (disconnectCallback) disconnectCallback(connections[query.s], data.data);
					delete connections[query.s];
					return true;
				}
				
				connections[query.s].handle = res;
				connections[query.s].open = true;
				if (connections[query.s].buffer.length != 0) {
					connections[query.s].send(connections[query.s].buffer.shift());
					connections[query.s].open = false;
				}
				
				if ((data == null || !data._system) && reciveCallback != null) reciveCallback(connections[query.s], data);
				connections[query.s].timeout();
			//} catch(err) {
			//	sys.p('ERROR:')
			//	sys.p(err);
			//}
		}	
	}
/// CONSTRUCTOR
	interval=parseInt(interval);
	if (!interval) interval=30000; // 30 seconds
	
/// PUBLIC
	this.fetch = function (req, res) {
		var query = url.parse(req.url,true).query;
		if (query && query._comet) {
			if (req.method == 'POST') {
				// POST Request
				req.addListener('data', function (POST) {
					var query=querystring.parse(POST.toString());
					fetchRequest(query, res);
				});	
			} else {
				// GET Request
				if (query != null && query.d != 'undefined' && query.d != '') {
					fetchRequest(query, res);
				} else {
					var data=null;
				}
			}
			return true;
		}
		return false;
	}
	
	this.run = function (port) {
		var self = this;
		var server = http.createServer(function (req, res) {
			if (!self.fetch(req,res)) {
				res.writeHead(200, {'Content-Type': 'text/javascript'});
				res.end('Not comet request');
			};
		});
		server.listen(port);
		return this;
	}
	
	this.onRecive = function (callback) {
		if (typeof(callback)=='function') {
			reciveCallback=callback;
		} else {
			var err = new Error()
			err.name = 'Wrong argument'
			err.message = 'onRecive(callback), callback should be an function'
			throw(err)
		}
	}
	
	this.onConnect = function (callback) {
		if (typeof(callback)=='function') {
			connectCallback=callback;
		} else {
			var err = new Error()
			err.name = 'Wrong argument'
			err.message = 'onConnect(callback), callback should be an function'
			throw(err)
		}
	}
	
	this.onDisconnect = function (callback) {
		if (typeof(callback)=='function') {
			disconnectCallback=callback;
		} else {
			var err = new Error()
			err.name = 'Wrong argument'
			err.message = 'onDisconnect(callback), callback should be an function'
			throw(err)
		}
	}
	
	this.send = function (users, data) {
		if (users == '*') {
			for (i in connections) {
				connections[i].send(data);
			}
		} else {
			var type = typeof(users);
			if (type=='array') {
				for (i in users) {
					connections[users[i]].send(data);
				}
			} else if (type=='string') {
				connections[users].send(data);
			} else if (type=='object' && users.session!=null) {
				connections[users.session].send(data);
			}
		}
	}
}
