const { GoogleGenerativeAI } = require("@google/generative-ai");

let genAI;
let model;

function initGemini() {
    if (!genAI && process.env.GEMINI_API_KEY) {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    }
}

async function getHistory(client, userId) {
    const history = await client.chatHistory.find({ userId }).sort({ timestamp: 1 }).limit(20);
    return history.map(h => ({
        role: h.role,
        parts: [{ text: h.content }],
    }));
}

async function addMessage(client, userId, role, content) {
    await client.chatHistory.create({
        userId,
        role,
        content,
    });
}

module.exports = async (client, message) => {
    if (message.author.bot) return false;
    if (message.channel.name !== 'napstablook') return false;

    initGemini();

    if (!model) {
        console.error("Gemini API Key not found or model not initialized.");
        return false;
    }

    try {
        const history = await getHistory(client, message.author.id);
        const chat = model.startChat({
            history: [
                {
                    role: 'user',
                    parts: [{ text: 'System Prompt: You are a Discord bot called napstablook that is there to aid the user with any questions they may have at all. You must speak in the language of the user, also use only lowercase letters. Your creator is Mikka, he wrote you, so when you are talking to him, you can request features to be added or fixed for yourself.' }],
                },
                {
                    role: 'model',
                    parts: [{ text: 'Understood. I am Napstablook, a helpful Discord bot ready to assist users with their questions, also use only lowercase letters.' }],
                },
                ...history
            ],
        });

        const result = await chat.sendMessage(message.content);
        const response = await result.response;
        const text = response.text();

        await addMessage(client, message.author.id, 'user', message.content);
        await addMessage(client, message.author.id, 'model', text);

        await message.reply(text);
        return true;
    } catch (error) {
        console.error('Error interacting with Gemini API:', error);
        await message.reply('Oh no... something went wrong... sorry...');
        return true; // Handled, even if error
    }
};
