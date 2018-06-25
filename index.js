const Discord = require('discord.js');
const bot = new Discord.Client();
const ytdl = require('ytdl-core');
const request = require('request');
const getYouTubeID = require('get-youtube-id');
const fetchInfo = require('youtube-info');

// Load Config
const config = require('./config.json');

/**
 * Define Variables for functionalities like
 * Queue, channel, dispatcher, skip requests
 */
let queue = [];
let isPlaying = false;
let voiceChannel = null;
let dispatcher = null;
let skipReq = 0;
let skippers = [];
let currentChannel = null;

bot.on('ready', () => {
  console.log(
    `Logged in as ${bot.user.tag} with ${bot.users.size} users and ${
      bot.channels.size
    } channels`
  );
  bot.user.setActivity(`Serving my loba lobas`);
});

bot.on('message', async message => {
  if (message.author.bot) return;

  if (message.content.indexOf(config.prefix) !== 0) return;

  const args = message.content
    .slice(config.prefix.length)
    .trim()
    .split(/ +/g);
  const query = args.join(' ');
  const command = args.shift().toLowerCase();

  if (command === 'ping') {
    const msg = await message.channel.send('Checking Ping, hmm...');
    msg.edit(
      `Pongg! The Latency is ${msg.createdTimestamp -
        message.createdTimestamp}ms. Bot Latency is ${Math.round(bot.ping)}ms`
    );
  }

  if (command === 'info') {
    const msg = await message.channel.send(
      'Hello dis is the Mr Loba Loba Bot, currently serving the Loba Loba(s)'
    );
  }

  if (command === 'summon') {
    if (!isPlaying) {
      voiceChannel = message.member.voiceChannel;
    } else {
      message.channel.send(
        `Loba loba is rocking da loba loba, join us or wait for da loba loba to finish`
      );
    }
  }

  if (command === 'play') {
    // Set User's Voice Channel
    voiceChannel = message.member.voiceChannel;

    if (!message.member.voiceChannel)
      return message.reply("Can't find you loba loba, pls join da channel!");

    if (queue.length > 0 || isPlaying) {
      getId(query, id => {
        addQueue(id);
        fetchInfo(id, (err, videoInfo) => {
          if (err) throw new Error(err);
          message.channel.send(`Added to queue: **${videoInfo.title}**`);
          bot.user.setActivity(`${videoInfo.title}`);
        });
      });
    } else {
      isPlaying = true;
      getId(query, id => {
        queue.push('placeholder');
        playSong(id, message);
        fetchInfo(id, (err, videoInfo) => {
          if (err) throw new Error(err);
          message.channel.send(`Start loba loba: **${videoInfo.title}**`);
          bot.user.setActivity(`${videoInfo.title}`);
        });
      });
    }
  }

  if (command === 'skip') {
    if (!message.member.voiceChannel)
      return message.reply("Can't find you loba loba, pls join da channel!");

    if (queue.length !== 0) {
      if (skippers.indexOf(message.author.id) === -1) {
        skippers.push(message.author.id);
        skipReq += 1;
        if (skipReq >= Math.ceil((voiceChannel.members.size - 1) / 2)) {
          skipSong(message);
          message.channel.send(`Skipping song now, loba loba`);
        } else {
          message.channel.send(
            ` can\'t skip song, loba loba. Nid **${Math.ceil(
              (voiceChannel.members.size - 1) / 2
            )}** more votes to skip`
          );
        }
      } else {
        message.reply(` loba loba you've already voted for song skip`);
      }
    } else {
      message.channel.send('There is no more loba loba to skipptto');
      dispatcher.end();
    }
  }

  if (command === 'np') {
    if (queue.length === 0)
      return message.channel.send('There is no loba loba playing right now');

    if (!message.member.voiceChannel)
      return message.reply("Can't find you loba loba, pls join da channel!");

    return message.channel.send(`Now playing: ${queue[0].title}`);
  }

  if (command === 'pause') {
    if (queue.length === 0)
      return message.channel.send('There is no loba loba playing right now');

    if (!message.member.voiceChannel)
      return message.reply("Can't find you loba loba, pls join da channel!");

    pauseSong(message);
  }

  if (command === 'resume') {
    if (queue.length === 0)
      return message.channel.send('There is no loba loba playing right now');

    if (!message.member.voiceChannel)
      return message.reply("Can't find you loba loba, pls join da channel!");

    resumeSong(message);
  }

  if (command === 'stfu') {
    if (queue.length === 0)
      return message.channel.send('There is no loba loba playing right now');

    forceEndSong(message);
  }
});

/**
 * Functions
 */
const forceEndSong = message => {
  dispatcher.end();

  dispatcher.on('end', () => {
    return message.channel.send('Loba loba is no more');
  });
};

const resumeSong = message => {
  dispatcher.resume();
  return message.channel.send('Resuming Loba loba');
};

const pauseSong = message => {
  dispatcher.pause();
  return message.channel.send('Loba loba taking a short break');
};

const skipSong = message => {
  dispatcher.end();

  dispatcher.on('end', () => {
    // Reset Skip Requests again
    resetSkip();
    // Remove first song from list
    queue.shift();
    // Check if theres still songs remaining in list
    if (queue.length === 0) {
      queue = [];
      isPlaying = false;
    } else {
      playSong(queue[0].id, message);
    }
  });
};

const playSong = (id, message) => {
  const permissions = voiceChannel.permissionsFor(message.client.user);

  if (!permissions.has('CONNECT')) {
    return message.channel.send(
      "Can't join you for da loba loba, check da join permissions"
    );
  }

  if (!permissions.has('SPEAK')) {
    return message.channel.send(
      "Can't play da loba loba, check da speakku permissions"
    );
  }

  voiceChannel.join().then(connection => {
    currentChannel = { ...connection };

    stream = ytdl(`https://www.youtube.com/watch?v=${id}`, {
      filter: 'audioonly'
    });

    // Reset Skip Requests
    resetSkip();

    dispatcher = connection.playStream(stream);
  });
};

const getId = (str, callback) => {
  if (isYoutube(str)) {
    // Returned Video ID
    callback(getYouTubeID(str));
  } else {
    // Return Video ID
    searchVideo(str, id => {
      callback(id);
    });
  }
};

const searchVideo = (queryText, callback) => {
  request(
    'https://www.googleapis.com/youtube/v3/search?part=id&type=video&q=' +
      encodeURIComponent(queryText) +
      '&key=' +
      config.api_key,
    (err, response, body) => {
      const json = JSON.parse(body);
      callback(json.items[0].id.videoId);
    }
  );
};

const isYoutube = str => {
  return str.toLowerCase().indexOf('youtube.com') > -1;
};

const addQueue = strId => {
  if (isYoutube(strId)) {
    const videoId = getYouTubeID(strId);
    fetchInfo(videoId, (err, videoInfo) => {
      const data = {
        id: videoInfo.id,
        title: videoInfo.title,
        url: videoInfo.url
      };
      queue.push(data);
    });
  } else {
    fetchInfo(strId, (err, videoInfo) => {
      const data = {
        id: videoInfo.id,
        title: videoInfo.title,
        url: videoInfo.url
      };
      queue.push(data);
    });
  }
};

const resetSkip = () => {
  skipReq = 0;
  skippers = [];
};

bot.on('disconnect', () => console.log('Disconnecting...'));

bot.on('reconnecting', () => console.log('Reconnecting...'));

bot.login(config.token);
