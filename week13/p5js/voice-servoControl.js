// p5.js + p5.speech + BLE Servo Controller
// - Recognizes "open the door" and "close the door" via speech
// - Sends servo angle (180 or 90) to Arduino via BLE (128bit UUID)

let bleServiceUUID = '12345678-1234-5678-1234-56789abcdef0'; // Example 128-bit Service UUID
let bleCharUUID = 'abcdef01-1234-5678-1234-56789abcdef0'; // Example 128-bit Characteristic UUID
let device, characteristic;

let speechRec;
let lastCommand = '';
let statusMsg = '';

function setup() {
  createCanvas(1000, 700);
  textAlign(CENTER, CENTER);
  textSize(20);

  let connectBtn = createButton('Connect BLE');
  connectBtn.position(20, 20);
  connectBtn.mousePressed(connectBLE);

  // p5.speech setup
  speechRec = new p5.SpeechRec('en-US', gotSpeech);
  speechRec.continuous = true;
  speechRec.interimResults = false;
  speechRec.start();
}

function draw() {
  background(240);
  text('Voice Servo Controller', width/2, 30);
  text('Say: "open the door" or "close the door"', width/2, 70);
  text('Last command: ' + lastCommand, width/2, 120);
  text('Status: ' + statusMsg, width/2, 160);
}

function gotSpeech() {
  if (speechRec.resultValue) {
    let input = speechRec.resultString.toLowerCase();
    lastCommand = speechRec.resultString; // 인식된 문장 전체 표시
    // 'open'과 'door'가 모두 포함되면 열기
    if (input.includes('open') && input.includes('door')) {
      sendServoAngle(180);
    } else if (input.includes('close') && input.includes('door')) {
      sendServoAngle(90);
    }
  }
}

async function connectBLE() {
  try {
    device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [bleServiceUUID] }]
    });
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(bleServiceUUID);
    characteristic = await service.getCharacteristic(bleCharUUID);
    statusMsg = 'BLE Connected!';
  } catch (e) {
    statusMsg = 'BLE Connection failed: ' + e;
  }
}

function sendServoAngle(angle) {
  if (!characteristic) {
    statusMsg = 'Not connected!';
    return;
  }
  let data = new Uint8Array([angle]);
  characteristic.writeValue(data);
  statusMsg = 'Sent angle: ' + angle;
}
