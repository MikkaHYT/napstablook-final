const { EmbedBuilder } = require("discord.js");
const { status, players } = require("minecraft-server-util"); // npm install minecraft-server-util

module.exports = {
    name: "status",
    description: "Check the status of the Minecraft server.",
    category: "minecraft", // Consistent with start.js and stop.js
    permissions: {
        bot: [],
        user: [],
    },
    settings: {
        // No specific settings needed
    },
    devOnly: false,
    run: async (client, interaction) => {
        const embed = new EmbedBuilder().setColor(client.config.embedColor);
        const serverIp = "16.171.107.143";
        const serverPort = 25565; // Default Minecraft port; adjust if needed
        embed.setDescription(`?? Minecraft Server Status: \`${serverIp}:${serverPort}\``);
        try {
            // Check server status
            const result = await status(serverIp, serverPort);
            const onlinePlayers = result.players?.online || 0;
            const maxPlayers = result.players?.max || 0;
            const version = result.version || "Unknown";
            const motd = result.motd?.clean || "No MOTD available";

            embed.addFields(
                { name: "Status", value: "`Online`", inline: true },
                { name: "Version", value: `\`${version}\``, inline: true },
                { name: "Players", value: `\`${onlinePlayers}/${maxPlayers}\``, inline: true },
                { name: "MOTD", value: motd, inline: false }
            );

            // If players online, fetch and list them
            if (onlinePlayers > 0) {
                try {
                    const playerList = await players(serverIp, serverPort);
                    const playerNames = playerList.slice(0, 10).join(', '); // Limit to 10 to avoid embed overflow
                    const playerField = { name: "Online Players", value: playerNames || 'None listed', inline: false };
                    if (playerList.length > 10) {
                        playerField.value += `\n... and ${playerList.length - 10} more`;
                    }
                    embed.addFields(playerField);
                } catch (playerError) {
                    console.error("Error fetching player list:", playerError);
                    embed.addFields({ name: "Online Players", value: "Unable to fetch list.", inline: false });
                }
            } else {
                embed.addFields({ name: "Online Players", value: "No players online.", inline: false });
            }

            embed.setColor("#00FF00"); // Green for online
            embed.setFooter({ text: `Server is running and accessible at ${serverIp}:${serverPort}` });
        } catch (error) {
            console.error("Error checking Minecraft server status:", error);
            let errorMsg = error.message || "Unknown error occurred.";
            if (error.message.includes("timeout") || error.message.includes("ECONNREFUSED")) {
                errorMsg = "Server is offline or unreachable.";
            } else if (error.message.includes("Invalid server")) {
                errorMsg = "Invalid server address or protocol mismatch.";
            }
            embed.addFields({ name: "Status", value: "`Offline`", inline: false });
            embed.addFields({ name: "Error", value: errorMsg, inline: false });
            embed.setColor("#FF0000"); // Red for offline/error
        }
        return interaction.reply({ embeds: [embed], flags: [] });
    },
};
/**
 * Project: Lunox
 * Author: adh319
 * Company: EnourDev
 * This code is the property of EnourDev and may not be reproduced or
 * modified without permission. For more information, contact us at
 * https://discord.gg/xhTVzbS5NU
 */