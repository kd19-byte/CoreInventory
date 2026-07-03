import crypto from 'crypto'

export const makeRef = (prefix) => `${prefix}/${String(Date.now()).slice(-6)}${crypto.randomInt(10, 99)}`
