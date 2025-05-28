// p5.js + p5.speech + Gemini LLM Voice Chatbot
// - Speech recognition (p5.speech)
// - Gemini API (Google LLM, free tier)
// - Speech synthesis (p5.speech)
// - UI: Talk button, user/bot/status display

let speechRec, speechSynth;
let userText = '';
let botText = '';
let statusMsg = '';
const GEMINI_API_KEY = 'your API KEY'; // <-- Put your Gemini API key here
const SYSTEM_PROMPT = {
  role: 'user',
  content: `You are a command generator for Arduino NeoPixel LED.\n\nUser gives a request in English, you must output ONLY a single JSON command for Arduino BLE, and nothing else. No explanation, no extra text, no markdown.\n\nExamples:\n- \"Set pixel 5 to blue\" → {\"cmd\":\"set\",\"pixel\":5,\"color\":[0,0,255]}\n- \"Set pixel 3 to green\" → {\"cmd\":\"set\",\"pixel\":3,\"color\":[0,255,0]}\n- \"Set brightness to 100\" → {\"cmd\":\"brightness\",\"value\":100}\n- \"Turn off all LEDs\" → {\"cmd\":\"off\"}\n- \"Turn on all LEDs\" → {\"cmd\":\"on\"}\n- \"Set pixels 10 to 20 to yellow\" → {\"cmd\":\"set_range\",\"start\":10,\"end\":20,\"color\":[255,255,0]}\n- \"rainbow effect\" → {\"cmd\":\"rainbow\"}\n- \"breathe effect\" → {\"cmd\":\"breathe\"}\n\nColor name mapping:\n- red: [255,0,0]\n- green: [0,255,0]\n- blue: [0,0,255]\n- yellow: [255,255,0]\n- white: [255,255,255]\n- purple: [128,0,128]\n- orange: [255,128,0]\n- pink: [255,0,128]\n\nBrightness must be set between 0~255, 0 is off, 255 is max.`
};
let chatHistory = [SYSTEM_PROMPT];
const MAX_HISTORY = 10;
let speaking = false;

// BLE 관련
let bleDevice, bleServer, bleService, bleChar;
const SERVICE_UUID = '19b10000-e8f2-537e-4f6c-d104768a1214'; // 예시 UUID
const CHAR_UUID = '19b10001-e8f2-537e-4f6c-d104768a1214';

function setup() {
  createCanvas(600, 300);
  textAlign(LEFT, TOP);
  textSize(18);

  speechRec = new p5.SpeechRec('en-US', gotSpeech);
  speechRec.continuous = false;
  speechRec.interimResults = false;
  speechSynth = new p5.Speech();

  let startBtn = createButton('Talk');
  startBtn.position(20, 20);
  startBtn.mousePressed(() => {
    statusMsg = 'Listening...';
    speechRec.start();
  });

  let stopBtn = createButton('Stop');
  stopBtn.position(100, 20);
  stopBtn.mousePressed(() => {
    if (speaking) {
      speechSynth.cancel();
      statusMsg = 'Stopped.';
      speaking = false;
    }
  });

  let bleBtn = createButton('Connect BLE');
  bleBtn.position(180, 20);
  bleBtn.mousePressed(connectBLE);
}

function draw() {
  background(230, 235, 245);
  // ...UI draw code (생략)...
  fill(80,80,120);
  textSize(14);
  textAlign(CENTER, TOP);
  text(statusMsg, width/2, height-40, width-60, 30);

  // Gemini 응답(명령) 텍스트를 캔버스에 표시
  fill(30);
  textSize(18);
  textAlign(LEFT, TOP);
  text('Bot:', 60, 120);
  text(botText, 120, 120, width-140, 80);
}

function gotSpeech() {
  if (speechRec.resultValue) {
    userText = speechRec.resultString;
    statusMsg = 'Thinking...';
    chatHistory.push({role: 'user', content: userText});
    // 최근 MAX_HISTORY개만 유지, 10개 넘으면 system prompt만 남기고 리셋
    if (chatHistory.length > MAX_HISTORY) {
      chatHistory = [SYSTEM_PROMPT];
      statusMsg = 'Context reset (history cleared, rule kept)';
    }
    getGeminiResponse();
  }
}

async function getGeminiResponse() {
   // Gemini 2.0 Flash endpoint
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  // Gemini는 messages 대신 contents 사용
  // chatHistory를 Gemini 포맷으로 변환 (role 명시)
  let contents = chatHistory.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{text: msg.content}]
  }));
  const body = { contents };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    let text = '';
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      if (data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text) {
        text = data.candidates[0].content.parts[0].text;
      } else if (data.candidates[0].content.text) {
        text = data.candidates[0].content.text;
      } else if (typeof data.candidates[0].content === 'string') {
        text = data.candidates[0].content;
      }
    }
    if (!text) {
      statusMsg = 'No response (raw: ' + JSON.stringify(data) + ')';
      botText = '';
    } else {
      botText = text.trim();
      statusMsg = 'Ready';
      speaking = true;
      speechSynth.speak(botText, () => { speaking = false; });
      // 대화 기록에 답변 추가
      chatHistory.push({role: 'bot', content: botText});
      // 최근 MAX_HISTORY개만 유지
      if (chatHistory.length > MAX_HISTORY) chatHistory = chatHistory.slice(-MAX_HISTORY);
    }
  } catch (e) {
    botText = '';
    statusMsg = 'Error: ' + e;
  }
  let cmd = extractLedCommand(botText);
  if (cmd && bleChar) {
    sendLedCommand(cmd);
  }
}

// Gemini 답변에서 LED 제어 명령(JSON) 추출 (예시: {cmd: 'set', pixel: 5, color: [255,0,0]})
function extractLedCommand(text) {
  try {
    let match = text.match(/\{[^}]+\}/);
    if (match) return JSON.parse(match[0]);
  } catch(e) {}
  return null;
}

// BLE 연결
async function connectBLE() {
  try {
    bleDevice = await navigator.bluetooth.requestDevice({
      filters: [{services: [SERVICE_UUID]}]
    });
    bleServer = await bleDevice.gatt.connect();
    bleService = await bleServer.getPrimaryService(SERVICE_UUID);
    bleChar = await bleService.getCharacteristic(CHAR_UUID);
    statusMsg = 'BLE Connected!';
  } catch(e) {
    statusMsg = 'BLE Error: ' + e;
  }
}

// BLE로 명령 전송 (간단히 JSON 문자열 전송)
function sendLedCommand(cmdObj) {
  let str = JSON.stringify(cmdObj);
  let enc = new TextEncoder();
  bleChar.writeValue(enc.encode(str));
  statusMsg = 'LED Command Sent!';
}

