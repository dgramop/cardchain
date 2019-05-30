/*const pubsub=require("./pubsub.js");
messages=pubsub.messageEmitter;

messages.on("test",function(event){
	console.log(event)
	event.resend()
})

if(process.env.cardPort=="1234") setTimeout(function(){pubsub.broadcast({"test":"test"},"test")},10000) //only one node should broadcast
if(process.env.cardPort=="1234") setTimeout(function(){pubsub.broadcast({"test":"BEST"},"test")},15000) //only one node should broadcast
*/
let blocks=require("./blocks.js")
// see test.js: if we're not the player that is connected to the GUI ( meaning that we are an emulated blockchain player ) then randomly fold/call
const request=require("request")

setTimeout(function(){
	if(process.env.adminPort!=11544) request("http:\/\/localhost:"+blocks.adminPort+"/drawCards",function(e,r,b){if(e)console.log(e);})
},16000)

setTimeout(function(){
if(process.env.adminPort!=11544)
	if(Math.random()<0.5) request("http:\/\/localhost:"+blocks.adminPort+"/fold",function(e,r,b){if(e)console.log(e);console.log(b)})
	else request("http:\/\/localhost:"+blocks.adminPort+"/call",function(e,r,b){if(e)console.log(e);console.log(b)})

},20000)

setInterval(function(){
	request("http:\/\/localhost:"+blocks.adminPort+"/getFoldsCalls",function(e,r,b){if(e)console.log(e);})
},5000)
