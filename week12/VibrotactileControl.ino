// Nano 33 BLE Sense Rev2: BLE + PWM 진동 모듈 제어 예제
#include <ArduinoBLE.h>

// 진동 모듈 연결 핀 (PWM 지원 핀)
const int vibroPin = 3; // D3 (PWM)
const int ledPin = 13; // 내장 LED

// 128-bit UUID (예시, p5.js와 동일하게 맞춰야 함)
#define SERVICE_UUID        "12345678-1234-5678-1234-56789abcdef0"
#define CHARACTERISTIC_UUID "12345678-1234-5678-1234-56789abcdef1"

BLEService vibroService(SERVICE_UUID);
BLECharacteristic pwmChar(CHARACTERISTIC_UUID, BLEWrite | BLEWriteWithoutResponse, 1); // 1바이트: 0~255

void setup() {
  Serial.begin(115200);
  pinMode(vibroPin, OUTPUT);
  pinMode(ledPin, OUTPUT); // 내장 LED
  analogWrite(vibroPin, 0); // 진동 OFF
  digitalWrite(ledPin, LOW); // LED OFF

  if (!BLE.begin()) {
    Serial.println("BLE 초기화 실패");
    while (1);
  }
  BLE.setLocalName("NanoVibro");
  BLE.setAdvertisedService(vibroService);
  vibroService.addCharacteristic(pwmChar);
  BLE.addService(vibroService);
  pwmChar.writeValue((byte)0);
  BLE.advertise();
  Serial.println("BLE 광고 시작");
}

void loop() {
  BLEDevice central = BLE.central();
  if (central) {
    Serial.print("연결됨: "); Serial.println(central.address());
    while (central.connected()) {
      if (pwmChar.written()) {
        byte pwmValue;
        pwmChar.readValue(&pwmValue, 1);
        analogWrite(vibroPin, pwmValue); // 0~255
        // 내장 LED: PWM 10 이상이면 ON, 아니면 OFF
        if (pwmValue >= 10) {
          digitalWrite(ledPin, HIGH);
        } else {
          digitalWrite(ledPin, LOW);
        }
        Serial.print("PWM: "); Serial.println(pwmValue);
      }
    }
    analogWrite(vibroPin, 0); // 연결 해제시 진동 OFF
    digitalWrite(ledPin, LOW); // LED OFF
    Serial.println("연결 해제");
  }
}
