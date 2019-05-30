const express=require("express");   //Used for recieving and responding to HTTP Requests (HTTP Server)
const NodeRSA=require("node-rsa");  //Used for RSA encryption/decryption/signing/verificaiton
const crypto=require("crypto");     //Used for hashing and some crypographic functions

const httpAPI=express(); // instantiates an HTTP web server object through ExpressJS
			 // This HTTP web server will be used internally. David's program and other client programs will make calls to this web server
			 // A different web server, located in blocks.js, will be used for different nodes in the network to communicate with each other

let keys=new NodeRSA({b: 512})												 // create a new RSA public + private keypair
const fingerprint=crypto.createHash("sha256").update(keys.exportKey("public")).digest("base64")				 // create a fingerprint of the public key. This can be used for identifying the public key
console.log("Generated public and private keys for the current player. Public key fingerprint: "+fingerprint)		 // Show the user their public key fingerprint


/**
* Emulates Java's String->hashCode to a certain degree. Will create a number that is based off of the string passed to it.
* @returns Number
*/
function numerify(str)
{
	let num=0;
	let buf=Buffer.from(str);
	for(let i=0;i<str.length;i++){
		num+=buf[i]*61^i
	}
	return num;
}

/**
* For use in mining cards. Will produce a hash that is based off of the 3 key constraints in order to meet card privacy, security, and entropy requirements
* @param cardNonce The value to use as a nonce when calculating the card
* @param prevHash A block previous hash value, used to gaurentee t
* @returns String that is base64 encoded and has the hash value of the card. Could have returned a buffer, but for simplicity everything is being base64'd.
*/
function hashCard(cardNonce,prevHash)
{
	return crypto.createHash("sha512").update(fingerprint+prevHash+cardNonce).digest().toString("base64");
}

/**
* Will mine until it finds a valid card.
* @param prevHash hash value to use in mining
* @returns Object with keys hash, salt, and cardID
*/
function drawCard(prevHash)
{
	let salt=0;
	while(!hashCard(salt,prevHash).startsWith("car")) salt+=Math.random();//add a random number every time to make it less easy to guess the salt. Later, we'll make this crypto.randomBytes. Otherwise, it would take the same amount of time to find the card because the salt would be the lowest incremental number that works
	let card={cardHash:hashCard(salt,prevHash),prevHash:prevHash,cardNonce:salt,fingerprint:fingerprint,cardID:numerify(hashCard(salt))%52}
	console.log("Done drawing. check: "+checkCard(card.cardHash,card.fingerprint,card.cardNonce,card.prevHash))
	return card;
}
/**
* Will verify if the card is legitimate. This is done after a card is played to verify that the owner owns the card and that the card has enough entropy
* Later on it would be useful to maintain a database of blocks by prevHash
* @param cardHash has the supplied hash of the card from the transaction (used for card privacy)
* @param cardNonce has the nonce of the card (used for hardness)
* @param fingerprint has the fingerprint of the card holder (used for authentication and for entropy)
* @param prevHash has the previousHash value used when mining the card. Must be somewhat recent (see other node in blocks.js). Used to make sure that nobody gets too much of a head start and prevents premining of cards. This will be more useful when the blockchain supports multiple games.
* @returns Boolean if the card hash is legitimate or not
*/
function checkCard(cardHash,fingerprint,cardNonce,prevHash) //verification that prevHash is recent will be done by the calling function!
{
	console.log(fingerprint+""+prevHash+""+cardNonce)
	let ourHash = crypto.createHash("sha512").update(fingerprint+prevHash+cardNonce).digest().toString("base64");
	console.log("calculated hash "+ourHash + " compared with " +cardHash)
	return ourHash.startsWith("car") && ourHash==cardHash;
}

/**
* For use in debugging and in programs that depend on this.
* @param cardID Number between 0 and 51 that represents a card.
* @returns String that is a human-readable representation of the card
*/
function getCardString(cardID)
{
	if(cardID<0 || cardID>51) throw "cardID "+cardID+" out of bounds!";

	let str;
	if(cardID%13==0) str="Ace of "
	else if(cardID%13<10) str=(cardID%13)+1+" of ";
	else if(cardID%13==10) str="Jack of "
	else if(cardID%13==11) str="Queen of "
	else if(cardID%13==12) str="King of "

	switch(Math.floor(cardID/13))
	{
		case 0:
			str+="Spades"
			break;
		case 1:
			str+="Clovers"
			break;
		case 2:
			str+="Hearts"
			break;
		case 3:
			str+="Diamonds"
			break;
		default:
			throw "cardID "+cardID+" above bounds, something is wrong"
			break;
	}
	return str;
}

/**
* Generates 3 cards that are unique and public to this game. 
* Public cards are revealed after bets, and will be based off of last hash value for previous bet
*
* @returns List of 3 public cards based off of the prevHash
*/
function getPublics(prevHash)
{
	let publics=[]
	//console.log(prevHash.substring(i*Math.floor(prevHash.length/5), (i+1)*Math.floor(prevHash.length/5)))
	for(let i=0; i<5;i++)
	{
		publics.push(numerify(prevHash.substring(i*Math.floor(prevHash.length/5), (i+1)*Math.floor(prevHash.length/5)))%52)
		console.log("PUBLIC COMPONENT "+prevHash.substring(i*Math.floor(prevHash.length/5), (i+1)*Math.floor(prevHash.length/5)))
	}
	//fetch relevant block details
	//generate cards
	return publics //In the future, change the start index to the difficulty characters (for more "predictable entropy"), this will be done once we have a better system for difficulty.

}

exports.getPublics=getPublics;
exports.getCardString=getCardString;
exports.checkCard=checkCard;
exports.drawCard=drawCard;
exports.keys=keys;
exports.numerify=numerify;
exports.fingerprint=fingerprint;
//let card=drawCard("blotest")//generate a card and then determine if the card has already been issued in a previous transaction

//console.log("TEST: Drew card "+getCardString(card.cardID)+" with hash: "+card.hash+" and salt: "+card.salt)
