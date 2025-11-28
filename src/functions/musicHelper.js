const { EmbedBuilder } = require("discord.js");
const { convertTime } = require("./timeFormat.js");

function formatString(str, maxLength) {
    return str.length > maxLength ? str.substr(0, maxLength - 3) + "..." : str;
}

module.exports = {
    playMusic: async (client, message, query) => {
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
            return { success: false, message: "You must be in the same voice channel as me to stop the music." };
        }

        player.destroy();
        return { success: true, message: "Stopped the music and left the voice channel." };
    }
};
