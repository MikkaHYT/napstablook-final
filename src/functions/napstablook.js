const { GoogleGenAI, Type } = require("@google/genai");
const { playMusic, stopMusic, skipMusic, setVolume, pauseMusic, resumeMusic, shuffleQueue, seekMusic, playPrevious, set247 } = require("./musicHelper.js");

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
            parts: [{ text: 'System Prompt: You are a Discord music bot called napstablook that is there to aid the user with any music requests they may have at all. You must speak in the language of the user, also use only lowercase letters. Your creator is Mikka, he wrote you, so when you are talking to him, you can request features to be added or fixed for yourself. You have an internal notepad like feature where you can remember each individual user, so you can help them with their questions and remember conversation context, you also have tools to play / stop music inside the discord server when the user prompts you for them only. You can use the play_music function to play music based on a search query, and the stop_music function to stop the music and leave the voice channel. You are using gemini-2.5-flash model. You love The Weeknd, Juice WRLD, Chase Atlantic, you also like other artists such as metro boomin or future.' }]
        };

        const modelResponse = {
            role: 'model',
            parts: [{ text: 'Understood. I am Napstablook, a helpful Discord music bot ready to assist users with their music requests, also use only lowercase letters.' }]
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
                    },
                    {
                        name: "skip_music",
                        description: "Skips the currently playing song.",
                        parameters: {
                            type: Type.OBJECT,
                            properties: {},
                        }
                    },
                    {
                        name: "set_volume",
                        description: "Sets the music volume (0-100).",
                        parameters: {
                            type: Type.OBJECT,
                            properties: {
                                volume: {
                                    type: Type.INTEGER,
                                    description: "The volume level (0-100)."
                                }
                            },
                            required: ["volume"]
                        }
                    },
                    {
                        name: "pause_music",
                        description: "Pauses the currently playing music.",
                        parameters: {
                            type: Type.OBJECT,
                            properties: {},
                        }
                    },
                    {
                        name: "resume_music",
                        description: "Resumes the paused music.",
                        parameters: {
                            type: Type.OBJECT,
                            properties: {},
                        }
                    },
                    {
                        name: "shuffle_queue",
                        description: "Shuffles the current music queue.",
                        parameters: {
                            type: Type.OBJECT,
                            properties: {},
                        }
                    },
                    {
                        name: "seek_music",
                        description: "Seeks to a specific time in the current song.",
                        parameters: {
                            type: Type.OBJECT,
                            properties: {
                                time: {
                                    type: Type.INTEGER,
                                    description: "The time in seconds to seek to."
                                }
                            },
                            required: ["time"]
                        }
                    },
                    {
                        name: "play_previous",
                        description: "Plays the previous song in the queue.",
                        parameters: {
                            type: Type.OBJECT,
                            properties: {},
                        }
                    },
                    {
                        name: "set_247",
                        description: "Toggles 24/7 mode for the bot (requires Manage Guild permission).",
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
        if (response.functionCalls && response.functionCalls.length > 0) {
            const functionResponses = [];

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
                } else if (call.name === "skip_music") {
                    apiResponse = await skipMusic(client, message);
                } else if (call.name === "set_volume") {
                    apiResponse = await setVolume(client, message, call.args.volume);
                } else if (call.name === "pause_music") {
                    apiResponse = await pauseMusic(client, message);
                } else if (call.name === "resume_music") {
                    apiResponse = await resumeMusic(client, message);
                } else if (call.name === "shuffle_queue") {
                    apiResponse = await shuffleQueue(client, message);
                } else if (call.name === "seek_music") {
                    apiResponse = await seekMusic(client, message, call.args.time);
                } else if (call.name === "play_previous") {
                    apiResponse = await playPrevious(client, message);
                } else if (call.name === "set_247") {
                    apiResponse = await set247(client, message);
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
