// Arduino BLE + NeoPixel 제어 예제 (음성 챗봇 명령 수신)
// - BLE로 JSON 명령 수신: {"cmd":"set","pixel":5,"color":[255,0,0]}
// - 전체 ON/OFF, 밝기, 특정 픽셀 색상 등
#include <ArduinoBLE.h>
#include <Adafruit_NeoPixel.h>

#define PIN        6
#define NUMPIXELS 160
Adafruit_NeoPixel strip(NUMPIXELS, PIN, NEO_GRB + NEO_KHZ800);

BLEService ledService("19b10000-e8f2-537e-4f6c-d104768a1214");
BLECharacteristic ledChar("19b10001-e8f2-537e-4f6c-d104768a1214", BLEWrite, 64);

uint8_t brightness = 128;

void setup() {
  Serial.begin(115200);
  strip.begin();
  strip.show();
  strip.setBrightness(brightness);

  if (!BLE.begin()) {
    Serial.println("BLE failed");
    while (1);
  }
  BLE.setLocalName("NeoPixel-LED");
  BLE.setAdvertisedService(ledService);
  ledService.addCharacteristic(ledChar);
  BLE.addService(ledService);
  BLE.advertise();
  Serial.println("BLE Ready");
}

void loop() {
  BLEDevice central = BLE.central();
  if (central) {
    while (central.connected()) {
      if (ledChar.written()) {
        // BLE에서 받은 바이트 배열을 String으로 변환
        int len = ledChar.valueLength();
        String cmd = "";
        for (int i = 0; i < len; i++) {
          cmd += (char)ledChar.value()[i];
        }
        Serial.print("BLE CMD: "); Serial.println(cmd);
        handleLedCommand(cmd);
      }
    }
  }
}

// 간단한 JSON 파서 (명령: on/off/set/brightness)
void handleLedCommand(String cmd) {
  cmd.trim();
  if (cmd.indexOf("\"cmd\":\"on\"") >= 0) {
    for (int i=0; i<NUMPIXELS; i++) strip.setPixelColor(i, 255,255,255);
    strip.show();
  } else if (cmd.indexOf("\"cmd\":\"off\"") >= 0) {
    for (int i=0; i<NUMPIXELS; i++) strip.setPixelColor(i, 0,0,0);
    strip.show();
  } else if (cmd.indexOf("\"cmd\":\"set\"") >= 0) {
    int p = getJsonInt(cmd, "pixel");
    int r = getJsonIntArr(cmd, "color", 0);
    int g = getJsonIntArr(cmd, "color", 1);
    int b = getJsonIntArr(cmd, "color", 2);
    if (p >= 0 && p < NUMPIXELS) {
      strip.setPixelColor(p, r,g,b);
      strip.show();
    }
  } else if (cmd.indexOf("\"cmd\":\"set_range\"") >= 0) {
    int start = getJsonInt(cmd, "start");
    int end = getJsonInt(cmd, "end");
    int r = getJsonIntArr(cmd, "color", 0);
    int g = getJsonIntArr(cmd, "color", 1);
    int b = getJsonIntArr(cmd, "color", 2);
    if (start >= 0 && end >= start && end < NUMPIXELS) {
      for (int i = start; i <= end; i++) {
        strip.setPixelColor(i, r, g, b);
      }
      strip.show();
    }
  } else if (cmd.indexOf("\"cmd\":\"brightness\"") >= 0) {
    int val = getJsonInt(cmd, "value");
    brightness = constrain(val, 0, 255);
    strip.setBrightness(brightness);
    strip.show();
  } else if (cmd.indexOf("\"cmd\":\"rainbow\"") >= 0) {
    runRainbowEffect();
  } else if (cmd.indexOf("\"cmd\":\"breathe\"") >= 0) {
    runBreatheEffect();
  }
}

// Rainbow effect
void runRainbowEffect() {
  for (int j=0; j<256*3; j++) {
    for (int i=0; i<NUMPIXELS; i++) {
      int pixelHue = (i * 256 / NUMPIXELS + j) & 255;
      strip.setPixelColor(i, strip.gamma32(strip.ColorHSV(pixelHue * 65536L / 256)));
    }
    strip.show();
    delay(10);
  }
}

// Breathe effect
void runBreatheEffect() {
  uint32_t color = strip.Color(255, 255, 255); // 기본 흰색
  for (int cycle=0; cycle<3; cycle++) {
    for (int b=0; b<=255; b+=5) {
      strip.setBrightness(b);
      for (int i=0; i<NUMPIXELS; i++) strip.setPixelColor(i, color);
      strip.show();
      delay(8);
    }
    for (int b=255; b>=0; b-=5) {
      strip.setBrightness(b);
      for (int i=0; i<NUMPIXELS; i++) strip.setPixelColor(i, color);
      strip.show();
      delay(8);
    }
  }
  strip.setBrightness(brightness); // restore
  for (int i=0; i<NUMPIXELS; i++) strip.setPixelColor(i, color);
  strip.show();
}

// JSON 파싱 유틸 (매우 단순, 실전은 ArduinoJson 권장)
int getJsonInt(String s, String key) {
  int idx = s.indexOf("\""+key+"\":");
  if (idx < 0) return -1;
  int start = s.indexOf(':', idx)+1;
  int end = s.indexOf(',', start);
  if (end < 0) end = s.indexOf('}', start);
  return s.substring(start, end).toInt();
}
int getJsonIntArr(String s, String key, int arrIdx) {
  int idx = s.indexOf("\""+key+"\":[");
  if (idx < 0) return 0;
  int start = s.indexOf('[', idx)+1;
  for (int i=0; i<arrIdx; i++) start = s.indexOf(',', start)+1;
  int end = s.indexOf(',', start);
  if (arrIdx==2 || end<0) end = s.indexOf(']', start);
  return s.substring(start, end).toInt();
}
