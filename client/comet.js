var JSON = JSON || {}; 
// implement JSON.stringify serialization
JSON.stringify = JSON.stringify || function (obj) {
	var t = typeof (obj);
	if (t != "object" || obj === null) {
		// simple data type
		if (t == "string") obj = '"'+obj+'"';
		return String(obj);	
	}
	else {
		// recurse array or object
		var n, v, json = [], arr = (obj && obj.constructor == Array);
		for (n in obj) {
			v = obj[n]; t = typeof(v);
			if (t == "string") v = '"'+v+'"';
			else if (t == "object" && v !== null) v = JSON.stringify(v);
			json.push((arr ? "" : '"' + n + '":') + String(v));
		}
		return (arr ? "[" : "{") + String(json) + (arr ? "]" : "}");
	}
};
// implement JSON.parse de-serialization
JSON.parse = JSON.parse || function (str) {
	if (str === "") str = '""';
	eval("var p=" + str + ";");
	return p;
};


//######################################################
// cometClient
//################################(Brainfuckers code)###

var cometClient = function (server, anonymous) {
	var self=this;
	
	/// PRIVATE
	var reciveCallback=null;
	
	/// CONSTRUCTOR
	if (!server && typeof(server)!='string') {
		var err = new Error();
		err.name = 'Wrong argument';
		err.message = 'comet(server), server should be an string';
		throw(err);
	}

	if (cometClient.responding==null) {
		cometClient.connections = {};
		cometClient.connectionsCount = 0;
		cometClient.responding = true;
	}
	
	if (!anonymous) {
		var session = '';
		while (session.length < 40) session += Math.ceil(Math.random()*16).toString(16).toUpperCase();
	} else {
		var session = cometClient.connectionsCount++;
	}
	
	cometClient.connections[session] = {
		open: false,
		callback: function (response) {
			self.open = false;
			if (response['f']) reciveCallback(response['d']);
			if (response['d']['_system']) {
				if (response['d']['act'] == 'changeUid') {
					cometClient.connections[response['d']['uid']] = cometClient.connections[session];
					delete cometClient.connections[session];
					session = response['d']['uid'];
				}
			}
			if (!self.open) {
				self.send({'_system': true, 'act': 'reconnect'});
			}
		},
		reconnect: function () {
			self.open = false;
			self.send({'_system': true, 'act': 'reconnect'});
		}
	}
	
	/// PUBLIC
	this.send = function(info) { // Send data method
		var finish=true;
		if (info!=null)
			var sendingData=JSON.stringify(info);
		else
			var sendingData='';
		var data={
			'f': finish, // finish
			'd': sendingData // data			
		};
		if (!anonymous) data['s'] = session;
		this.open = true
		cometClient.request(server, cometClient.toQuery(data));
	}
	
	this.run = function (data) { // Run comet client
		this.send({'_system': true, 'start': true, 'act': 'connect', 'data': data});
		return this;
	}
	
	this.recive = function (callback) { // Recive data
		if (typeof(callback)=='function') {
			reciveCallback=callback;
		} else {
			var err = new Error();
			err.name = 'Wrong argument';
			err.message = 'recive(callback), callback should be an function';
			throw(err);
		}
	}

}

cometClient.toQuery = function (data) {
	if (typeof(data)=='string')
		return data;
	var out = [];
	for (i in data) {
		out.push(i+'='+data[i]);
	}
	return out.join('&');
}

// An request function
cometClient.request = function (baseUrl, data) {
	function foreignRequest (url, data) { // An cross domain request
		if (data != '') url += '&';
		url += '_comet=1';
		var script = document.createElement('script');
		script.type = 'text/javascript';
		script.src = url+'?'+data;
		document.getElementsByTagName('head')[0].appendChild(script);
	}
	
	function ajaxRequest (url, data) {
		if (cometClient.httpRequest == null) {
			if (navigator.appName == "Microsoft Internet Explorer") {
				cometClient.httpRequest = new ActiveXObject("Microsoft.XMLHTTP");
			} else {
				cometClient.httpRequest = new XMLHttpRequest();
			}
		}
		if (url.indexOf('?') != -1)
			url+='&';
		else
			url+='?';
		url += '_comet=1';
		cometClient.httpRequest.open("POST", url, true);
		cometClient.httpRequest.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
		//cometClient.httpRequest.setRequestHeader("Content-Length", data.length);
		cometClient.httpRequest.setRequestHeader("Connection", "close");
		cometClient.httpRequest.onreadystatechange = function() {
			if (cometClient.httpRequest.readyState == 4) {
				if (cometClient.httpRequest.responseText != null && cometClient.httpRequest.responseText != '') {
					try {
						eval(cometClient.httpRequest.responseText);
					} catch(err) {
						setTimeout(function() {
							cometClient.request(baseUrl, data);
						},10000);
					}
				}
			}
		}
		cometClient.httpRequest.send(data);
	}
	
	if (baseUrl.indexOf('http://') == -1) { // Local request
		ajaxRequest(baseUrl, data);
	} else { // Cross domain request
		foreignRequest(baseUrl, data);
	}
}
