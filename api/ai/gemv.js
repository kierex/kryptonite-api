require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');

const meta = {
  name: 'Gemini Vision (Conversational)',
  path: '/gemini-vision?prompt=&uid=&imgUrl=',
  method: 'get',
  category: 'ai'
};

const convoFile = 'convo.json';
const model = "gemini-2.5-flash";

// Load API keys from environment variables
const API_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5
].filter(key => key && key.length > 0); // Remove any undefined/empty keys

// Validate API keys exist
if (API_KEYS.length === 0) {
  console.error('ERROR: No API keys found in environment variables!');
  process.exit(1);
}

console.log(`Loaded ${API_KEYS.length} API keys securely from environment variables`);

// Track failed keys
let failedKeys = new Set();
let currentKeyIndex = 0;
let requestCount = 0;
const REQUEST_LIMIT_PER_KEY = 50; // Rotate keys every 50 requests even if not failed

// Encrypt conversation data (optional security enhancement)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// Secure conversation storage with encryption
function loadConversation(uid) {
  try {
    const convos = JSON.parse(fs.readFileSync(convoFile, 'utf-8'));
    if (convos[uid] && typeof convos[uid] === 'string') {
      // Decrypt if encrypted
      return JSON.parse(decrypt(convos[uid]));
    }
    return convos[uid] || [];
  } catch (error) {
    console.error('Error loading conversation:', error.message);
    return [];
  }
}

function saveConversation(uid, messages) {
  const convos = JSON.parse(fs.readFileSync(convoFile, 'utf-8'));
  // Encrypt sensitive conversation data
  convos[uid] = encrypt(JSON.stringify(messages));
  fs.writeFileSync(convoFile, JSON.stringify(convos, null, 2), 'utf-8');
}

function clearConversation(uid) {
  const convos = JSON.parse(fs.readFileSync(convoFile, 'utf-8'));
  delete convos[uid];
  fs.writeFileSync(convoFile, JSON.stringify(convos, null, 2), 'utf-8');
}

function getNextWorkingKey() {
  // Rotate keys periodically to distribute load
  requestCount++;
  if (requestCount % REQUEST_LIMIT_PER_KEY === 0) {
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    console.log(`Rotating to next API key for load balancing`);
  }
  
  if (failedKeys.size >= API_KEYS.length) {
    console.log('All API keys have failed. Resetting failed keys list...');
    failedKeys.clear();
    currentKeyIndex = 0;
  }
  
  let attempts = 0;
  while (failedKeys.has(API_KEYS[currentKeyIndex]) && attempts < API_KEYS.length) {
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    attempts++;
  }
  
  return API_KEYS[currentKeyIndex];
}

function markKeyAsFailed(apiKey) {
  if (!failedKeys.has(apiKey)) {
    failedKeys.add(apiKey);
    console.log(`API key marked as failed (${failedKeys.size}/${API_KEYS.length} keys failed)`);
  }
}

async function sendRequestWithFailover(payload) {
  let lastError = null;
  const triedKeys = new Set();
  
  while (triedKeys.size < API_KEYS.length) {
    const apiKey = getNextWorkingKey();
    
    if (triedKeys.has(apiKey)) {
      continue;
    }
    
    triedKeys.add(apiKey);
    
    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        payload,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
      
      const successIndex = API_KEYS.indexOf(apiKey);
      if (successIndex > 0) {
        const [successKey] = API_KEYS.splice(successIndex, 1);
        API_KEYS.unshift(successKey);
        currentKeyIndex = 0;
      }
      
      return response;
      
    } catch (error) {
      lastError = error;
      const isQuotaError = error.response?.status === 429 || 
                          error.response?.status === 403 ||
                          error.message?.includes('quota') ||
                          error.message?.includes('rate limit');
      
      const isKeyError = error.response?.status === 400 ||
                        error.response?.status === 401;
      
      if (isQuotaError || isKeyError) {
        markKeyAsFailed(apiKey);
      }
    }
  }
  
  throw lastError || new Error('All API keys failed');
}

async function onStart({ req, res }) {
  const { prompt, uid, imgUrl, img } = req.query;

  // Rate limiting by IP (optional)
  const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  
  // Simple rate limiting (5 requests per minute per IP)
  if (global.rateLimits && global.rateLimits[clientIp] > Date.now() - 60000) {
    const requestCount = global.rateLimits[clientIp] || 0;
    if (requestCount > 5) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please wait before making more requests.'
      });
    }
  }
  
  if (!global.rateLimits) global.rateLimits = {};
  global.rateLimits[clientIp] = (global.rateLimits[clientIp] || 0) + 1;
  setTimeout(() => { delete global.rateLimits[clientIp]; }, 60000);

  if (!prompt || !uid) {
    return res.status(400).json({
      error: 'Both "prompt" and "uid" parameters are required',
      example: '/gemini-vision?prompt=hello&uid=123'
    });
  }

  try {
    if (prompt.toLowerCase() === "clear") {
      clearConversation(uid);
      return res.json({ message: "Conversation history cleared." });
    }

    let conversation = loadConversation(uid);

    let imageData = null;
    if (img) {
      imageData = img;
    } else if (imgUrl) {
      const imageResp = await axios.get(imgUrl, { 
        responseType: 'arraybuffer',
        timeout: 10000
      });
      imageData = Buffer.from(imageResp.data, 'binary').toString('base64');
    }

    const parts = [{ text: prompt }];
    if (imageData) {
      parts.push({
        inline_data: {
          mime_type: 'image/jpeg',
          data: imageData
        }
      });
    }

    conversation.push({ role: 'user', parts });

    const payload = {
      contents: conversation.map(msg => ({
        role: msg.role,
        parts: msg.parts
      }))
    };

    const response = await sendRequestWithFailover(payload);
    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";

    conversation.push({ role: 'model', parts: [{ text }] });
    saveConversation(uid, conversation);

    res.json({
      status: true,
      response: text
    });

  } catch (error) {
    console.error('Gemini Vision Error:', error.message);
    res.status(500).json({
      status: false,
      error: 'Failed to get response from Gemini API. Please try again later.'
    });
  }
}

module.exports = { meta, onStart };