const miner=require("./miner.js")
const { spawn }=require("child_process")
const request=require("request")

//const TOTAL_NODES=10;//minimum is 4

// Test the miner
console.log("Testing Miner")
miner.mine({ bN:0,
        hash:"",
        prevHash:"",
        nonce:0, //could have made this into an ascii string, but a lot more intuitive to interate through numbers. iterating through chars in a string could take less bandwidth unless I used different serialization
        transactions:["test","test","test"]
},function(block){
	console.log(JSON.stringify(block)+" correctness: "+miner.verify(block))
})

//test pubsub. This will assemble a circular, directed network with each  node having one outbound connection. Peer discovery will then occur causing the network to become better connected
const ps1=spawn("/home/dgramop/.nvm/versions/node/v10.10.0/bin/node",["/home/dgramop/projects/cardchain/pstest.js"],{env:{"cardPort":"1231","seed":"localhost:1232"}})
ps1.stdout.on("data",function(dat){console.log("[ps0] "+dat.toString())})
ps1.stderr.on("data",function(dat){console.log("[ps0] "+dat.toString())})

//this is the process that the user will play as
const ps2=spawn("/home/dgramop/.nvm/versions/node/v10.10.0/bin/node",["/home/dgramop/projects/cardchain/pstest.js"],{env:{"cardPort":"1232","seed":"localhost:1233","adminPort":"11544"}})
ps2.stdout.on("data",function(dat){console.log("[ps1] "+dat.toString())})
ps2.stderr.on("data",function(dat){console.log("[ps1] "+dat.toString())})

const ps3=spawn("/home/dgramop/.nvm/versions/node/v10.10.0/bin/node",["/home/dgramop/projects/cardchain/pstest.js"],{env:{"cardPort":"1233","seed":"localhost:1231"}})
ps3.stdout.on("data",function(dat){console.log("[ps2] "+dat.toString())})
ps3.stderr.on("data",function(dat){console.log("[ps2] "+dat.toString())})

/*for(let i=3;i<TOTAL_NODES;i++){
 const psn=spawn("/home/dgramop/.nvm/versions/node/v10.10.0/bin/node",["/home/dgramop/projects/cardchain/pstest.js"],{env:{"cardPort":"123"+(i+1),"seed":"localhost:123"+((i+1)%(TOTAL_NODES) +1 )}})
 psn.stdout.on("data",function(dat){console.log("[ps"+i+"] "+dat.toString())})
 psn.stderr.on("data",function(dat){console.log("[ps"+i+"] "+dat.toString())})
}*/

//11544 admin port
setTimeout(function(){
console.log("Testing internal API")//have rounds?!??!
/*console.log("Drawing 2 cards")
let cards=[];
request("http:\/\/localhost:11544/drawCard",function(e,res,body){
	cards.push(parseInt(body))
	request("http:\/\/localhost:11544/drawCard",function(e,res,body){
		cards.push(parseInt(body))
		console.log("Cards: "+JSON.stringify(cards))

		setTimeout(function(){
			console.log("Revealing cards")
			request("http:\/\/localhost:11544/playCard/"+cards[0],function(e,res,body){console.log(body)})
			request("http:\/\/localhost:11544/playCard/"+cards[1],function(e,res,body){console.log(body)})
		},6000)
	})
})
console.log("Getting public 5 cards")*/

request("http:\/\/localhost:11544/getPublics",function(e,res,body){
	console.log("PUBLICS "+body)
})

},16000)
