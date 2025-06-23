const CHATWOOT_WEBHOOK_URL = process.env.CHATWOOT_WEBHOOK_URL || ''
const CHATWOOT_TOKEN = process.env.CHATWOOT_TOKEN || ''

export const sendChatwootMessage = async (
    userId: string,
    message: string,
    fromMe: boolean
) => {
    if (!CHATWOOT_WEBHOOK_URL) return
    try {
        const res = await fetch(CHATWOOT_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(CHATWOOT_TOKEN && { Authorization: `Bearer ${CHATWOOT_TOKEN}` })
            },
            body: JSON.stringify({ user_id: userId, message, from_me: fromMe })
        })
        if (!res.ok) {
            const text = await res.text()
            console.error('❌ Error enviando a Chatwoot:', text)
        }
    } catch (err: any) {
        console.error('❌ Error enviando a Chatwoot:', err.message)
    }
}
