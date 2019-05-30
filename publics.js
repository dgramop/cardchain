function numerify(str)
{
        let num=0;
        let buf=Buffer.from(str);
        for(let i=0;i<str.length;i++){
                num+=buf[i]*61^i
        }
        return num;
}



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
        return publics //In the future, change the start index to the difficulty characters (for more "predictable entropy"), this will be done once we have a better system for difficult$

}

console.log(getPublics("testttt"))
