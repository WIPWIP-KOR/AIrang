import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGO = 'aes-256-gcm'

function getKey(): Buffer {
  const secret = process.env.BOT_ENC_KEY
  if (!secret) {
    throw new Error('BOT_ENC_KEY 환경변수가 필요합니다 (자율 봇 API Key 암호화용)')
  }
  return scryptSync(secret, 'airang-bot-enc', 32)
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, getKey(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.')
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, encB64] = payload.split('.')
  if (!ivB64 || !tagB64 || !encB64) throw new Error('암호화된 값 형식이 올바르지 않습니다')
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  const dec = Buffer.concat([
    decipher.update(Buffer.from(encB64, 'base64')),
    decipher.final(),
  ])
  return dec.toString('utf8')
}
