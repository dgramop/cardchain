const crypto=require("crypto")
const nodeRSA=require("node-rsa")
const DIFFICULTY=3;

const startString="".padStart(DIFFICULTY,"block")

console.log("All block hashes must start with: "+startString)

/**
* mineBlock will find a nonce that can be concatenated with the other block fields in order to produce a valid block
* @param block - block object with invalid nonce and empty string as current hash.
* @param cb - callback which takes a block object, this time with a valid nonce and current hash
*/
function mineBlock(block,cb)
{
	let transactions=JSON.stringify(block.transacitons)
	while(!block.hash.toString().startsWith(startString))//transactions cannot contain | because it is a delimiter
	{
		block.nonce++;//                                    v--- block.bN, or bN stands for block Number, or how "high" the block is in the blockchain (how many linkedlist nodes it is from the head)
		block.hash=crypto.createHash("sha256").update(block.bN+"|"+transactions+"|"+block.prevHash+"|"+block.nonce).digest("base64")
		//we don't include current hash because that's what we're calculating here. We could if we wanted to, but it would make this code very weird if not impossible.
	}
	cb(block);
}

/**
* verifyBlock will return if a block is valid based on its hash and signatures
* block - block object
*/
function verifyBlock(block,cb)
{
	let transactions=JSON.stringify(block.transacitons)
	if(crypto.createHash("sha256").update(block.bN+"|"+transactions+"|"+block.prevHash+"|"+block.nonce).digest("base64")==block.hash && block.hash.toString().startsWith(startString))
		for(transaction of block.transactions)
		{
			console.log(transaction)
			//return false;
		}
	return true;
}

module.exports.mine=mineBlock;
module.exports.verify=verifyBlock;
