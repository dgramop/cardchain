const express=require("express") //the web server package we are using
const inbound=express(); //initialize the web server object
var bodyParser = require('body-parser') // this is used to parse HTTP Bodys in POST requests
// I've decided to remove the database. Everything will happen in-memory beacuse I need to get this program done! //const mongoose=require("mongoose") //this is our driver for MongoDB, the database we are using
inbound.use(bodyParser.json())//tell the webserver to parse JSON bodys
const crypto=require("crypto")//import the crypto class for hashing in javascript
const request=require("request");//API we use to make HTTP request

const EventEmitter = require('events');
class MessageEmitter extends EventEmitter {}
const messageEmitter = new MessageEmitter(); //event emitter setup

const PEER_COUNT=3; //maximum number of peers
const SENDTTL=5;

var peers=[process.env.seed]; // this array contains adjacent network nodes that we can talk to. We hard-code at least one peer in order to facilitate discovery of new peers

//create an eventemitter

// Removed database stuff. Will put it back in later implementation//mongoose.connect("mongodb:\/\/localhost/cardchain") //connect to the mongodb server running on localhost

/* DEAD CODE, IGNORE
const Block = mongoose.model("Block",{transactions:[Object],bN:Number,prevHash:String,nonce:String}) //"Block" "Model", this tells the database what kinds of objects we are going to store and the name of the object we're storing                                                                                                                                                 
// We define the Model "Block" with
        //an array of Objects named "transactions",
        //a Number bN (datatype in JavaScript to represent both floating-point and integer numbers) that will show the block ID,
        //prevHash (String) which will show the previous hash of the blockchain
        //nonce (Number) which will be appended to a stringified transactions before it is hashed in order to facilitate mining
*/ // NO DATABASE

let messages={transactions:{},block:{},other:{}}; //internally, javascript uses a dictionary for objects. We'll be using the dictionary to maintain a hashset-like structure of messages that we've already recieved in order to avoid triggering events for duplicates of the same message
//in a future version we might move to using something like redis that for in-memory cacheing of already-seen messages, or some sort of strcture that lives partly on the filesystem and partly in memory (this structure can grow quite quickly and may be the source of a memory leak, but this program is just a proof-of-concept

//messages.blocks contains if we've recieved a mined-block message by block hash
//messages.transactions contains if we've received a transaction message by signature
//messages.other contains if we've recieved other messages by hash

/**
* This HTTP endpoint recieves messages from other nodes
* @param req -> request object containing details about the HTTP request
* @param res -> response object containing details abd functions that let us manage and send the HTTP response
*/
inbound.post("/message",function(req,res){
	//filter out messages with invalid values or that are way too stale, and messages about transactions that are to enter blocks that have already been mined
	// Time-to-live/hops is zero or the message is more than ten hours old
	if(req.body.ttl==undefined || req.body.time==undefined || req.body.type==undefined || req.body.message==undefined || !validateMessage(req.body.message,req.body.type) ) {res.send({status:"error", message:"Input missing fields."}); return;}
	if(req.body.ttl<=0 || req.body.time+36000000<Date.now()) {res.send({status:"error",message:"TTL zero or message too old"}); return;}
	//filter out all messages we've already recieved that are in memory. Check signatures for transaction messages, hashes for block messages, and check message hashes for all others
	if((req.body.type=="transaction" && messages.transactions[req.body.message.signature]==true) || (req.body.type=="block" && messages.blocks[req.body.message.hash]==true) || messages.other[crypto.createHash("md5").update(JSON.stringify(req.body.message)).digest("base64")] ){ res.send({status:"neutral",message:"I already got this message. Thanks anyways!"}); return;}

	if(req.body.type=="transaction") messages.transactions[req.body.message.signature]=true;
	else if(req.body.type=="block") messages.block[req.body.message.hash]=true;
	else messages.other[crypto.createHash("md5").update(JSON.stringify(req.body.message)).digest("base64")]=true; //it's possible that we might have to use JSON.stringify instead of .toString()! 

	function resendCB(){//this function can be used by the event listener to verify the message is legit and start processing.
		broadcastMessage(req.body.message,req.body.type,req.body.ttl-1,req.body.time)
	}

	let event={message:req.body.message,time:req.body.time,ttl:req.body.ttl,resend:resendCB}
	messageEmitter.emit(req.body.type,event) //trigger the event
	res.send({status:"pending",message:"Thank you for the message. It may be relayed or ignored depending on further processing"})//showing if we recieved messages or not can help attackers tell if they succceeded in isolating a node

/*	//filter out messages that are in the mongoDB database already or that are already in blocks
	Blocks.findOne(req.body.
*///removed database. Everything happens in-memory in-javascript for now.

})

/**
* Broadcasts a message to all known nodes
* @param message -> String or Object with message contents
* @param type -> Type of the message being sent
* @param ttl -> time to live. Basically depth the message will go. Used to control network echo
* @param time -> Time the original message was crafted/sent. Unauthenticated value. Used for controlling stale/old messages
*/
function broadcastMessage(message,type,ttl,time)//response?
{
	if(validateMessage(message,type))
		for(peer of peers) // java equivalent for(String peer : peers)
		{ //potential CSRF attack                                                        //  v---  using the logical or operator in this context, JavaScript checks if the first value is null, if it is then it uses the second value
			request.post({url:"http:\/\/"+peer+"/message",json:true,body:{message:message,time:time || Date.now(), type:type,ttl:ttl || SENDTTL}},function(err,res,body){//err has HTTP errors, res has an HTTP response object, and body has the HTTP response body (useful information)
				if(err) console.log(err)
				if(body.status=="error") console.log(body);
			})
		}
	else console.log("Error: Trying to broadcast invalid message");
}

/**
* Basic message validation. Checks if messages contain their respective fields. Will not do deep validation like signature checks etc. Will just check if appropriate fields are included
* @param message -> Object containing the message
* @param type -> String containing the type of the message
*/
function validateMessage(message,type)
{
	//undefined is like null, just means that it hasn't been set at all                                                                                    v- except for card-claim transactions, where a bogus signature is used and nobody checks it
	return (type=="block" && message.transactions!=undefined && message.prevHash!=undefined && message.hash!=undefined) || (type=="transaction" && message.signature!=undefined && message.signature!=undefined) || (message.type!="block" && message.type!="transaction")
}

//we run peer discovery to learn about new computers if the total number of peers is less than the maximum. We run discovery every five seconds in order to avoid overloading our peers and in order to give everyone else time to settledown and make friends
setInterval(function(){
	if(peers.length<PEER_COUNT) //we check in two places for a similar reason to why i check in two places on my lab. 
	for(peer of peers)
	{
		request.post({url:"http:\/\/"+peer+"/discover",body:peers},function(err,res,body){//peer names are dumbly concatenated. SSRF vulnerability
			if(err)console.log(err)
			JSON.parse(body).peers.forEach(function(newpeer){
				if(!peers.includes(newpeer) && peers.length<PEER_COUNT){ console.log("New peer discovered: "+newpeer+" "+peers.length+"/"+PEER_COUNT); peers.push(newpeer)}//this does not filter out itself as a peer. this would require the user to set a list address/hostnames to blacklist, and it would have to blacklist itself. It isn't causing problem right now so I'm not going to fix it
			})
		})
	}
	//console.log("known peers: "+JSON.stringify(peers))
},5000)

inbound.post("/discover",function(req,res){
	console.log("DISCOVER BODY"+JSON.stringify(req.body))//later on will implement a bidirectional peer-exchange and will add incoming peers to the list. for now, we'll keep it like this beacause it works
	res.send({peers:peers})
})


exports.broadcast=broadcastMessage;
exports.messageEmitter=messageEmitter;

let port=process.env.cardPort || Math.floor(Math.random()*2000+8000)
inbound.listen(port)
console.log("server listening on port "+port)//we don't use a constant port among all nodes in order to make testing easier
