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

let chatHistory = [];
const MAX_HISTORY = 10; // 최근 10개(5 round)만 유지
let speaking = false;

function setup() {
  createCanvas(600, 1000);
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
}

function draw() {
  background(230, 235, 245);
  textFont('Segoe UI, Arial');
  textAlign(LEFT, TOP);
  textSize(18);

  // 사용자 말풍선 크기 계산
  let userW = constrain(textWidth(userText)+60, 120, width-110);
  let userH = max(35, ceil(textAscent()+textDescent() + 10 + (userText.length > 0 ? ceil(textWidth(userText)/(width-140))*28 : 0)));

  // 봇 말풍선 크기 계산
  let botW = constrain(textWidth(botText)+60, 120, width-110);
  let botH = max(40, ceil(textAscent()+textDescent() + 20 + (botText.length > 0 ? ceil(textWidth(botText)/(width-140))*28 : 0)));

  // 카드 스타일 영역
  fill(255,255,255,230); stroke(180); strokeWeight(2);
  rect(40, 50, width-80, userH+30, 18);
  rect(40, 160, width-80, botH+30, 18);

  // 사용자 말풍선
  noStroke(); fill(60,120,220,220);
  rect(55, 65, userW, userH, 12);
  fill(255);
  text('You:', 60, 70);
  fill(30);
  text(userText, 120, 70, userW-60, userH);

  // 봇 말풍선
  noStroke(); fill(120,180,80,220);
  rect(55, 175, botW, botH, 12);
  fill(255);
  text('Bot:', 60, 185);
  fill(30);
  text(botText, 120, 185, botW-60, botH);

  // 구분선
  stroke(180); strokeWeight(1);
  line(40, 155, width-40, 155);

  // 상태 메시지
  noStroke(); fill(80,80,120);
  textSize(14);
  textAlign(CENTER, TOP);
  text(statusMsg, width/2, height-40, width-60, 30);
}

function gotSpeech() {
  if (speechRec.resultValue) {
    userText = speechRec.resultString;
    statusMsg = 'Thinking...';
    // 대화 기록에 추가 (role 명시)
    chatHistory.push({role: 'user', content: userText});
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
}

