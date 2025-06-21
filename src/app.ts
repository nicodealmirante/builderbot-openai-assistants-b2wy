import "dotenv/config"
import { createBot, createProvider, createFlow, addKeyword, EVENTS } from '@builderbot/bot'
import { MemoryDB } from '@builderbot/bot'
import { BaileysProvider } from '@builderbot/provider-baileys'
import { toAsk, httpInject } from "@builderbot-plugins/openai-assistants"
import { typing } from "./utils/presence"

const PORT = process.env.PORT ?? 3008
const ASSISTANT_ID = process.env.ASSISTANT_ID ?? ''

const userQueues = new Map();
const userLocks = new Map();

const DISABLED_USERS = new Set([
    '54911XXXXXXXX' // ← Reemplazá con tu número
]);

// Obtener JID válido
const jid = ctx.key?.remoteJid || ctx.from;

// Enviar imágenes
for (const url of imageUrls) {
    try {
        await provider.sendMedia(jid, url, { caption: 'Selfie Mirror' });
    } catch (err) {
        console.error('❌ Error enviando imagen:', err.message);
    }
}

// Enviar videos
for (const url of videoUrls) {
    try {
        await provider.sendMedia(jid, url, { caption: 'Selfie Mirror' });
    } catch (err) {
        console.error('❌ Error enviando video:', err.message);
    }
}

// Enviar stickers
for (const url of stickerUrls) {
    try {
        await provider.sendMedia(jid, url, { isSticker: true });
    } catch (err) {
        console.error('❌ Error enviando sticker:', err.message);
    }
}

// Enviar documentos
for (const url of docUrls) {
    try {
        await provider.sendMedia(jid, url, {
            mimetype: 'application/octet-stream',
            caption: 'Selfie Mirror',
        });
    } catch (err) {
        console.error('❌ Error enviando documento:', err.message);
    }
}


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
