const express = require('express');
const Discord = require('discord.js');
const { QuickDB } = require("quick.db");
const chalk = require('chalk');
const fs = require('fs');
const cors = require('cors');
const app = express();
const config = require('./config.json');


//Middlewares
const db = new QuickDB();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));


const client = new Discord.Client({
    intents: 65535,
    partials: ['CHANNEL', 'MESSAGE', 'GUILD_MEMBER', 'REACTION', 'USER']
});

client.on('ready', () => { // If bot goes down, any messages sent while it was down will not be recorded (we can't grab them because of goofy discord API stuff)
    console.log(chalk.green("Logged in as : ") + client.user.tag)

    fs.readdir('./messages', (err, files) => { // Starts listening for messages again on proposals after running the bot by reading the .json file names in ./messages
        if (files.length <= 0) {
            return;
        } else {
            files.shift()
            files.forEach(file => {
                let proposal = file.replace('.json','')
                listenforMessages(client.channels.cache.find(thread => thread.name === proposal).id, proposal.replace('proposal',''))
            });
        }
    })
});

async function listenforMessages(threadID, proposalNumber) { // Function for listening to messages and recording them inside a .json file
    client.on('messageCreate', async (message) => {
        let proposalCountdb = await db.get(`proposal${proposalNumber}`) // tiny database used to save which message in the json file to write into next
        if (proposalCountdb) {
            count = proposalCountdb
        } else {
            count = 0
        }
        
        if (message.channelId === threadID) {
            if (count === 10) {
                count = 0
                proposalCountdb = 0
            }

            count++;

            await db.set(`proposal${proposalNumber}`, count)
            
            if(proposalCountdb === null) {
                proposalCountdb = 0
            }

            let messagejson = [proposalCountdb]
            console.log(messagejson);

            const jsonData = JSON.parse(fs.readFileSync(`./messages/proposal${proposalNumber}.json`)) // read current messages in messages.json
            jsonData[messagejson]['AUTHOR_TAG'] = message.author.tag;
            jsonData[messagejson]['AUTHOR_ID'] = message.author.id;
            jsonData[messagejson]['AVATAR_URL'] = message.author.avatarURL();
            jsonData[messagejson]['MESSAGE_CONTENT'] = message.content;
            jsonData[messagejson]['TIMESTAMP'] = message.createdTimestamp;
            jsonData[messagejson]['MESSAGE_ID'] = message.id; // basically just changing each value to write it to the messages.json

            fs.writeFileSync(`./messages/proposal${proposalNumber}.json`, JSON.stringify(jsonData, null, 4)) // write the data to messages.json
        }
    })
}

app.get("/createthread", async (req,res) => { // http://host:port/createthread
    await db.add('proposalCount', 1) // adds 1 into the proposalCount database everytime you access http://host:port/createthread

    try {
    const thread = await client.channels.cache.get(config.CHANNEL_ID).threads.create({ // Create the thread
        name: `proposal${await db.get('proposalCount')}`,
        autoArchiveDuration: 10080
        // reason: ""
    })

    fs.copyFileSync('./messages/messages.json', `./messages/proposal${await db.get('proposalCount')}.json`) // Create .json file for the proposal

    listenforMessages(thread.id, await db.get('proposalCount')) // Might get an out of memory error later because of this
    } catch(err) {
        console.log(err)
    }
    const data = require(`./messages/messages.json`) //going to the correct proposal thread
    res.send(data)
})

app.get('/thread', async (req, res) => {
    let url = req.path // grabbing the url from the client ie cosmodrome/proposal/7
    let regex = /\/proposal\/[0-9]+$/ // regular expression for chopping up the url !!!!if you changed pathing on cosmodrome you need to change this regex expression
    let value = url.match(regex) // checking to see if url === regex
    try{
        const data = fs.readFileSync(`./messages/${value}.json`)
        res.send(data)
    } catch (err){
        const blankData = require(`./messages/messages.json`)
        console.log(err)
        res.send(blankData)
    }
    
})



app.listen(8080, () => {
    console.log(`server running on 8080`)
})

client.login(config.TOKEN); // log into the bot
