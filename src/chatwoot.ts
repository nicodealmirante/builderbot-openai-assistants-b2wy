import fetch from 'node-fetch'

interface ChatwootConfig {
  apiUrl: string
  accountId: string
  accessToken: string
  inboxId: string
}

const chatwootConfig: ChatwootConfig = {
  apiUrl: process.env.CHATWOOT_URL || '',
  accountId: process.env.CHATWOOT_ACCOUNT_ID || '',
  accessToken: process.env.CHATWOOT_ACCESS_TOKEN || '',
  inboxId: process.env.CHATWOOT_INBOX_ID || ''
}

export const createConversation = async (sourceId: string) => {
  const response = await fetch(
    `${chatwootConfig.apiUrl}/api/v1/accounts/${chatwootConfig.accountId}/conversations`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        api_access_token: chatwootConfig.accessToken
      },
      body: JSON.stringify({
        inbox_id: chatwootConfig.inboxId,
        source_id: sourceId
      })
    }
  )

  if (!response.ok) {
    throw new Error(`Chatwoot conversation error: ${response.status}`)
  }

  const data = (await response.json()) as any
  return data.id as string
}

export const sendMessage = async (
  conversationId: string,
  content: string,
  messageType: 'incoming' | 'outgoing'
) => {
  const response = await fetch(
    `${chatwootConfig.apiUrl}/api/v1/accounts/${chatwootConfig.accountId}/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        api_access_token: chatwootConfig.accessToken
      },
      body: JSON.stringify({ content, message_type: messageType })
    }
  )

  if (!response.ok) {
    throw new Error(`Chatwoot send error: ${response.status}`)
  }
}
