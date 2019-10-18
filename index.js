"use strict";

// Import modules

const fs = require('fs');
const express = require('express');
const serveIndex = require('serve-index');
const net = require('net');
const etag = require('etag');

// Initialize ExpressJs

const app = express();
const port = 8080;
const public_dir = '/opt/AptanaJaxer/public';

const client_framework = fs.readFileSync("/opt/AptanaJaxer/jaxer/framework/clientFramework.js");

app.get("/jaxer/framework/clientFramework.js", function(req, res) {

	res.setHeader("Content-Type", "text/javascript");
	res.writeHead(200);
	res.end(client_framework);

});

app.get('*.html', function(req, res) {

	console.log("getting the file");
	console.log(req.url);
	handle_file(req, res);

});

app.all('*/jaxer-include/*', function(req, res) {

	res.status(403);
	res.end('Server-only files');

});

app.get(/.*\/$/, function(req, res, next) {

	console.log("getting the directory");
	console.log(req.connection.localaddress);

	
	fs.stat(public_dir + req.url + "index.html", function(err, stats) {
		if(err) {
			return next();
		}

		console.log(stats);

		req.url += "index.html";
		handle_file(req, res);
	});

});

app.post('/jaxer-callback', function(req, res) {

	// parse body and pass to jaxer

	const INPUT = [
		{
			"User-Agent" : req.headers['user-agent'],
			"Host" : req.headers['host'],
			"Accept" : "*/*",
			"Content-Type" : req.headers['content-type'],
			"X-Requested-With" : "XMLHttpRequest",
			"Content-Length" : req.headers['content-length'],
			"Connection" : "keep-alive",
			"Referer" : req.headers['referer'],
			"Cookie" : req.headers['cookie'],
			"Pragma" : "no-cache",
			"Cache-Control" : "no-cache"
		},
		{

		},
		{
			"CALLBACK_URI" : "/aptanaRPC",
			"HTTP_USER_AGENT" : req.headers['user-agent'],
			"HTTP_HOST" : req.headers['host'],
			"HTTP_ACCEPT" : "*/*",
			"CONTENT_TYPE" : req.headers['content-type'],
			"HTTP_X_REQUESTED_WITH" : "XMLHttpRequest",
			"CONTENT_LENGTH" : req.headers['content-length'],
			"HTTP_CONNECTION" : "keep-alive",
			"HTTP_REFERER" : req.headers['referer'],
			"HTTP_COOKIE" : req.headers['cookie'],
			"HTTP_PRAGMA" : "no-cache",
			"HTTP_CACHE_CONTROL" : "no-cache",
			"PATH" : "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
			"LD_LIBRARY_PATH" : "/opt/AptanaJaxer/Apache22/lib:/opt/AptanaJaxer/Apache22/lib",
			"SERVER_SIGNATURE" : "",
			"SERVER_SOFTWARE" : "(Apache/2.4.35 (Unix) ModJaxer/1.0.3.4549",
			"SERVER_NAME" : "192.168.1.7",
			"SERVER_ADDR" : "192.168.1.7",
			"SERVER_PORT" : "8080",
			"REMOTE_ADDR" : req.connection.remoteAddress,
			"DOCUMENT_ROOT" : public_dir,
			"REQUEST_SCHEME" : "http",
			"CONTEXT_PREFIX" : "",
			"CONTEXT_DOCUMENT_ROOT" : public_dir,
			"SERVER_ADMIN" : "you@example.com",
			"SCRIPT_FILENAME" : public_dir + req.url,
			"REMOTE_PORT" : "56956",
			"SERVER_PROTOCOL" : "HTTP/1.1",
			"REQUEST_METHOD" : "POST",
			"QUERY_STRING" : "",
			"REQUEST_URI" : req.url,
			"SCRIPT_NAME" : req.url,
			"REMOTE_HOST" : req.connection.remoteAddress,
			"STATUS_CODE" : "200",
			"HTTPS" : "off",
			"JAXER_REQ_TYPE" : "1",
			"DOC_CONTENT_TYPE" : "text/html"
		}
	];

	let data = '';

	req.on('data', function(chunk) {
		data += chunk;
	});

	req.on('end', function() {

		const body = Buffer.from(data);
		const packet = binary_json(INPUT, Buffer.alloc(0));

		const JAXER_PORT = 4327;
		const ping = Buffer.from([0, 0, 3, 0, 4, 2]);
		const pong = Buffer.from([0, 0, 3, 0, 4, 1]);
		const okay = Buffer.from([5, 0, 0]);
		const next = Buffer.from([6, 0, 0]);
		const term = Buffer.from([7, 0, 0]);
		const client = new net.Socket();

		client.connect(JAXER_PORT, '127.0.0.1', function() {
			client.write(pong);
		});

		client.on('data', function(data) {

			console.log(data);

			if(pong.compare(data) === 0) {

				client.write(packet);

			} else if(okay.compare(data) === 0) {

				next.writeUInt16BE(body.length, 1);
				fs.writeFileSync("packets/next.bin", next);
				client.write(next);

				let payload = Buffer.concat([body, term]);
				client.write(payload);

			} else {

				client.destroy();
				let conv = json_binary(data);
				console.log(conv);
				console.log(conv.body.toString('ascii'));
				for(let key in conv.file) {
					res.setHeader(key, conv.file[key]);
				}
				res.end(conv.body);
			}

		});
	
		client.on("error", function(err) {
			return res.status(500).end(err.toString());
		});

	});

});

app.use(express.static(public_dir), serveIndex(public_dir, {'icons': true}));
app.listen(port, function() {
	console.log(`Apache Emulator listening on port ${port}!`)
});

// Apache Emulator

function binary_json(src, body) {

	let bytes = [];

	console.log(src);

	for(let i = 0; i < src.length; i++) {

		if(Object.keys(src[i]).length === 0) {
			continue;
		}

		// First set the block number

		bytes.push(i + 1);

		// Then we get the total number of bytes

		let length = 0;
		let keys = 0;

		let block = src[i];

		for(let key in block) {
			block[key] = block[key] || "";
			keys++;
			length += key.length;
			length += block[key].length;
			length += 4;
		}

		// Remove the last ending zero

		length -= 1;
		length += 3;

		bytes.push((length & 0xff00) >> 8);
		bytes.push(length & 0xff);
		bytes.push(0, keys, 0);

		// Then we encode all of the keys and values

		for(let key in block) {

			bytes.push(key.length);
			for(let k = 0; k < key.length; k++) {
				bytes.push(key.charCodeAt(k));
			}
			bytes.push(0);

			bytes.push(block[key].length);
			for(let k = 0; k < block[key].length; k++) {
				bytes.push(block[key].charCodeAt(k));
			}
			bytes.push(0);

		}

		bytes.pop();

	}

	bytes.push(src.length + 1);
	bytes.push( (body.length & 0xff00) >> 8 );
	bytes.push( body.length & 0xff );

	let header = Buffer.from(bytes);
	let footer = Buffer.from([ 0x07, 0x00, 0x00]);
	return Buffer.concat([header, body, footer]);

}

function json_binary(src) {

	const header = {
		"client" : {},
		"file" : {},
		"server" : {},
		"body" : null
	};


	const types = Object.keys(header);
	let pos = 0;

	console.log("Converting response from jaxer");
	console.log("Source length: 0x%s", src.length.toString(16));

	while(pos < src.length) {

		let byte = src.readUInt8(pos);
		let len = src.readUInt16BE(pos + 1);
		
		console.log("aaa");
		console.log(byte);

		if(byte === 7) {
			break;
		}

		pos += 3;
		let snap = pos + len;
		const type = types[byte - 1];

		console.log("Found type: %s", type);

		switch(type) {
		case "client":
		case "file":
		case "server":

			let pairs = src.readUInt8(pos + 1);
			console.log("There are %s pairs", pairs);
			pos += 3;

			for(let i = 0; i < pairs; i++) {
				
				let key = "";
				let value = "";

				let key_len = src.readUInt8(pos++);
				for(let k = 0; k < key_len; k++) {
					byte = src.readUInt8(pos++);
					key += String.fromCharCode(byte);
				}
				pos++;

				let val_len = src.readUInt8(pos++);
				for(let k = 0; k < val_len; k++) {
					byte = src.readUInt8(pos++);
					value += String.fromCharCode(byte);
				}
				pos++;
				
				header[type][key] = value;
			}

			break;
		case "body":
			
			header.body = src.subarray(pos, pos + len);
			break;
		}

		console.log("Setting potision to 0x%s", snap.toString(16));
		console.log("bbb");
		pos = snap;

	}

	return header;

}

function pass_to_jaxer(packet, callback) {

	console.log("a");

	const JAXER_PORT = 4327;
	const ping = Buffer.from([0, 0, 3, 0, 4, 2]);
	const pong = Buffer.from([0, 0, 3, 0, 4, 1]);
	const client = new net.Socket();

	client.connect(JAXER_PORT, '127.0.0.1', function(err) {
		if(err) {
			return callback(err, null);
		}
		console.log("ping");
		client.write(ping);
	});

	client.on('data', function(data) {

		console.log(data);

		if(pong.compare(data) === 0) {
			console.log("pong");
			client.write(packet);
		} else {
			console.log("b");
			client.destroy();
			let conv = json_binary(data);
			return callback(null, conv);
		}

	});
	
	client.on("error", function(err) {
		return callback(err, null);
	});

}

function handle_file(req, res) {

	// Check stats for file
	
	fs.stat(public_dir + req.url, function(err, stats) {
		if(err) {
			return res.status(404).end("File Not Found");
		}
		
		// Read file body

		fs.readFile(public_dir + req.url, function(err, body) {
			if(err) {
				return res.status(500).end("Could not read file");
			}

			console.log(req.headers);

			const INPUT = [
				{
					"User-Agent" : req.headers['user-agent'],
					"Host" : req.headers['host'],
					"Accept" : "*/*",
					"Cookie" : req.headers['cookie']
				},
				{
					"Last-Modified" : stats.mtime.toGMTString(),
					"ETag" : etag(body),
					"Accept-Ranges" : "bytes",
					"Content-Length" : stats.size.toString()
				},
				{
					"CALLBACK_URI" : "/aptanaRPC",
					"HTTP_USER_AGENT" : req.headers['user-agent'],
					"HTTP_HOST" : req.headers['host'],
					"HTTP_ACCEPT" : "*/*",
					"HTTP_COOKIE" : req.headers['cookie'],
					"PATH" : "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
					"LD_LIBRARY_PATH" : "/opt/AptanaJaxer/Apache22/lib:/opt/AptanaJaxer/Apache22/lib",
					"SERVER_SIGNATURE" : "",
					"SERVER_SOFTWARE" : "(Apache/2.4.35 (Unix) ModJaxer/1.0.3.4549",
					"SERVER_NAME" : "192.168.1.7",
					"SERVER_ADDR" : "192.168.1.7",
					"SERVER_PORT" : "8080",
					"REMOTE_ADDR" : req.connection.remoteAddress,
					"DOCUMENT_ROOT" : public_dir,
					"REQUEST_SCHEME" : "http",
					"CONTEXT_PREFIX" : "",
					"CONTEXT_DOCUMENT_ROOT" : public_dir,
					"SERVER_ADMIN" : "you@example.com",
					"SCRIPT_FILENAME" : public_dir + req.url,
					"REMOTE_PORT" : "56956",
					"SERVER_PROTOCOL" : "HTTP/1.1",
					"REQUEST_METHOD" : "GET",
					"QUERY_STRING" : "",
					"REQUEST_URI" : req.url,
					"SCRIPT_NAME" : req.url,
					"REMOTE_HOST" : req.connection.remoteAddress,
					"STATUS_CODE" : "200",
					"HTTPS" : "off",
					"JAXER_REQ_TYPE" : "2",
					"DOC_CONTENT_TYPE" : "text/html"
				}
			];
			
			console.log("writing the emulated packet");

			const packet = binary_json(INPUT, body);
			fs.writeFileSync("packets/emu.bin", packet);

			pass_to_jaxer(packet, function(err, pack) {
				if(err) {
					return res.status(500).end(err.toString());
				}

				console.log(pack);
				console.log(stats.mtime.toGMTString());
				res.end(pack.body);
			});


		});
	});

}
