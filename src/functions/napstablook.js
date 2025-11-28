const { GoogleGenAI, Type } = require("@google/genai");
const { playMusic, stopMusic } = require("./musicHelper.js");

let ai;

function initGemini() {
    if (!ai && process.env.GEMINI_API_KEY) {
        ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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

    if (!ai) {
        console.error("Gemini API Key not found or AI not initialized.");
        return false;
    }

    try {
        const history = await getHistory(client, message.author.id);

        const systemPrompt = {
            role: 'user',
            parts: [{ text: 'System Prompt: You are a Discord bot called napstablook that is there to aid the user with any questions they may have at all. You must speak in the language of the user, also use only lowercase letters. Your creator is Mikka, he wrote you, so when you are talking to him, you can request features to be added or fixed for yourself. You have an internal notepad like feature where you can remember each individual user, so you can help them with their questions and remember conversation context, you also have tools to play / stop music inside the discord server when the user prompts you for them only. You can use the play_music function to play music based on a search query, and the stop_music function to stop the music and leave the voice channel. You are using gemini-2.5-flash model.' }]
        };

        const modelResponse = {
            role: 'model',
            parts: [{ text: 'Understood. I am Napstablook, a helpful Discord bot ready to assist users with their questions, also use only lowercase letters.' }]
        };

        const contents = [systemPrompt, modelResponse, ...history, { role: 'user', parts: [{ text: message.content }] }];

        const tools = [
            {
                functionDeclarations: [
                    {
                        name: "play_music",
                        description: "Plays music based on a search query. Use this when the user asks to play a song or artist.",
                        parameters: {
                            type: Type.OBJECT,
                            properties: {
                                query: {
                                    type: Type.STRING,
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
                            type: Type.OBJECT,
                            properties: {},
                        }
                    }
                ]
            }
        ];

        let response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: {
                tools: tools,
            }
        });

        // Handle function calls
        // The new SDK response structure might be different.
        // Based on doc: response.functionCalls is an array of calls.

        if (response.functionCalls && response.functionCalls.length > 0) {
            const functionResponses = [];

            // Append the model's function call message to history
            // We need to reconstruct the model's turn that requested the function
            // The SDK might handle this differently, but for manual turn-taking:
            // We need to send the function call result back.

            // Actually, for multi-turn with generateContent, we need to append the intermediate steps.
            // But since we are stateless here (re-sending full history), we just need to handle the current turn.
            // 1. Model calls function.
            // 2. We execute function.
            // 3. We send history + model_call + function_response to get final text.

            // Construct the model's part with function calls
            const modelCallParts = response.functionCalls.map(call => ({
                functionCall: {
                    name: call.name,
                    args: call.args
                }
            }));

            contents.push({ role: 'model', parts: modelCallParts });

            for (const call of response.functionCalls) {
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

            // Append function responses to contents
            contents.push({ role: 'user', parts: functionResponses });

            // Call model again with updated contents
            response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: contents,
                config: { tools: tools }
            });
        }

        const text = response.text;

        await addMessage(client, message.author.id, 'user', message.content);
        await addMessage(client, message.author.id, 'model', text);

        await message.reply(text);
        return true;
    } catch (error) {
        console.error('Error interacting with Gemini API:', error);
        await message.reply('Oh no... something went wrong... sorry...');
        return true;
    }
};
