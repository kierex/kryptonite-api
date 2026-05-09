const axios = require('axios');
const fs = require('fs');

const meta = {
  name: 'Gemini Vision (Conversational)',
  path: '/gemini-vision?prompt=&uid=&imgUrl=&apikey=',
  method: 'get',
  category: 'ai'
};

const convoFile = 'convo.json';
const model = "gemini-2.5-flash";
const API_KEY = "AIzaSyDBzoZrHXD5XNClMfXTaZEmA0LYCgy54nY"; // Inserted API key

// Ensure conversation file exists
if (!fs.existsSync(convoFile)) {
  fs.writeFileSync(convoFile, JSON.stringify({}), 'utf-8');
}

function loadConversation(uid) {
  const convos = JSON.parse(fs.readFileSync(convoFile, 'utf-8'));
  return convos[uid] || [];
}

function saveConversation(uid, messages) {
  const convos = JSON.parse(fs.readFileSync(convoFile, 'utf-8'));
  convos[uid] = messages;
  fs.writeFileSync(convoFile, JSON.stringify(convos, null, 2), 'utf-8');
}

function clearConversation(uid) {
  const convos = JSON.parse(fs.readFileSync(convoFile, 'utf-8'));
  delete convos[uid];
  fs.writeFileSync(convoFile, JSON.stringify(convos, null, 2), 'utf-8');
}

async function onStart({ req, res }) {
  const { prompt, uid, imgUrl, img, apikey } = req.query;

  if (!prompt || !uid) {
    return res.status(400).json({
      error: 'Both "prompt" and "uid" parameters are required',
      example: '/gemini-vision?prompt=hello&uid=123&apikey=YOUR_KEY'
    });
  }

  // Use the hardcoded API key instead of requiring it from query params
  const effectiveApiKey = API_KEY;

  try {
    // Handle "clear" command
    if (prompt.toLowerCase() === "clear") {
      clearConversation(uid);
      return res.json({ message: "Conversation history cleared." });
    }

    // Load existing memory
    let conversation = loadConversation(uid);

    // Prepare image data if available
    let imageData = null;
    if (img) {
      imageData = img;
    } else if (imgUrl) {
      const imageResp = await axios.get(imgUrl, { responseType: 'arraybuffer' });
      imageData = Buffer.from(imageResp.data, 'binary').toString('base64');
    }

    // Build user message
    const parts = [{ text: prompt }];
    if (imageData) {
      parts.push({
        inline_data: {
          mime_type: 'image/jpeg',
          data: imageData
        }
      });
    }

    // Add user message to memory
    conversation.push({ role: 'user', parts });

    // Construct payload for Gemini API
    const payload = {
      contents: conversation.map(msg => ({
        role: msg.role,
        parts: msg.parts
      }))
    };

    // Send request to Gemini API using hardcoded API key
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${effectiveApiKey}`,
      payload,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Content-Type': 'application/json'
        }
      }
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "404.";

    // Save AI response into memory
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
      error: 'Failed to get response from Gemini Vision API'
    });
  }
}

module.exports = { meta, onStart };