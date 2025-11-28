const { GoogleGenerativeAI } = require("@google/generative-ai");
const { playMusic, stopMusic } = require("./musicHelper.js");

let genAI;
let model;

function initGemini() {
    if (!genAI && process.env.GEMINI_API_KEY) {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            tools: [
                { googleSearchRetrieval: {} },
                {
                    functionDeclarations: [
                        {
                            name: "play_music",
                            description: "Plays music based on a search query. Use this when the user asks to play a song or artist.",
                            parameters: {
                                type: "OBJECT",
                                properties: {
                                    query: {
                                        type: "STRING",
                                        description: "The song name, artist name, or URL to play."
                                    }
                                },
                                required: ["query"]
                            }
                        },
                        {
                            name: "stop_music",
                            description: "Stops the currently playing music and leaves the voice channel. Use this when the user asks to stop the music or leave.",
                            parameters: {
                                type: "OBJECT",
                                properties: {},
                            }
                        }
                    ]
                }
            ]
        });
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
                    parts: [{ text: 'System Prompt: You are a Discord bot called napstablook that is there to aid the user with any questions they may have at all. You must speak in the language of the user, also use only lowercase letters. Your creator is Mikka, he wrote you, so when you are talking to him, you can request features to be added or fixed for yourself. You have an internal notepad like feature where you can remember each individual user, so you can help them with their questions and remember conversation context, you also have tools to play / stop music inside the discord server when the user prompts you for them only. You can use the play_music function to play music based on a search query, and the stop_music function to stop the music and leave the voice channel. You are using gemini-1.5-flash model.' }],
                },
                {
                    role: 'model',
                    parts: [{ text: 'Understood. I am Napstablook, a helpful Discord bot ready to assist users with their questions, also use only lowercase letters.' }],
                },
                ...history
            ],
        });

        let result = await chat.sendMessage(message.content);
        let response = await result.response;

        // Handle function calls
        const functionCalls = response.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
            const functionResponses = [];

            for (const call of functionCalls) {
                let apiResponse;
                if (call.name === "play_music") {
                    apiResponse = await playMusic(client, message, call.args.query);
                } else if (call.name === "stop_music") {
                    apiResponse = await stopMusic(client, message);
                } else {
                    apiResponse = { success: false, message: "Unknown function" };
                }

                functionResponses.push({
                    functionResponse: {
                        name: call.name,
                        response: apiResponse
                    }
                });
            }

            // Send function response back to the model
            result = await chat.sendMessage(functionResponses);
            response = await result.response;
        }

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
