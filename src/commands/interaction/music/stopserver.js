const { EC2Client, StopInstancesCommand } = require("@aws-sdk/client-ec2");
const { EmbedBuilder, MessageFlags } = require("discord.js");

module.exports = {
    name: "stopserver",
    description: "Stop the Minecraft server (EC2 instance).",
    category: "minecraft", // Consistent with start.js
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
        const instanceId = "i-0f5b3b876331e9423"; // Your specified EC2 instance ID

        // Initialize EC2 client (assumes AWS credentials are configured via env vars or IAM role)
        const clientEc2 = new EC2Client({ region: "eu-north-1" }); // Adjust region if needed

        try {
            const params = {
                InstanceIds: [instanceId],
            };

            // Send the stop command
            const data = await clientEc2.send(new StopInstancesCommand(params));
            console.log("StopInstances successful:", data);

            embed.setDescription(`? Stopped Server: \`${instanceId}\``);
            embed.addFields(
                { name: "Status", value: "Stopping...", inline: true },
                { name: "Note", value: "The Minecraft server will shut down. It may take a few minutes to fully stop.", inline: false }
            );
        } catch (error) {
            console.error("Error stopping instance:", error);
            let errorMsg = error.message || "Unknown error occurred.";
            if (error.name === 'CredentialsProviderError') {
                errorMsg = "AWS credentials not found. Check env vars or ~/.aws/config.";
            } else if (error.name === 'InvalidInstanceID.NotFound') {
                errorMsg = "Instance ID not found. Verify 'i-0f5b3b876331e9423' exists.";
            } else if (error.name === 'IncorrectInstanceState') {
                errorMsg = "Instance is not in a stoppable state (e.g., already stopped).";
            }
            embed.setDescription(`? Failed to stop EC2 instance: \`${instanceId}\``);
            embed.addFields({ name: "Error", value: errorMsg, inline: false });
            embed.setColor("#FF0000"); // Red for error
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