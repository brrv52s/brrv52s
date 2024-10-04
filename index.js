const express = require("express");
const { Client } = require('discord.js-selfbot-v13');
const { joinVoiceChannel } = require('@discordjs/voice');

const app = express();
const PORT = process.env.PORT || 2000;

const client = new Client({
  checkUpdate: false,
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT} 🚀`);
  console.log("I'm Ready To Work 🫣"); 
});

app.get('/', (req, res) => {
  res.send(`
    <body>
      <center><h1>Ready To Work 24h! </h1></center>
      <center><h2>Made By : .52s</h2></center>
      <center><h3>discord server : <a target="_blank" href="https://discord.com/invite/ReC93u9fZw">https://discord.com/invite/ReC93u9fZw</a></h3></center>
    </body>
  `);
});

client.on('ready', () => {
  console.log(`${client.user.username} is ready ✅`);
});

client.on('ready', async () => {
  setInterval(async () => {
    client.channels.fetch(process.env.channel)
      .then((channel) => {
        const VoiceConnection = joinVoiceChannel({
          channelId: channel.id,
          guildId: channel.guild.id,
          adapterCreator: channel.guild.voiceAdapterCreator,
          selfMute: false, //set true or false 
          selfDeaf: false, //set true or false 
        });
      })
      .catch((error) => {
        console.error('Error fetching channel:', error);
      });
  }, 1000);
});

client.login(process.env.token); 
