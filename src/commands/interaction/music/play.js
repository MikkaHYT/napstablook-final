const { EmbedBuilder, MessageFlags } = require("discord.js");
const { convertTime } = require("../../../functions/timeFormat.js");

module.exports = {
    name: "play",
    description: "Play a song",
    category: "music",
    options: [
        {
            name: "query",
            description: "Provide a song name or url",
            type: 3,
            required: true,
        },
    ],
    permissions: {
        bot: ["Speak", "Connect"],
        user: ["Speak", "Connect"],
    },
    settings: {
        voice: true,
        player: false,
        current: false,
    },
    devOnly: false,
    run: async (client, interaction, player) => {
        const embed = new EmbedBuilder().setColor(client.config.embedColor);
        
        // Check voice channel match
        if (player && player.voiceId !== interaction.member.voice.channelId) {
            embed.setDescription(`You must be in the same voice channel as the bot.`);
            return interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
        }

        const query = interaction.options.getString("query");

        // DEFER REPLY IMMEDIATELY: Fixes 10062 timeout during search/load
        await interaction.deferReply();

        try {
            // Search/load track(s)
            const result = await client.rainlink.search(query, { requester: interaction.member, sourceID: client.config.lavalinkSource });
            
            if (result.type === "EMPTY" || result.type === "ERROR" || !result.tracks.length) {
                embed.setDescription(`No results found for your query: \`${query}\`.`);
                return interaction.editReply({ embeds: [embed] });
            }

            // Create player if needed
            if (!player) {
                player = await client.rainlink.create({
                    guildId: interaction.guildId,
                    textId: interaction.channelId,
                    voiceId: interaction.member.voice.channelId,
                    shardId: interaction.guild.shardId,
                    volume: client.config.defaultVolume || 100,  // Ensure full volume for testing
                    deaf: true,
                });
            }

            // Handle playlist or single track
            if (result.type === "PLAYLIST") {
                for (const track of result.tracks) player.queue.add(track);
                embed.setDescription(`Added **[${result.playlistName}](${query})** - \`${result.tracks.length}\` songs to the queue.`);
            } else {
                const track = result.tracks[0];
                const trackTitle = formatString(track.title, 30).replace(/ - Topic$/, "") || "Unknown";
                const trackAuthor = formatString(track.author, 25).replace(/ - Topic$/, "") || "Unknown";
                player.queue.add(track);
                embed.setDescription(`Added **[${trackTitle} - ${trackAuthor}](${track.uri})** - \`${convertTime(track.duration)}\`.`);
            }

            // Reply with embed (edits deferred)
            await interaction.editReply({ embeds: [embed] });

            // Start playing if not already
            if (!player.playing) {
                await player.play();
                console.log(`[DEBUG] Started playing: ${result.tracks[0]?.title || 'Playlist'} in guild ${interaction.guildId}`);
            }

        } catch (error) {
            console.error('[Play Command Error]:', error);
            embed.setDescription(`Error playing track: \`${error.message}\`. Try a different query.`);
            await interaction.editReply({ embeds: [embed] });
        }
    },
};

function formatString(str, maxLength) {
    return str.length > maxLength ? str.substr(0, maxLength - 3) + "..." : str;
}

/**
 * Project: Lunox
 * Author: adh319
 * Company: EnourDev
 * This code is the property of EnourDev and may not be reproduced or
 * modified without permission. For more information, contact us at
 * https://discord.gg/xhTVzbS5NU
 */