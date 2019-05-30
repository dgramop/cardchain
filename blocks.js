const miner=require("./miner.js")		//handles block mining and verificaiton
const pubsub=require("./pubsub.js")		//handles publish/subscribe
const transactions=require("./transactions.js")	//handles some transaction processing. some functionality from this file will move there
const messages=pubsub.messageEmitter		//messageEmitter emits messages recieved from other nodes
const broadcast=pubsub.broadcast		//transaction broadcasting
const express=require("express")		//expressJS
const httpAPI=express();			//create the HTTP API
const NodeRSA=require("node-rsa")		//used for RSA signing
const crypto=require("crypto")			//used for SHA hashing
const request=require("request")		//used mostly for calling itself in the API, somewhat of a bad-practice. Will be a stopgap until the next version
//the card blockchain only supports one game at a time and will only last for one game before it must be reset
// this is done in order to minimize the number of transaction types and states for each game. This is a very limited proof-of-concept and is done in order to show the effectiveness of the cardClaim and cardPlay functionality, and in order to meet a reasonable deadline. I would want to expand the functionality and features of the blockchain, pub/sub and peer discovery systems in the future

let curBlock={//genesis block. remined by defauly
 bN:0,
 nonce:0,
 transactions:[],
 prevHash:"blockblockblock",
 hash:"",
 prevBlock:null
};

let tQ=[];//transaction queue

//Message types needed
//  - Sync blockchain. Get blocks after time (t) or after block (b)
//  - Mined block. Send out mined version of block

/**
* Checks if the previous hash supplied is a valid hash in the blockchain
* @param prevHash String with the previous hash
* @param block - block that the the hash is supposed to be near to
* @returns Boolean if the hash is recent relative to block
*/
function isValidPrevHash(prevHash,block)
{
	let iterBlock=block || curBlock;//instead of overloading, I do this to tell JavaScript to use block if supplied, otherwise default to the current block
	for(let i=0;i<4 && iterBlock!=null;i++)
	{
		if(iterBlock.hash==prevHash) return true;
		iterBlock=iterBlock.prevBlock;//used to be iterBlock=curBlock.prevBlock, this is wrong. Fixed
	}
	return false;
}
messages.on("block",function(event){
	//check if block is valid
	if(miner.verify(event.message.block))
	{
	//iterate through and confirm transactions. It would be more efficient to cache transactions that have already been verified to make fewer heavy crypto operations
	//put make the linked list happen!
	}
})

messages.on("transaction",function(event){
	//verify transactions based on type
	if(event.message.type=="playCard")// not to be confused with req.body.type which should be "transaction" in thie case. event.message.type looks into the transaction body (req.message) and then pulls the type of the transaction
	{
		//TODO check for pubkey in validation
		//verify signature
		//TODO make sure someone claimed this card originally
		let pub=new NodeRSA(event.message.pubkey,"public")
		//console.log("Got trasaction with sig: "+event.message.signature)
		let signature=event.message.signature;
		event.message.signature=""
		if(!pub.verify(JSON.stringify(event.message),signature,"utf8","base64"))
		{
			console.log("Failed to verify signature");
			console.log(event.message);
			return;
		}
		event.message.signature=signature;
		if(isValidPrevHash(event.message.prevHash) && transactions.checkCard(event.message.cardHash,event.message.fingerprint,event.message.cardNonce,event.message.prevHash))//in order to prevent re-hashing of the keys in the dictionary, instead of using "delete" to remove the key, set the string of the signature to null when verifying signature and when signing
		{
			//console.log(isValidPrevHash(event.message.prevHash) )
			//already appending to queue, just let it happen. Can show that something went down to the user
			//console.log("legit transaction.")
			console.log("playCard: "+JSON.stringify(event.message))
			event.resend()
		}else{ console.log("prevHash stale or hashes don't match");console.log(isValidPrevHash(event.message.prevHash));console.log(event.message); return;}
	}
	else if(event.message.type=="fold" || event.message.type=="call")
	{
		//check signature
		let pub=new NodeRSA(event.message.pubkey,"public")
                //console.log("Got trasaction with sig: "+event.message.signature)
                let signature=event.message.signature;
                event.message.signature=""
		if(event.message.time<Date.now()-1800000) {console.log("Super stale transaction. Possible replay attack"); return;}
		if(!pub.verify(JSON.stringify(event.message),signature,"utf8","base64"))
                {
                        console.log("Failed to verify signature");
                        console.log(event.message);
                        return;
                }
                event.message.signature=signature;
	}
	else if(event.message.type=="claimCard")//no valid signature. Duplicates possible
	{
		//this transaction type is not completely necessary. It is necessary to help with the proof-of-freshness though, to show that it was drawn in a recent block instead of assuming the block when the card is played is the current block
		//should have attribute prevHash or bN so that we can prioritize the transaction into there. Must be recent by at least 2 blocks
		//not much verification needed here. Playing the POC card, we'll resend by default
		console.log(event.message)
		event.resend();
	}
	else
	{
		return; //for now, reject all other transaction types
	}

	//put transaction into transaction queue for processing
	tQ.push(event.message)
	//if there are enough transactions, trigger processing
	//in a later version, sync up all card claim transactions
})

let cards={};
httpAPI.get("/drawCard",function(req,res){
        let card=transactions.drawCard(curBlock.hash);
        cards[card.cardID]=card;//index by cardID (value between 0 and 52 of the car)
        res.send(""+card.cardID);//adds empty string in order to prevent express from sending a status code
	//message={};//problem: IP address of submitter can be used to reveal card owner
	//problem: with this, someone can tell which cards have already been dealt. Usually this should not be a problem, but in Poker, if you know which cards "exist", it might cause some problems. Hence we re-hash the card hash
	pubsub.broadcast({signature:Math.random()+"", type:"claimCard",hash:/*crypto.createHash("sha256").update(*/card.cardHash/*).digest("base64").toString()*/}, "transaction")
})

httpAPI.get("/drawCards",function(req,res){
        let card1=transactions.drawCard(curBlock.hash);
        let card2=transactions.drawCard(curBlock.hash);
	cards[card1.cardID]=card1;//index by cardID (value between 0 and 52 of the car)
	cards[card2.cardID]=card2;//index by cardID (value between 0 and 52 of the car)
	res.send(card1.cardID+" "+card2.cardID);//adds empty string in order to prevent express from sending a status code
        //message={};//problem: IP address of submitter can be used to reveal card owner
        //problem: with this, someone can tell which cards have already been dealt. Usually this should not be a problem, but in Poker, if you know which cards "exist", it might cause so$
        pubsub.broadcast({signature:Math.random()+"", type:"claimCard",hash:/*crypto.createHash("sha256").update(*/card1.cardHash/*).digest("base64").toString()*/}, "transaction")
        pubsub.broadcast({signature:Math.random()+"", type:"claimCard",hash:/*crypto.createHash("sha256").update(*/card2.cardHash/*).digest("base64").toString()*/}, "transaction")
})


httpAPI.get("/fold",function(req,res){//TODO include fingerprint
	let message={signature:"",authTime:Date.now(),type:"fold",pubkey:transactions.keys.exportKey("public")}//in order to prevent replay attacks we sign the current time
	message.signature=transactions.keys.sign(JSON.stringify(message),"base64")//we depend on the fact that JSON.parse() & JSON.stringify will produce the same elements in the same order no matter what
	pubsub.broadcast(message,"transaction")
	res.send({status:"success"})
})

httpAPI.get("/call",function(req,res){
	let message={signature:"",authTime:Date.now(),type:"call",pubkey:pubkey=transactions.keys.exportKey("public")}//in order to prevent replay attacks we sign the current time
	message.signature=transactions.keys.sign(JSON.stringify(message),"base64")//we depend on the fact that JSON.parse() & JSON.stringify will produce the same elements in the same order no matter what
	pubsub.broadcast(message,"transaction")
	res.send({status:"success"})
})


httpAPI.get("/getFoldsCalls",function(req,res){//todo: actually sync with blockchain in order to prevent double-spend (play?) and similar attacks
        let resp="";
	let totalMoves=0
	for(let iterBlock=curBlock;iterBlock!=null;iterBlock=iterBlock.prevBlock)//basically iterate the linked list
        {
		for(transaction of iterBlock.transactions)//iterate through the array in each object in the linked list
		{
			if(transaction.type=="fold")
			{
				console.log("Fold transaction found when traversing "+JSON.stringify(transaction))
				resp+=crypto.createHash("sha256").update(transaction.pubkey).digest("base64").toString()+" folded|"
				totalMoves++;//temporary stopgap for fingerprint. TODO add fingerprint to transaction and have fingerprint verification
			}
			if(transaction.type=="call")
			{
				console.log("Call transaction found when traversing "+JSON.stringify(transaction))
				resp+=crypto.createHash("sha256").update(transaction.pubkey).digest("base64").toString()+" called|"
				totalMoves++;
			}
		}
        }
	if(totalMoves>=3)
	{
		console.log("REVEALING CARDS")
		revealBothCards();
	}
	res.send(resp)
	//traverse blockchain for all folds & calls
})

var publics;

httpAPI.get("/getPublics",function(req,res){
//community cards are available in the very beggining of the game. here, we set it to the first block of the chain, but later on it should be tied to the block that represents the point at which it should be revealed. For the deadline though, we have to make it attach the public cards to the constant value of the first block's hash.
//In the full version of poker for a later version, we would implement getPublics to fetch the public card based on the hash of the block of the latest round of betting
	//let publics=transactions.getPublics(curBlock.hash);
	let resp="";
	for(public of publics)//if david complans about null things at the end of split, I will just remove the last character. Maybe we should have used JSON, but we couldn't find an acceptable JSON api so we're using string parsing instead
		resp+=public+" ";
	res.send(resp)
})

httpAPI.get("/getPlayedCards",function(req,res){
	//transactions.numerify
	let resp="";
        for(let iterBlock=curBlock;iterBlock!=null;iterBlock=iterBlock.prevBlock)//basically iterate the linked list
        {
                for(transaction of iterBlock.transactions)//iterate through the array in each object in the linked list
                {
                        if(transaction.type=="playCard")
                        {
                                console.log("Found revealed card when traversing "+JSON.stringify(transaction))
                                resp+=transaction.cardID+" ";//cardID is NOT AUTHENTICATED. this can be fixed easily in the transaction processing section
                        }
                }
        }
	res.send(resp)//at this point we're done
        //traverse blockchain for all played cards
})

httpAPI.get("/availableCards",function(req,res){
	res.send(Object.keys(cards));
})

httpAPI.get("/playCard/:cardID",function(req,res){ //in order to prevent re-hashing of the keys in the dictionary, instead of using "delete" to remove the key, set the string of the signature to null when verifying signature and when signing
	let message={};
	if(cards[req.params.cardID]==undefined) { res.send({status:"error",message:"card not found, we don't have that card."}); return; }
	let card=cards[req.params.cardID]						//get the details from the card
	message=card;									//build the message
	message.type="playCard"								//set the transaction type
	message.pubkey=transactions.keys.exportKey("public")				//place the public key inside the transaction. TODO move more of this functionality to transactions.js
	message.signature="";								//set an empty signature key. See note on the first line of this callback function for more
	message.fingerprint=transactions.fingerprint					//set owner fingerprint
	console.log("outbound message"+JSON.stringify(message))				//for debugging, log the serialized outbound message without signature
	message.signature=transactions.keys.sign(JSON.stringify(message),"base64")	//sign the message with our private key
	pubsub.broadcast(message,"transaction")						//broadcast the message containing the transaction to other nodes
	res.send({status:"success","signature":message.signature})			//tell the client/gui that everything should be OK
	//console.log("SELF_CHECK VALIDITY"+transactions.checkCard(message.cardHash,message.fingerprint,message.cardNonce,message.prevHash))
	delete cards[req.params.cardID];						//once we've played a card, let's not try to play it again

})

function revealBothCards()
{
	let message={}; 
	console.log("PLAYING CARDS "+JSON.stringify(Object.keys(cards)))
	for(cardID of Object.keys(cards))
	{
        	let card=cards[cardID]                                               //get the details from the card
        	message=card;                                                                   //build the message
        	message.type="playCard"                                                         //set the transaction type
        	message.pubkey=transactions.keys.exportKey("public")                            //place the public key inside the transaction. TODO move more of this functionality to transaction$
        	message.signature="";                                                           //set an empty signature key. See note on the first line of this callback function for more
        	message.fingerprint=transactions.fingerprint                                    //set owner fingerprint
		console.log("outbound message"+JSON.stringify(message))                         //for debugging, log the serialized outbound message without signature
	        message.signature=transactions.keys.sign(JSON.stringify(message),"base64")      //sign the message with our private key
	        pubsub.broadcast(message,"transaction")                                         //broadcast the message containing the transaction to other nodes
        	delete cards[cardID];		                                                //once we've played a card, let's not try to play it again
	}
}

//this code will mine the current block
if(curBlock.bN==0) miner.mine(curBlock,function(mined){ curBlock=mined; console.log(curBlock); publics=transactions.getPublics(mined.hash)}) //async! will cause issues later on!

let port=process.env.adminPort || Math.floor(Math.random()*2000)+10000
httpAPI.listen(port)
console.log("admin server listening on port "+port)
exports.adminPort=port;

setInterval(function(){
	if(tQ.length>0) //we set the minimum threshold to start mining very low in this case. Individual nodes could choose to have higher thresholds
	{
	//if a block with the target block number is created mid-mining, we'll have to throw away our mining work, subtract transactions, then try again
		let ourTransactions=[];
		for(let i=0;i<5 && tQ.length>0;i++)//max transactions per block is 5
		{
			ourTransactions.push(tQ.shift())
		}
		let pendingBlock={
			bN:curBlock.bN+1,
 			nonce:0,
	 		transactions:ourTransactions,
 			prevHash:curBlock.hash,
			hash:"",
			prevBlock:curBlock
		};

		miner.mine(pendingBlock,function(mined){
			console.log(JSON.stringify(mined),2)
			curBlock=mined
		})

	}
},10000) //every 10 seconds, we check if there are any transactions. If so, we put them into a block and mine them.
