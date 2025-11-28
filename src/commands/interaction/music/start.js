const { EC2Client, StartInstancesCommand, DescribeInstancesCommand, waitUntilInstanceRunning } = require("@aws-sdk/client-ec2");
const { EmbedBuilder, MessageFlags } = require("discord.js");

module.exports = {
    name: "start",
    description: "Start the Minecraft server (EC2 instance).",
    category: "minecraft",
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

            // Send the start command
            const data = await clientEc2.send(new StartInstancesCommand(params));
            console.log("StartInstances successful:", data);

            // Wait until the instance is running (optional but recommended; ~1-5 min)
            await waitUntilInstanceRunning(
                { client: clientEc2, maxWaitTime: 300 }, // 5 min timeout
                { InstanceIds: [instanceId] }
            );
            console.log("Instance is now running.");

            // Fetch the current public IP
            const describeParams = {
                InstanceIds: [instanceId],
            };
            const describeData = await clientEc2.send(new DescribeInstancesCommand(describeParams));
            const publicIp = describeData.Reservations[0]?.Instances[0]?.PublicIpAddress || "Not available (check if in public subnet)";

            embed.setDescription(`? Started EC2 instance: \`${instanceId}\``);
            embed.addFields(
                { name: "Status", value: "Running", inline: true },
                { name: "Public IP", value: `\`${publicIp}\``, inline: true },
                { name: "Note", value: `Minecraft server is booting (allow 2-5 min). Connect via ${publicIp}`, inline: false }
            );
        } catch (error) {
            console.error("Error starting instance:", error);
            let errorMsg = error.message || "Unknown error occurred.";
            if (error.name === 'CredentialsProviderError') {
                errorMsg = "AWS credentials not found. Check env vars or ~/.aws/config.";
            } else if (error.name === 'InvalidInstanceID.NotFound') {
                errorMsg = "Instance ID not found. Verify 'i-0f5b3b876331e9423' exists.";
            } else if (error.name === 'InvalidInstanceState') {
                errorMsg = "Instance is already running or in an invalid state.";
            } else if (error.name === 'WaiterTimeoutError') {
                errorMsg = "Instance start timed out after 5 min. Check AWS Console.";
            }
            embed.setDescription(`? Failed to start EC2 instance: \`${instanceId}\``);
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