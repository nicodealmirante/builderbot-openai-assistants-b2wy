import "dotenv/config"
import { createBot, createProvider, createFlow, addKeyword, EVENTS } from '@builderbot/bot'
import { MemoryDB } from '@builderbot/bot'
import { BaileysProvider } from '@builderbot/provider-baileys'
import { toAsk, httpInject } from "@builderbot-plugins/openai-assistants"
import { typing } from "./utils/presence"
import axios from 'axios'

const PORT = process.env.PORT ?? 3008
const ASSISTANT_ID = process.env.ASSISTANT_ID ?? ''
const CHATWOOT_URL = process.env.CHATWOOT_URL ?? ''
const CHATWOOT_TOKEN = process.env.CHATWOOT_TOKEN ?? ''
const CHATWOOT_INBOX_ID = process.env.CHATWOOT_INBOX_ID ?? ''

const userQueues = new Map();
const userLocks = new Map();

const DISABLED_USERS = new Set([
    '54911XXXXXXXX' // ← Reemplazá con tu número
]);

const sendToChatwoot = async (userId, message) => {
    try {
        await axios.post(`${CHATWOOT_URL}/api/v1/inboxes/${CHATWOOT_INBOX_ID}/contacts/whatsapp/messages`, {
            contact_identifier: userId,
            content: message,
        }, {
            headers: {
                api_access_token: CHATWOOT_TOKEN,
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error enviando a Chatwoot:', error.message);
    }
};

const processUserMessage = async (ctx, { flowDynamic, state, provider }) => {
    await typing(ctx, provider);
    const response = await toAsk(ASSISTANT_ID, ctx.body, state);

    const chunks = response.split(/\n\n+/);
    for (const chunk of chunks) {
        const cleanedChunk = chunk.trim().replace(/【.*?】[ ] /g, "");

        const urlRegex = /(https?:\/\/[^\s)]+)/g;
        const markdownRegex = /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g;

        let allUrls = [];

        const directUrls = cleanedChunk.match(urlRegex) || [];
        allUrls.push(...directUrls);

        let mdMatch;
        while ((mdMatch = markdownRegex.exec(cleanedChunk)) !== null) {
            allUrls.push(mdMatch[1]);
        }

        allUrls = [...new Set(allUrls)];

        const mediaUrls = allUrls.filter(url => /(\.jpg|\.jpeg|\.png|\.gif|\.webp|\.mp4|\.mov|\.avi|\.mkv|\.pdf|\.docx?|\.xlsx?|\.zip|\.rar)$/i.test(url));

        if (mediaUrls.length > 0) {
            for (const url of mediaUrls) {
                await flowDynamic([{ body: '', media: url }]);
            }
        }

        const cleanedText = cleanedChunk
            .replace(markdownRegex, '')
            .replace(urlRegex, '')
            .trim();

        if (cleanedText !== '') {
            await flowDynamic([{ body: cleanedText }]);
            await sendToChatwoot(ctx.from, cleanedText);
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
