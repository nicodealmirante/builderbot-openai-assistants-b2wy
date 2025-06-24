import "dotenv/config"
import { createBot, createProvider, createFlow, addKeyword, EVENTS } from '@builderbot/bot'
import { MemoryDB } from '@builderbot/bot'
import { BaileysProvider } from '@builderbot/provider-baileys'
import { toAsk, httpInject } from "@builderbot-plugins/openai-assistants"
import { typing } from "./utils/presence"
import { createConversation, sendMessage, sendAttachmentFromUrl, sendAttachmentFromFile } from './chatwoot'

const PORT = process.env.PORT ?? 3008
const ASSISTANT_ID = process.env.ASSISTANT_ID ?? ''

const userQueues = new Map();
const userLocks = new Map();

const DISABLED_USERS = new Set([
    '54911XXXXXXXX' // ← Reemplazá con tu número
]);

const processUserMessage = async (ctx, { flowDynamic, state, provider }) => {
    let chatwootConversationId = state.get('chatwootConversationId')
    if (!chatwootConversationId) {
        try {
            chatwootConversationId = await createConversation(ctx.from)
            await state.update({ chatwootConversationId })
        } catch (error) {
            console.error('Error creating Chatwoot conversation:', error)
        }
    }

    if (chatwootConversationId) {
        try {
            if (['_event_media_', '_event_document_', '_event_voice_note_'].includes(ctx.body)) {
                const filePath = await provider.saveFile(ctx)
                await sendAttachmentFromFile(chatwootConversationId, filePath, 'incoming')
            } else {
                await sendMessage(chatwootConversationId, ctx.body, 'incoming')
            }
        } catch (err) {
            console.error('Error sending incoming message to Chatwoot:', err)
        }
    }

    await typing(ctx, provider);
    const response = await toAsk(ASSISTANT_ID, ctx.body, state);

    if (response.toUpperCase().includes('LUNA OFF')) {
        DISABLED_USERS.add(ctx.from)
        console.log(`Bot disabled by instruction for ${ctx.from}`)
    }

    const chunks = response.split(/\n\n+/);
    for (const chunk of chunks) {
        const cleanedChunk = chunk.trim().replace(/【.*?】[ ] /g, "");

        const urlRegex = /(https?:\/\/[^\s)]+)/g;
        const markdownRegex = /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g;

        let allUrls = [];

        // extrae urls directas
        const directUrls = cleanedChunk.match(urlRegex) || [];
        allUrls.push(...directUrls);

        // extrae urls de markdown ![]()
        let mdMatch;
        while ((mdMatch = markdownRegex.exec(cleanedChunk)) !== null) {
            allUrls.push(mdMatch[1]);
        }

        // eliminar duplicados
        allUrls = [...new Set(allUrls)];

        const mediaUrls = allUrls.filter(url => /(\.jpg|\.jpeg|\.png|\.gif|\.webp|\.mp4|\.mov|\.avi|\.mkv|\.pdf|\.docx?|\.xlsx?|\.zip|\.rar)$/i.test(url));

        if (mediaUrls.length > 0) {
            for (const url of mediaUrls) {
                await flowDynamic([{ body: '', media: url }]);
                if (chatwootConversationId) {
                    try {
                        await sendAttachmentFromUrl(chatwootConversationId, url, 'outgoing')
                    } catch (err) {
                        console.error('Error sending media to Chatwoot:', err)
                    }
                }
            }
        }

        // enviar el texto sin los markdown y links
        const cleanedText = cleanedChunk
            .replace(markdownRegex, '')
            .replace(urlRegex, '')
            .trim();

        if (cleanedText !== '') {
            await flowDynamic([{ body: cleanedText }]);
            if (chatwootConversationId) {
                try {
                    await sendMessage(chatwootConversationId, cleanedText, 'outgoing')
                } catch (err) {
                    console.error('Error sending response to Chatwoot:', err)
                }
            }
        }
    }
};

const handleQueue = async (userId) => {
    const queue = userQueues.get(userId);
    if (userLocks.get(userId)) return;

    while (queue.length > 0) {
        userLocks.set(userId, true);
        const { ctx, flowDynamic, state, provider } = queue.shift();
        try {
            await processUserMessage(ctx, { flowDynamic, state, provider });
        } catch (error) {
            console.error(`Error processing message for user ${userId}:`, error);
        } finally {
            userLocks.set(userId, false);
        }
    }

    userLocks.delete(userId);
    userQueues.delete(userId);
};

const welcomeFlow = addKeyword(EVENTS.WELCOME)
    .addAction(async (ctx, { flowDynamic, state, provider }) => {
        const userId = ctx.from;

        if (DISABLED_USERS.has(userId)) {
            console.log(`⛔ Bot desactivado para ${userId}`);
            return;
        }

        if (userId === '54911XXXXXXXX') {
            DISABLED_USERS.add(userId);
            console.log(`🔥 El TURRO REY apagó el bot para ${userId}`);
            return;
        }

        if (!userQueues.has(userId)) {
            userQueues.set(userId, []);
        }

        const queue = userQueues.get(userId);
        queue.push({ ctx, flowDynamic, state, provider });

        if (!userLocks.get(userId) && queue.length === 1) {
            await handleQueue(userId);
        }
    });

const main = async () => {
    const adapterFlow = createFlow([welcomeFlow]);

    const adapterProvider = createProvider(BaileysProvider, {
        groupsIgnore: true,
        readStatus: false,
    });

    const adapterDB = new MemoryDB();

    const { httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    });

    httpInject(adapterProvider.server);
    httpServer(+PORT);
};

main();
