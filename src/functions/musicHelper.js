const { EmbedBuilder } = require("discord.js");
const { convertTime } = require("./timeFormat.js");

function formatString(str, maxLength) {
    return str.length > maxLength ? str.substr(0, maxLength - 3) + "..." : str;
}

module.exports = {
    playMusic: async (client, message, query) => {
        console.log(`[AI Music] Requested to play: ${query}`);
        const embed = new EmbedBuilder().setColor(client.config.embedColor);

        // Check voice channel
        if (!message.member.voice.channel) {
            return { success: false, message: "You must be in a voice channel to play music." };
        }

        let player = client.rainlink.players.get(message.guild.id);

        // Check voice channel match if player exists
        if (player && player.voiceId !== message.member.voice.channelId) {
            return { success: false, message: "You must be in the same voice channel as the bot." };
        }

        try {
            // Search/load track(s)
            const result = await client.rainlink.search(query, { requester: message.author, sourceID: client.config.lavalinkSource });

            if (result.type === "EMPTY" || result.type === "ERROR" || !result.tracks.length) {
                return { success: false, message: `No results found for your query: \`${query}\`.` };
            }

            // Create player if needed
            if (!player) {
                player = await client.rainlink.create({
                    guildId: message.guild.id,
                    textId: message.channel.id,
                    voiceId: message.member.voice.channelId,
                    shardId: message.guild.shardId,
                    volume: client.config.defaultVolume || 100,
                    deaf: true,
                });
            }

            let responseMessage = "";

            // Handle playlist or single track
            if (result.type === "PLAYLIST") {
                for (const track of result.tracks) player.queue.add(track);
                responseMessage = `Added **[${result.playlistName}](${query})** - \`${result.tracks.length}\` songs to the queue.`;
            } else {
                const track = result.tracks[0];
                const trackTitle = formatString(track.title, 30).replace(/ - Topic$/, "") || "Unknown";
                const trackAuthor = formatString(track.author, 25).replace(/ - Topic$/, "") || "Unknown";
                player.queue.add(track);
                responseMessage = `Added **[${trackTitle} - ${trackAuthor}](${track.uri})** - \`${convertTime(track.duration)}\`.`;
            }

            // Start playing if not already
            if (!player.playing) {
                await player.play();
            }

            return { success: true, message: responseMessage };

        } catch (error) {
            console.error('[AI Play Music Error]:', error);
            return { success: false, message: `Error playing track: \`${error.message}\`.` };
        }
    },

    stopMusic: async (client, message) => {
        let player = client.rainlink.players.get(message.guild.id);

        if (!player) {
            return { success: false, message: "I am not currently playing any music." };
        }

        // Check voice channel match
        if (message.member.voice.channelId !== player.voiceId) {
            return { success: false, message: "You must be in the same voice channel as the bot." };
        }

        player.destroy();
        return { success: true, message: "Stopped the music and left the voice channel." };
    },

    skipMusic: async (client, message) => {
        let player = client.rainlink.players.get(message.guild.id);
        if (!player) return { success: false, message: "No music is playing." };
        if (message.member.voice.channelId !== player.voiceId) return { success: false, message: "You must be in the same voice channel." };

        if (player.queue.isEmpty && !client.data.get("autoplay", player.guildId)) {
            return { success: false, message: "Queue is empty, cannot skip." };
        }

        player.skip();
        return { success: true, message: "Skipped the current song." };
    },

    setVolume: async (client, message, volume) => {
        let player = client.rainlink.players.get(message.guild.id);
        if (!player) return { success: false, message: "No music is playing." };
        if (message.member.voice.channelId !== player.voiceId) return { success: false, message: "You must be in the same voice channel." };

        if (volume < 0 || volume > 100) return { success: false, message: "Volume must be between 0 and 100." };

        player.setVolume(volume);
        return { success: true, message: `Volume set to ${volume}%.` };
    },

    pauseMusic: async (client, message) => {
        let player = client.rainlink.players.get(message.guild.id);
        if (!player) return { success: false, message: "No music is playing." };
        if (message.member.voice.channelId !== player.voiceId) return { success: false, message: "You must be in the same voice channel." };

        if (player.paused) return { success: false, message: "Music is already paused." };

        player.pause();
        return { success: true, message: "Paused the music." };
    },

    resumeMusic: async (client, message) => {
        let player = client.rainlink.players.get(message.guild.id);
        if (!player) return { success: false, message: "No music is playing." };
        if (message.member.voice.channelId !== player.voiceId) return { success: false, message: "You must be in the same voice channel." };

        if (!player.paused) return { success: false, message: "Music is not paused." };

        player.resume();
        return { success: true, message: "Resumed the music." };
    },

    shuffleQueue: async (client, message) => {
        let player = client.rainlink.players.get(message.guild.id);
        if (!player) return { success: false, message: "No music is playing." };
        if (message.member.voice.channelId !== player.voiceId) return { success: false, message: "You must be in the same voice channel." };

        if (player.queue.isEmpty || player.queue.length <= 1) return { success: false, message: "Not enough songs to shuffle." };

        player.queue.shuffle();
        return { success: true, message: "Shuffled the queue." };
    },

    seekMusic: async (client, message, timeInSeconds) => {
        let player = client.rainlink.players.get(message.guild.id);
        if (!player) return { success: false, message: "No music is playing." };
        if (message.member.voice.channelId !== player.voiceId) return { success: false, message: "You must be in the same voice channel." };

        if (!player.queue.current.isSeekable) return { success: false, message: "Current song is not seekable." };
        if (timeInSeconds * 1000 > player.queue.current.duration) return { success: false, message: "Time exceeds song duration." };

        player.seek(timeInSeconds * 1000);
        return { success: true, message: `Seeked to ${timeInSeconds} seconds.` };
    },

    playPrevious: async (client, message) => {
        let player = client.rainlink.players.get(message.guild.id);
        if (!player) return { success: false, message: "No music is playing." };
        if (message.member.voice.channelId !== player.voiceId) return { success: false, message: "You must be in the same voice channel." };

        if (!player.queue.previous) return { success: false, message: "No previous song found." };

        player.previous();
        return { success: true, message: "Playing previous song." };
    },

    set247: async (client, message) => {
        if (!message.member.permissions.has("ManageGuild")) {
            return { success: false, message: "You need 'Manage Guild' permission to toggle 24/7 mode." };
        }

        const guildData = client.data.get(`guildData_${message.guild.id}`);
        guildData.reconnect.status = !guildData.reconnect.status;

        if (guildData.reconnect.status) {
            guildData.reconnect.text = message.channel.id;
            guildData.reconnect.voice = message.member.voice.channelId;
        }

        return { success: true, message: `24/7 mode is now ${guildData.reconnect.status ? 'enabled' : 'disabled'}.` };
    }
};
