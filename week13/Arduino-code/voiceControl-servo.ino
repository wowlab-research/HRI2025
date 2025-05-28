// Arduino Nano 33 BLE Sense Rev2: BLE + Servo Voice Control
// - Receives angle (byte) via BLE (128bit UUID)
// - Sets servo to 180 (open) or 90 (close)
#include <ArduinoBLE.h>
#include <Servo.h>

Servo myServo;
const int servoPin = 9;
#define SERVICE_UUID        "12345678-1234-5678-1234-56789abcdef0"
#define CHARACTERISTIC_UUID "abcdef01-1234-5678-1234-56789abcdef0"

BLEService servoService(SERVICE_UUID);
BLECharacteristic angleChar(CHARACTERISTIC_UUID, BLEWrite | BLEWriteWithoutResponse, 1); // 1 byte

void setup() {
  Serial.begin(115200);
  myServo.attach(servoPin);
  myServo.write(90); // Default closed

  if (!BLE.begin()) {
    Serial.println("BLE init failed");
    while (1);
  }
  BLE.setLocalName("NanoServo");
  BLE.setAdvertisedService(servoService);
  servoService.addCharacteristic(angleChar);
  BLE.addService(servoService);
  angleChar.writeValue((byte)90);
  BLE.advertise();
  Serial.println("BLE advertising");
}

void loop() {
  BLEDevice central = BLE.central();
  if (central) {
    Serial.print("Connected: "); Serial.println(central.address());
    while (central.connected()) {
      if (angleChar.written()) {
        byte angle;
        angleChar.readValue(&angle, 1);
        myServo.write(angle);
        Serial.print("Servo angle: "); Serial.println(angle);
      }
    }
    myServo.write(90); // Default closed on disconnect
    Serial.println("Disconnected");
  }
}
