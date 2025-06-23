import fetch from 'node-fetch'
import FormData from 'form-data'
import fs from 'fs'
import mime from 'mime-types'

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

export const sendAttachmentFromFile = async (
  conversationId: string,
  filePath: string,
  messageType: 'incoming' | 'outgoing',
  content?: string
) => {
  const form = new FormData()
  form.append('message_type', messageType)
  if (content) form.append('content', content)
  form.append('attachments[]', fs.createReadStream(filePath))

  const response = await fetch(
    `${chatwootConfig.apiUrl}/api/v1/accounts/${chatwootConfig.accountId}/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      headers: {
        api_access_token: chatwootConfig.accessToken,
        ...form.getHeaders()
      },
      body: form as any
    }
  )

  if (!response.ok) {
    throw new Error(`Chatwoot send error: ${response.status}`)
  }
}

export const sendAttachmentFromUrl = async (
  conversationId: string,
  url: string,
  messageType: 'incoming' | 'outgoing',
  content?: string
) => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to download media: ${res.status}`)
  }
  const buffer = await res.buffer()
  const contentType = res.headers.get('content-type') || 'application/octet-stream'
  const ext = mime.extension(contentType) || 'bin'

  const form = new FormData()
  form.append('message_type', messageType)
  if (content) form.append('content', content)
  form.append('attachments[]', buffer, { filename: `file.${ext}` })

  const response = await fetch(
    `${chatwootConfig.apiUrl}/api/v1/accounts/${chatwootConfig.accountId}/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      headers: {
        api_access_token: chatwootConfig.accessToken,
        ...form.getHeaders()
      },
      body: form as any
    }
  )

  if (!response.ok) {
    throw new Error(`Chatwoot send error: ${response.status}`)
  }
}
